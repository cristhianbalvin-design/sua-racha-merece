-- Paso 19: un testador crea rutas fuera de su ciudad; un atleta común no; solo el admin gestiona testadores.
\c - postgres
\i :sqldir/19_testadores_rutas.sql
BEGIN;
INSERT INTO public.users (id, email, role, city_code) VALUES
  ('19000000-0000-0000-0000-000000000001', 't19@buky.test', 'USUARIO', 3303302),
  ('19000000-0000-0000-0000-000000000002', 'c19@buky.test', 'USUARIO', 3303302),
  ('19000000-0000-0000-0000-000000000003', 'adm19@buky.test', 'ADMIN', 3303302);
COMMIT;

\c - authenticator
-- Puntos en Chaclacayo (Lima, Perú), ~3.700 km de Niterói, separados ~555 m
\set lima '[{"lat":-11.9800,"lon":-76.7700},{"lat":-11.9850,"lon":-76.7700},{"lat":-11.9900,"lon":-76.7700},{"lat":-11.9950,"lon":-76.7700}]'

-- Atleta común: rechazado y no puede hacerse testador
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000002', true);
DO $$
BEGIN
  IF public.buky_is_route_tester() THEN RAISE EXCEPTION 'atleta común no es testador'; END IF;
  BEGIN
    PERFORM public.buky_create_athlete_route('Lima', 3303302, '[{"lat":-11.9800,"lon":-76.7700},{"lat":-11.9850,"lon":-76.7700},{"lat":-11.9900,"lon":-76.7700},{"lat":-11.9950,"lon":-76.7700}]');
    RAISE EXCEPTION 'debió rechazar la ruta fuera de la ciudad';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'point_outside_city' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.buky_route_testers (user_id) VALUES ('19000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'un atleta no puede hacerse testador';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- Admin agrega al testador
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000003', true);
INSERT INTO public.buky_route_testers (user_id, note) VALUES ('19000000-0000-0000-0000-000000000001', 'Prueba en Perú')
  ON CONFLICT (user_id) DO NOTHING;
DO $$ BEGIN IF NOT public.buky_is_route_tester() THEN RAISE EXCEPTION 'el admin cuenta como testador'; END IF; END $$;
COMMIT;

-- Testador: crea la ruta en Lima; el resto de reglas sigue (puntos pegados se rechazan)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE v_route uuid;
BEGIN
  IF NOT public.buky_is_route_tester() THEN RAISE EXCEPTION 'debe ser testador'; END IF;
  v_route := public.buky_create_athlete_route('Lima', 3303302, '[{"lat":-11.9800,"lon":-76.7700},{"lat":-11.9850,"lon":-76.7700},{"lat":-11.9900,"lon":-76.7700},{"lat":-11.9950,"lon":-76.7700}]');
  IF (SELECT count(*) FROM public.buky_points WHERE route_id = v_route) <> 4 THEN RAISE EXCEPTION 'faltan puntos'; END IF;
  BEGIN
    PERFORM public.buky_create_athlete_route('Pegados', 3303302, '[{"lat":-11.9800,"lon":-76.7700},{"lat":-11.9801,"lon":-76.7700},{"lat":-11.9900,"lon":-76.7700}]');
    RAISE EXCEPTION 'debió rechazar puntos pegados';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'points_too_close' THEN RAISE; END IF;
  END;
  -- solo ve su propia fila de testador
  IF (SELECT count(*) FROM public.buky_route_testers) <> 1 THEN RAISE EXCEPTION 'RLS de testadores'; END IF;
END $$;
COMMIT;
