#!/usr/bin/env bash
# Crea un Postgres temporal, simula Supabase, aplica los SQL de Buky y corre las pruebas.
# Uso: supabase/tests/buky/run.sh   (requiere PostgreSQL 15+ instalado localmente)
set -euo pipefail
# initdb no corre como root: se relanza como el usuario postgres.
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then exec runuser -u postgres -- "$0" "$@"; fi
HERE="$(cd "$(dirname "$0")" && pwd)"
SQL="$HERE/../../manual-sql/buky"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PORT:-55432}"
cleanup() { "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start >/dev/null
export PGHOST="$DATA" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
run() { psql -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null && echo "ok  $(basename "$1")"; }
run "$HERE/00_supabase_stubs.sql"
for f in "$SQL"/[0-9][0-9]_*.sql; do run "$f"; done
for f in "$HERE"/test_*.sql; do run "$f"; done
# Idempotencia: volver a aplicar cada paso sobre la base ya poblada no debe fallar ni duplicar datos.
for f in "$SQL"/[0-9][0-9]_*.sql; do psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 && echo "ok  (re-ejecución) $(basename "$f")" || { echo "FALLA re-ejecución $(basename "$f")"; exit 1; }; done
CHECK="$(psql -qtA -c "SELECT CASE WHEN (SELECT count(*) FROM public.br_cities)=5571 AND (SELECT count(*) FROM public.buky_ledger)>0 THEN 'ok  datos intactos tras re-ejecución' ELSE 'FALLA datos' END")"
echo "$CHECK"; [[ "$CHECK" == ok* ]] || exit 1
echo "Todas las pruebas SQL de Buky pasaron."
