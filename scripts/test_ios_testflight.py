import contextlib
import io
import unittest
from unittest.mock import patch

from scripts import ios_signing as ios


class Respuesta:
    def __init__(self, data=None, status=200):
        self.data = data if data is not None else {}
        self.status_code = status
        self.ok = 200 <= status < 300
        self.text = str(self.data)

    def json(self):
        return self.data


def lista(*data):
    return Respuesta({"data": list(data)})


def recurso(id, **attrs):
    return {"id": id, "attributes": attrs}


class TestTestFlight(unittest.TestCase):
    def test_parseo_y_enmascarado(self):
        self.assertEqual(ios.parse_testers(" A@Ejemplo.com, b@x.com\nA@ejemplo.com c@x.com "),
                         ["a@ejemplo.com", "b@x.com", "c@x.com"])
        self.assertEqual(ios.mask_email("jose@gmail.com"), "jo***@gmail.com")
        self.assertEqual(ios.mask_email("invalido"), "***")

    @patch.object(ios, "call")
    def test_grupo_nuevo_y_existente(self, call):
        group = recurso("g", name="Equipo 3buk", isInternalGroup=True, hasAccessToAllBuilds=True)
        call.side_effect = [lista(), Respuesta({"data": group}), lista(group)]
        self.assertEqual(ios.tf_group("app", "Equipo 3buk"), group)
        self.assertTrue(call.call_args_list[1].kwargs["json"]["data"]["attributes"]["isInternalGroup"])
        self.assertEqual(ios.tf_group("app", "Equipo 3buk"), group)
        self.assertEqual(call.call_count, 3)

    @patch.object(ios, "call")
    def test_grupo_externo(self, call):
        call.return_value = lista(recurso("g", name="Equipo", isInternalGroup=False))
        with self.assertRaises(RuntimeError), contextlib.redirect_stdout(io.StringIO()):
            ios.tf_group("app", "Equipo")

    @patch.object(ios.time, "sleep")
    @patch.object(ios, "call")
    def test_compilacion_en_proceso(self, call, sleep):
        pending = recurso("b", version="104", processingState="PROCESSING")
        valid = recurso("b", version="104", processingState="VALID", usesNonExemptEncryption=None)
        call.side_effect = [Respuesta({"data": [pending], "included": [{"type": "preReleaseVersions", "attributes": {"version": "0.4"}}]}),
                            Respuesta({"data": valid}), Respuesta({"data": valid})]
        build, version = ios.tf_build("app", 30)
        self.assertEqual((build["id"], version), ("b", "0.4"))
        sleep.assert_called_once()
        self.assertEqual(call.call_args_list[2].args[:2], ("PATCH", "/builds/b"))

    @patch.object(ios, "call")
    def test_usuario_ausente_y_pendiente(self, call):
        call.side_effect = [lista(), lista(), lista(), lista(recurso("i", email="joe@x.com"))]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(ios.tf_tester("joe@x.com", "a", "g"), "error")
            self.assertEqual(ios.tf_tester("joe@x.com", "a", "g"), "error")
        self.assertIn("Usuarios y acceso", output.getvalue())
        self.assertIn("todavía no aceptó", output.getvalue())
        self.assertNotIn("joe@x.com", output.getvalue())

    @patch.object(ios, "call")
    def test_probador_nuevo(self, call):
        user = recurso("u", username="joe@x.com", firstName="Joe", lastName="Pérez")
        call.side_effect = [lista(user), lista(), Respuesta({"data": recurso("t")}, 201), Respuesta({}, 201)]
        self.assertEqual(ios.tf_tester("joe@x.com", "a", "g"), "invitación enviada")
        self.assertEqual(call.call_args_list[2].kwargs["json"]["data"]["attributes"]["firstName"], "Joe")

    @patch.object(ios, "call")
    def test_probador_existente_y_conflicto(self, call):
        user = recurso("u", username="joe@x.com")
        tester = recurso("t", email="joe@x.com")
        call.side_effect = [lista(user), lista(tester), Respuesta({}, 409), Respuesta({}, 201)]
        self.assertEqual(ios.tf_tester("joe@x.com", "a", "g"), "invitación enviada")

    @patch.dict(ios.os.environ, {"TESTERS": "joe@x.com", "TF_WAIT_MIN": "0"})
    @patch.object(ios, "call")
    def test_flujo_completo_con_compilacion_agregada(self, call):
        app = recurso("a")
        group = recurso("g", name="Equipo 3buk", isInternalGroup=True, hasAccessToAllBuilds=False)
        build = recurso("b", version="104", processingState="VALID", usesNonExemptEncryption=False)
        user = recurso("u", username="joe@x.com")
        tester = recurso("t", email="joe@x.com")
        call.side_effect = [lista(app), lista(group), Respuesta({"data": [build], "included": [
            {"type": "preReleaseVersions", "attributes": {"version": "0.4"}}]}), Respuesta({}, 204),
            lista(user), lista(tester), Respuesta({}, 409), Respuesta({}, 201)]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            ios.testflight()
        self.assertIn("0.4 (104) · VALID", output.getvalue())
        self.assertIn("jo***@x.com: invitación enviada", output.getvalue())
        self.assertEqual(call.call_args_list[3].args[:2], ("POST", "/betaGroups/g/relationships/builds"))

    @patch.object(ios, "call")
    def test_invitacion_ya_enviada_y_error_distinto(self, call):
        user = recurso("u", username="joe@x.com")
        tester = recurso("t", email="joe@x.com")
        call.side_effect = [lista(user), lista(tester), Respuesta({}, 204),
                            Respuesta({"errors": [{"detail": "Invitation already sent"}]}, 409),
                            lista(user), lista(tester), Respuesta({}, 204),
                            Respuesta({"errors": [{"detail": "No acceso para joe@x.com"}]}, 403)]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(ios.tf_tester("joe@x.com", "a", "g"), "ya estaba")
            self.assertEqual(ios.tf_tester("joe@x.com", "a", "g"), "error")
        self.assertNotIn("joe@x.com", output.getvalue())


if __name__ == "__main__":
    unittest.main()
