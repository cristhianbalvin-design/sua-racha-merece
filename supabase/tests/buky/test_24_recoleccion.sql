-- Paso 24: 2 Bukys por punto y día con 3 min entre ellos, ciudad de inicio y bloqueo por bicicleta.
\c - postgres
\i :sqldir/19_testadores_rutas.sql
\i :sqldir/24_recoleccion_bicicleta.sql
BEGIN;
INSERT INTO public.users (id, email, role, city_code) VALUES
  ('24000000-0000-0000-0000-000000000001', 't24@buky.test', 'USUARIO', 3303302)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.buky_routes (id, name, city_code, kind, length_m)
VALUES ('24000000-0000-0000-0000-0000000000f1', 'Teste 24', 3303302, 'official', 1000)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.buky_points (id, route_id, seq, label, lat, lon) VALUES
  ('24000000-0000-0000-0000-0000000000a1', '24000000-0000-0000-0000-0000000000f1', 0, 'A', -22.9050, -43.1100)
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Ciudad por posición: Niterói centro → 3303302; Lima (Perú) → NULL
DO $$
BEGIN
  IF public.buky_city_at(-22.8833, -43.1036) <> 3303302 THEN
    RAISE EXCEPTION 'esperaba Niterói, salió %', public.buky_city_at(-22.8833, -43.1036);
  END IF;
  IF public.buky_city_at(-12.0464, -77.0428) IS NOT NULL THEN RAISE EXCEPTION 'Lima no es una ciudad de Brasil'; END IF;
  IF public.buky_city_at(NULL, NULL) IS NOT NULL THEN RAISE EXCEPTION 'sin posición no hay ciudad'; END IF;
END $$;

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000001', true);
SELECT public.buky_start_session('24000000-0000-0000-0000-000000000051', '24000000-0000-0000-0000-0000000000f1');
COMMIT;

\c - postgres
DO $$
DECLARE r jsonb; v_s record; v_reasons text[];
BEGIN
  -- Mismo punto 4 veces: 10:00 (sí), 10:02 (muy pronto), 10:05 (sí), 10:20 (tope de 2 por día)
  r := public.buky_finalize_session('24000000-0000-0000-0000-000000000051', '24000000-0000-0000-0000-000000000001',
        'valid', NULL,
        '{"ended_at":"2026-11-09T13:30:00Z","distance_m":3000,"duration_s":1800,"start_lat":-22.905,"start_lon":-43.11,"stop_reason":"bike","bike_warnings":3}',
        '[{"point_id":"24000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-09T13:00:00Z","valid":true},
          {"point_id":"24000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-09T13:02:00Z","valid":true},
          {"point_id":"24000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-09T13:05:00Z","valid":true},
          {"point_id":"24000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-09T13:20:00Z","valid":true}]');
  IF (r ->> 'bukys')::int <> 2 THEN RAISE EXCEPTION 'esperaba 2 Bukys, %', r; END IF;
  SELECT array_agg(coalesce(reject_reason, 'ok') ORDER BY passed_at) INTO v_reasons
  FROM public.buky_passes WHERE session_id = '24000000-0000-0000-0000-000000000051';
  IF v_reasons <> ARRAY['ok', 'point_too_soon', 'ok', 'point_daily_limit'] THEN RAISE EXCEPTION 'motivos %', v_reasons; END IF;
  SELECT * INTO v_s FROM public.buky_sessions WHERE id = '24000000-0000-0000-0000-000000000051';
  IF v_s.start_city_code IS DISTINCT FROM 3303302 THEN RAISE EXCEPTION 'ciudad de inicio %', v_s.start_city_code; END IF;
  IF v_s.stop_reason <> 'bike' OR v_s.bike_warnings <> 3 THEN RAISE EXCEPTION 'datos de bicicleta'; END IF;
END $$;

-- Al día siguiente (hora de Brasil) vuelve a poder: 00:30 en São Paulo = 03:30 UTC
DO $$
DECLARE r jsonb;
BEGIN
  INSERT INTO public.buky_sessions (id, user_id, route_id, status)
  VALUES ('24000000-0000-0000-0000-000000000052', '24000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-0000000000f1', 'running');
  r := public.buky_finalize_session('24000000-0000-0000-0000-000000000052', '24000000-0000-0000-0000-000000000001',
        'valid', NULL, '{"stop_reason":"nada"}',
        '[{"point_id":"24000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-10T03:30:00Z","valid":true}]');
  IF (r ->> 'bukys')::int <> 1 THEN RAISE EXCEPTION 'nuevo día debe dar Buky, %', r; END IF;
  IF (SELECT stop_reason FROM public.buky_sessions WHERE id = '24000000-0000-0000-0000-000000000052') IS NOT NULL THEN
    RAISE EXCEPTION 'motivo de corte inválido debe quedar vacío';
  END IF;
END $$;

-- Bloqueo: 1 corte hoy no bloquea; 2 cortes sí
UPDATE public.buky_sessions SET started_at = now(), stop_reason = 'bike'
WHERE id = '24000000-0000-0000-0000-000000000051';
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE st jsonb;
BEGIN
  st := public.buky_my_status();
  IF (st ->> 'bike_stops_today')::int <> 1 OR (st ->> 'blocked_today')::boolean THEN RAISE EXCEPTION 'estado %', st; END IF;
  IF (st ->> 'found_total')::int < 3 OR (st ->> 'sponsorship_min')::int <> 200 THEN RAISE EXCEPTION 'contadores %', st; END IF;
  PERFORM public.buky_start_session('24000000-0000-0000-0000-000000000053', '24000000-0000-0000-0000-0000000000f1');
END $$;
COMMIT;

\c - postgres
UPDATE public.buky_sessions SET status = 'valid', stop_reason = 'bike', started_at = now()
WHERE id = '24000000-0000-0000-0000-000000000053';
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
  IF NOT (public.buky_my_status() ->> 'blocked_today')::boolean THEN RAISE EXCEPTION 'debe figurar bloqueado'; END IF;
  BEGIN
    PERFORM public.buky_start_session(gen_random_uuid(), '24000000-0000-0000-0000-0000000000f1');
    RAISE EXCEPTION 'debió bloquear el 3.er inicio';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'blocked_today' THEN RAISE; END IF;
  END;
  -- Reintento del mismo inicio sigue funcionando (idempotente)
  PERFORM public.buky_start_session('24000000-0000-0000-0000-000000000053', '24000000-0000-0000-0000-0000000000f1');
END $$;
COMMIT;
