#!/usr/bin/env python3
"""Firma de la app iOS en CI usando la API de App Store Connect.

No necesita un Mac propio ni dispositivos registrados: crea un certificado
"Apple Distribution" y un perfil "App Store" temporales, los instala en un
llavero del runner y, al terminar, los revoca/borra.

Uso (variables de entorno ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8, APPLE_TEAM_ID):
  python ios_signing.py check            # valida la clave y la configuración
  python ios_signing.py setup <workdir>  # crea certificado + perfil
  python ios_signing.py cleanup <workdir>
Escribe anotaciones ::notice / ::error para leerlas desde la API de GitHub.
"""
import base64
import json
import os
import pathlib
import plistlib
import subprocess
import sys
import time
import re
import io
import contextlib
from urllib.parse import urlsplit

import jwt
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

API = "https://api.appstoreconnect.apple.com/v1"
BUNDLE_ID = os.environ.get("IOS_BUNDLE_ID", "com.tresbuk.app")
KEYCHAIN = "build.keychain"


def notice(title, msg):
    print(f"::notice title={title}::{msg}", flush=True)


def error(title, msg):
    print(f"::error title={title}::{msg}", flush=True)


def env(name):
    value = os.environ.get(name, "")
    if not value.strip():
        error("Secretos", f"Falta el secreto {name}")
        sys.exit(1)
    return value


def private_key_pem():
    raw = env("ASC_API_KEY_P8").replace("\r\n", "\n").replace("\r", "\n").strip()
    lines = [l.strip() for l in raw.split("\n") if l.strip()]
    if not lines or "BEGIN PRIVATE KEY" not in lines[0] or "END PRIVATE KEY" not in lines[-1]:
        error(
            "Clave .p8",
            f"ASC_API_KEY_P8 no tiene el formato esperado: {len(lines)} líneas; "
            f"primera línea {'OK' if lines and 'BEGIN PRIVATE KEY' in lines[0] else 'sin BEGIN PRIVATE KEY'}; "
            f"última línea {'OK' if lines and 'END PRIVATE KEY' in lines[-1] else 'sin END PRIVATE KEY'}.",
        )
        sys.exit(1)
    # Se reconstruye siempre un PEM canónico: el secreto puede venir en una sola
    # línea, con espacios o con saltos de línea de Windows.
    body = "".join(lines).replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
    body = "".join(body.split())
    pem = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(body[i : i + 64] for i in range(0, len(body), 64)) + "\n-----END PRIVATE KEY-----\n"
    try:
        serialization.load_pem_private_key(pem.encode(), password=None)
    except Exception as exc:  # noqa: BLE001
        error("Clave .p8", f"El contenido de ASC_API_KEY_P8 no es una clave privada válida ({type(exc).__name__}).")
        sys.exit(1)
    return pem


def token():
    now = int(time.time())
    return jwt.encode(
        {"iss": env("ASC_ISSUER_ID").strip(), "iat": now, "exp": now + 15 * 60, "aud": "appstoreconnect-v1"},
        private_key_pem(),
        algorithm="ES256",
        headers={"kid": env("ASC_KEY_ID").strip(), "typ": "JWT"},
    )


def call(method, path, **kwargs):
    headers = {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}
    res = requests.request(method, f"{API}{path}", headers=headers, timeout=60, **kwargs)
    return res


def explain(res, what):
    try:
        errs = res.json().get("errors", [])
        detail = "; ".join(f"{e.get('title')}: {e.get('detail')}" for e in errs)[:500]
    except Exception:  # noqa: BLE001
        detail = res.text[:300]
    error(what, f"HTTP {res.status_code} — {detail}")


def check():
    res = call("GET", "/apps", params={"filter[bundleId]": BUNDLE_ID, "limit": 5})
    if res.status_code == 401:
        explain(res, "Clave API")
        error(
            "Clave API",
            "Apple no acepta la clave: revisa que ASC_KEY_ID e ASC_ISSUER_ID correspondan a una clave de EQUIPO "
            "(Integraciones > App Store Connect API > Claves de equipo) y que ASC_API_KEY_P8 sea ese mismo .p8.",
        )
        sys.exit(1)
    if res.status_code == 403:
        explain(res, "Permisos de la clave")
        sys.exit(1)
    if not res.ok:
        explain(res, "API de Apple")
        sys.exit(1)
    notice("Clave API", "Apple aceptó la clave (autenticación correcta).")
    apps = res.json().get("data", [])
    if apps:
        a = apps[0]["attributes"]
        notice("App", f"App encontrada en App Store Connect: {a.get('name')} ({a.get('bundleId')}).")
    else:
        error("App", f"No hay una app con el Bundle ID {BUNDLE_ID} en App Store Connect (paso 3b).")
    bid = call("GET", "/bundleIds", params={"filter[identifier]": BUNDLE_ID, "limit": 5})
    found = [b for b in bid.json().get("data", []) if b["attributes"]["identifier"] == BUNDLE_ID] if bid.ok else []
    if found:
        notice("Bundle ID", f"Bundle ID {BUNDLE_ID} registrado.")
    else:
        error("Bundle ID", f"El Bundle ID {BUNDLE_ID} no está registrado (paso 3a).")
    if not apps or not found:
        sys.exit(1)
    return found[0]["id"]


def revoke_previous_ci_signing():
    """Borra perfiles "3BUK CI *" de compilaciones anteriores y revoca sus certificados.

    Así nunca se acumulan certificados de distribución (Apple permite pocos).
    El certificado de la compilación actual se mantiene hasta la siguiente.
    """
    res = call("GET", "/profiles", params={"filter[name]": "3BUK CI", "include": "certificates", "limit": 50})
    if not res.ok:
        explain(res, "Limpieza")
        return
    body = res.json()
    cert_ids = set()
    for prof in body.get("data", []):
        if not prof["attributes"]["name"].startswith("3BUK CI"):
            continue
        for c in prof.get("relationships", {}).get("certificates", {}).get("data", []) or []:
            cert_ids.add(c["id"])
        call("DELETE", f"/profiles/{prof['id']}")
    for cid in cert_ids:
        call("DELETE", f"/certificates/{cid}")
    if cert_ids:
        notice("Limpieza", f"Revocados {len(cert_ids)} certificado(s) de compilaciones anteriores.")


def setup(workdir):
    workdir = pathlib.Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    bundle_resource_id = check()
    revoke_previous_ci_signing()

    # 1) Certificado Apple Distribution temporal (clave privada generada aquí).
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "3BUK CI"), x509.NameAttribute(NameOID.EMAIL_ADDRESS, "ci@3buk.com")]))
        .sign(key, hashes.SHA256())
    )
    csr_b64 = csr.public_bytes(serialization.Encoding.PEM).decode()
    res = call("POST", "/certificates", json={"data": {"type": "certificates", "attributes": {"certificateType": "DISTRIBUTION", "csrContent": csr_b64}}})
    if not res.ok:
        explain(res, "Certificado")
        sys.exit(1)
    cert_data = res.json()["data"]
    cert_id = cert_data["id"]
    (workdir / "cert_id").write_text(cert_id)
    cert = x509.load_der_x509_certificate(base64.b64decode(cert_data["attributes"]["certificateContent"]))
    notice("Certificado", f"Certificado de distribución temporal creado ({cert_id}).")

    password = base64.urlsafe_b64encode(os.urandom(18)).decode()
    encryption = (
        serialization.PrivateFormat.PKCS12.encryption_builder()
        .kdf_rounds(50000)
        .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
        .hmac_hash(hashes.SHA1())
        .build(password.encode())
    )
    p12 = pkcs12.serialize_key_and_certificates(b"3BUK CI", key, cert, None, encryption)
    (workdir / "cert.p12").write_bytes(p12)

    # 2) Perfil App Store para el Bundle ID con ese certificado.
    profile_name = f"3BUK CI {os.environ.get('GITHUB_RUN_NUMBER', int(time.time()))}"
    res = call(
        "POST",
        "/profiles",
        json={
            "data": {
                "type": "profiles",
                "attributes": {"name": profile_name, "profileType": "IOS_APP_STORE"},
                "relationships": {
                    "bundleId": {"data": {"type": "bundleIds", "id": bundle_resource_id}},
                    "certificates": {"data": [{"type": "certificates", "id": cert_id}]},
                },
            }
        },
    )
    if not res.ok:
        explain(res, "Perfil")
        sys.exit(1)
    prof = res.json()["data"]
    (workdir / "profile_id").write_text(prof["id"])
    content = base64.b64decode(prof["attributes"]["profileContent"])
    uuid = prof["attributes"]["uuid"]
    dest = pathlib.Path.home() / "Library/MobileDevice/Provisioning Profiles"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / f"{uuid}.mobileprovision").write_bytes(content)
    notice("Perfil", f"Perfil App Store temporal creado: {profile_name}.")

    # 3) Llavero temporal con el certificado.
    kc_pass = base64.urlsafe_b64encode(os.urandom(18)).decode()
    run = lambda *a: subprocess.run(a, check=True, capture_output=True)  # noqa: E731
    subprocess.run(["security", "delete-keychain", KEYCHAIN], capture_output=True)
    run("security", "create-keychain", "-p", kc_pass, KEYCHAIN)
    run("security", "set-keychain-settings", "-lut", "21600", KEYCHAIN)
    run("security", "unlock-keychain", "-p", kc_pass, KEYCHAIN)
    run("security", "import", str(workdir / "cert.p12"), "-k", KEYCHAIN, "-P", password, "-T", "/usr/bin/codesign", "-T", "/usr/bin/security")
    run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", kc_pass, KEYCHAIN)
    existing = subprocess.run(["security", "list-keychains", "-d", "user"], capture_output=True, text=True).stdout
    keychains = [k.strip().strip('"') for k in existing.split("\n") if k.strip()]
    run("security", "list-keychains", "-d", "user", "-s", KEYCHAIN, *keychains)
    (workdir / "cert.p12").unlink()

    # Datos para los pasos de xcodebuild.
    out = os.environ.get("GITHUB_ENV")
    if out:
        with open(out, "a") as fh:
            fh.write(f"IOS_PROFILE_NAME={profile_name}\n")
            fh.write(f"IOS_PROFILE_UUID={uuid}\n")
    notice("Firma", "Certificado y perfil instalados en el llavero del runner.")


def cleanup(workdir):
    # El perfil y el certificado se dejan vivos hasta la próxima compilación
    # (los limpia revoke_previous_ci_signing). Aquí solo se borra el llavero local.
    subprocess.run(["security", "delete-keychain", KEYCHAIN], capture_output=True)
    for f in ("cert.p12",):
        (pathlib.Path(workdir) / f).unlink(missing_ok=True)

def builds():
    apps = call("GET", "/apps", params={"filter[bundleId]": BUNDLE_ID, "limit": 1})
    if not apps.ok or not apps.json().get("data"):
        explain(apps, "Builds")
        return
    app_id = apps.json()["data"][0]["id"]
    res = call("GET", "/builds", params={"filter[app]": app_id, "sort": "-uploadedDate", "limit": 5})
    if not res.ok:
        explain(res, "Builds")
        return
    data = res.json().get("data", [])
    if not data:
        notice("Builds en Apple", "Todavía no hay compilaciones en App Store Connect.")
    for b in data:
        a = b["attributes"]
        notice("Builds en Apple", f"build {a.get('version')} · {a.get('processingState')} · subida {a.get('uploadedDate')}")


def parse_testers(value):
    correos = re.split(r"[,\s]+", value.strip())
    return list(dict.fromkeys(c.lower() for c in correos if c))


def mask_email(email):
    local, sep, domain = email.partition("@")
    return f"{local[:2]}***@{domain}" if sep else "***"


def explain_testflight(res, title):
    # Apple puede incluir direcciones en el detalle de un error HTTP.
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        explain(res, title)
    print(re.sub(r"[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}", lambda m: mask_email(m.group()), output.getvalue()), end="", flush=True)


def tf_request(method, path, title, **kwargs):
    res = call(method, path, **kwargs)
    if not res.ok:
        explain_testflight(res, title)
        raise RuntimeError(title)
    return res.json()


def tf_list(path, title, params=None):
    # Se recorren todas las páginas para no duplicar un grupo existente.
    items = []
    while path:
        body = tf_request("GET", path, title, params=params)
        items.extend(body.get("data", []))
        next_url = body.get("links", {}).get("next")
        if next_url:
            parts = urlsplit(next_url)
            if parts.netloc != "api.appstoreconnect.apple.com" or not parts.path.startswith("/v1/"):
                raise RuntimeError("Paginación de Apple inválida")
            path = parts.path[3:] + ("?" + parts.query if parts.query else "")
        else:
            path = None
        params = None
    return items


def tf_group(app_id, name):
    groups = tf_list(f"/apps/{app_id}/betaGroups", "Grupo TestFlight", {"limit": 200})
    group = next((g for g in groups if g.get("attributes", {}).get("name") == name), None)
    if group:
        if not group.get("attributes", {}).get("isInternalGroup"):
            error("Grupo TestFlight", f"El grupo {name} existe pero no es interno.")
            raise RuntimeError("Grupo externo")
        return group
    return tf_request("POST", "/betaGroups", "Grupo TestFlight", json={"data": {
        "type": "betaGroups", "attributes": {"name": name, "isInternalGroup": True, "hasAccessToAllBuilds": True},
        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
    }})["data"]


def tf_build(app_id, wait_minutes):
    params = {"filter[app]": app_id, "sort": "-uploadedDate", "limit": 1, "include": "preReleaseVersion"}
    body = tf_request("GET", "/builds", "Compilación", params=params)
    if not body.get("data"):
        error("Compilación", "No hay compilaciones para esta app.")
        raise RuntimeError("Sin compilaciones")
    build = body["data"][0]
    version = next((v.get("attributes", {}).get("version") for v in body.get("included", []) if v.get("type") == "preReleaseVersions"), "desconocida")
    deadline = time.monotonic() + wait_minutes * 60
    while build.get("attributes", {}).get("processingState") == "PROCESSING":
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            error("Compilación", "Se agotó el tiempo de espera del procesamiento.")
            raise RuntimeError("Espera agotada")
        time.sleep(min(30, remaining))
        build = tf_request("GET", f"/builds/{build['id']}", "Compilación")["data"]
    state = build.get("attributes", {}).get("processingState")
    if state != "VALID":
        error("Compilación", f"La compilación no está lista: {state}.")
        raise RuntimeError("Compilación no válida")
    if build.get("attributes", {}).get("usesNonExemptEncryption") is None:
        tf_request("PATCH", f"/builds/{build['id']}", "Cifrado", json={"data": {
            "type": "builds", "id": build["id"], "attributes": {"usesNonExemptEncryption": False},
        }})
    return build, version


def tf_tester(email, app_id, group_id):
    masked = mask_email(email)
    users = tf_list("/users", "Usuario de App Store Connect", {"filter[username]": email})
    user = next((u for u in users if u.get("attributes", {}).get("username", "").lower() == email.lower()), None)
    if not user:
        invitations = tf_list("/userInvitations", "Invitación de App Store Connect", {"filter[email]": email})
        if any(i.get("attributes", {}).get("email", "").lower() == email.lower() for i in invitations):
            error("Probador", f"El usuario {masked} todavía no aceptó la invitación de App Store Connect.")
        else:
            error("Probador", f"El usuario {masked} no existe; primero hay que darle de alta en Usuarios y acceso de App Store Connect.")
        return "error"
    testers = tf_list("/betaTesters", "Probador TestFlight", {"filter[email]": email})
    tester = next((t for t in testers if t.get("attributes", {}).get("email", "").lower() == email.lower()), None)
    if tester:
        res = call("POST", f"/betaGroups/{group_id}/relationships/betaTesters", json={"data": [{"type": "betaTesters", "id": tester["id"]}]})
        if not res.ok and res.status_code != 409:
            explain_testflight(res, "Añadir probador")
            return "error"
    else:
        attrs = user.get("attributes", {})
        body = tf_request("POST", "/betaTesters", "Crear probador", json={"data": {
            "type": "betaTesters", "attributes": {"email": email, "firstName": attrs.get("firstName") or email.split("@")[0], "lastName": attrs.get("lastName") or "Probador"},
            "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": group_id}]}},
        }})
        tester = body["data"]
    res = call("POST", "/betaTesterInvitations", json={"data": {"type": "betaTesterInvitations", "relationships": {
        "app": {"data": {"type": "apps", "id": app_id}}, "betaTester": {"data": {"type": "betaTesters", "id": tester["id"]}},
    }}})
    if not res.ok:
        # No se ocultan conflictos ajenos a una invitación ya enviada.
        try:
            detail = str(res.json()).lower() if res.status_code in (400, 409, 422) else ""
        except ValueError:
            detail = ""
        if "already" in detail and ("invit" in detail or "sent" in detail):
            return "ya estaba"
        explain_testflight(res, "Invitación TestFlight")
        return "error"
    return "invitación enviada"


def testflight():
    testers = parse_testers(os.environ.get("TESTERS", ""))
    if not testers:
        error("TestFlight", "TESTERS es obligatorio y debe contener correos.")
        sys.exit(1)
    try:
        wait_minutes = float(os.environ.get("TF_WAIT_MIN", "30"))
        if not 0 <= wait_minutes < float("inf"):
            raise ValueError()
    except ValueError:
        error("TestFlight", "TF_WAIT_MIN debe ser un número no negativo.")
        sys.exit(1)
    group_name = os.environ.get("TF_GROUP", "Equipo 3buk").strip() or "Equipo 3buk"
    try:
        apps = tf_list("/apps", "App", {"filter[bundleId]": BUNDLE_ID, "limit": 5})
        if not apps:
            error("App", f"No se encontró la app {BUNDLE_ID}.")
            sys.exit(1)
        app_id = apps[0]["id"]
        group = tf_group(app_id, group_name)
        build, version = tf_build(app_id, wait_minutes)
        if not group.get("attributes", {}).get("hasAccessToAllBuilds"):
            res = call("POST", f"/betaGroups/{group['id']}/relationships/builds", json={"data": [{"type": "builds", "id": build["id"]}]})
            if not res.ok and res.status_code != 409:
                explain_testflight(res, "Añadir compilación")
                raise RuntimeError("Añadir compilación")
        notice("TestFlight", f"Grupo: {group_name} · compilación: {version} ({build['attributes'].get('version')}) · {build['attributes'].get('processingState')}")
        failed = False
        for email in testers:
            try:
                result = tf_tester(email, app_id, group["id"])
            except RuntimeError:
                result = "error"
            notice("Probador TestFlight", f"{mask_email(email)}: {result}")
            failed |= result == "error"
        if failed:
            sys.exit(1)
    except RuntimeError:
        sys.exit(1)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        check()
    elif cmd == "setup":
        setup(sys.argv[2])
    elif cmd == "write-key":
        # Escribe el .p8 ya normalizado (el secreto puede venir sin saltos de línea).
        pathlib.Path(sys.argv[2]).write_text(private_key_pem())
        os.chmod(sys.argv[2], 0o600)
    elif cmd == "builds":
        builds()
    elif cmd == "testflight":
        testflight()
    elif cmd == "cleanup":
        cleanup(sys.argv[2])
    else:
        sys.exit(f"comando desconocido: {cmd}")
