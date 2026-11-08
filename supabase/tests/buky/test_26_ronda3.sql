-- Paso 26: tope de 12 por día, bloqueo desde el 1.er corte, solo la app inicia, ranking y ganadores.
\c - postgres
\i :sqldir/19_testadores_rutas.sql
\i :sqldir/24_recoleccion_bicicleta.sql
\i :sqldir/25_sorteos_v2.sql
\i :sqldir/26_ronda3_inicio.sql
BEGIN;
INSERT INTO public.users (id, email, name, role, city_code) VALUES
  ('26000000-0000-0000-0000-000000000001', 't26a@buky.test', 'JESÚS EDDGAR Balvin', 'USUARIO', 3302700),
  ('26000000-0000-0000-0000-000000000002', 't26b@buky.test', 'ana', 'USUARIO', 3302700),
  ('26000000-0000-0000-0000-000000000003', 't26c@buky.test', NULL, 'USUARIO', 3302700),
  ('26000000-0000-0000-0000-000000000004', 't26d@buky.test', 'Pedro Rio', 'USUARIO', 3304557)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.buky_routes (id, name, city_code, kind, length_m)
VALUES ('26000000-0000-0000-0000-0000000000f1', 'Teste 26', 3303302, 'official', 5000) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.buky_points (id, route_id, seq, label, lat, lon)
SELECT ('26000000-0000-0000-0000-0000000000' || lpad(to_hex(i), 2, '0'))::uuid, '26000000-0000-0000-0000-0000000000f1', i, 'P' || i,
       -22.90 - i * 0.003, -43.11
FROM generate_series(160, 175) i ON CONFLICT (id) DO NOTHING;
INSERT INTO public.campaigns (id, name, prize, city, status) VALUES ('26000000-0000-0000-0000-0000000000c1', ' 3BUK PATROCINA ', 'Inscrição', 'Niterói', 'Concluído');
INSERT INTO public.participations (user_id, campaign_id, status, photo_url) VALUES
  ('26000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-0000000000c1', 'Ganhador', '{"media":["https://x/a.jpg","https://x/b.mp4"]}'),
  ('26000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-0000000000c1', 'Qualificado', 'https://x/c.jpg');
COMMIT;

-- Configuración: bloqueo desde el primer corte, una sola vez
DO $$
BEGIN
  IF (SELECT value::text FROM public.app_settings WHERE key = 'buky_bike_stops_to_block') <> '1' THEN RAISE EXCEPTION 'bloqueo debe ser 1'; END IF;
  UPDATE public.app_settings SET value = '2' WHERE key = 'buky_bike_stops_to_block';
END $$;
\i :sqldir/26_ronda3_inicio.sql
DO $$
BEGIN
  IF (SELECT value::text FROM public.app_settings WHERE key = 'buky_bike_stops_to_block') <> '2' THEN RAISE EXCEPTION 're-ejecutar no debe pisar el cambio del admin'; END IF;
  UPDATE public.app_settings SET value = '1' WHERE key = 'buky_bike_stops_to_block';
END $$;

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
  -- La web no inicia entrenamientos
  BEGIN
    PERFORM public.buky_start_session('26000000-0000-0000-0000-000000000051', '26000000-0000-0000-0000-0000000000f1', '{"platform":"web"}');
    RAISE EXCEPTION 'la web no debía iniciar';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'app_required' THEN RAISE; END IF; END;
  PERFORM public.buky_start_session('26000000-0000-0000-0000-000000000051', '26000000-0000-0000-0000-0000000000f1', '{"platform":"native"}');
END $$;
COMMIT;

\c - postgres
-- 16 puntos distintos en el mismo día: solo 12 dan Buky
DO $$
DECLARE r jsonb; v_passes jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('point_id', id, 'passed_at', '2026-11-09T13:00:00Z'::timestamptz + (seq - 160) * interval '1 minute', 'valid', true))
    INTO v_passes FROM public.buky_points WHERE route_id = '26000000-0000-0000-0000-0000000000f1';
  r := public.buky_finalize_session('26000000-0000-0000-0000-000000000051', '26000000-0000-0000-0000-000000000001', 'valid', NULL,
        '{"stop_reason":"bike","bike_warnings":3}', v_passes);
  IF (r ->> 'bukys')::int <> 12 THEN RAISE EXCEPTION 'esperaba 12, %', r; END IF;
  IF (SELECT count(*) FROM public.buky_passes WHERE session_id = '26000000-0000-0000-0000-000000000051' AND reject_reason = 'daily_total_cap') <> 4 THEN
    RAISE EXCEPTION 'faltan rechazos por tope diario';
  END IF;
  -- Un solo corte por bicicleta hoy ya bloquea
  UPDATE public.buky_sessions SET started_at = now() WHERE id = '26000000-0000-0000-0000-000000000051';
  PERFORM public.apply_buky_movement('26000000-0000-0000-0000-000000000002', 'found', 30);
  PERFORM public.apply_buky_movement('26000000-0000-0000-0000-000000000003', 'found', 5);
  PERFORM public.apply_buky_movement('26000000-0000-0000-0000-000000000004', 'found', 99);
  -- Los regalados no cuentan para el ranking
  PERFORM public.apply_buky_movement('26000000-0000-0000-0000-000000000003', 'gift', 500);
END $$;

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb; w record;
BEGIN
  IF NOT (public.buky_my_status() ->> 'blocked_today')::boolean THEN RAISE EXCEPTION 'debía quedar bloqueado con 1 corte'; END IF;
  r := public.buky_city_ranking();
  IF r ->> 'city' <> 'Maricá' THEN RAISE EXCEPTION 'ciudad %', r; END IF;
  IF jsonb_array_length(r -> 'top') <> 3 THEN RAISE EXCEPTION 'top 3 %', r; END IF;
  IF r -> 'top' -> 0 ->> 'name' <> 'Ana' OR (r -> 'top' -> 0 ->> 'bukys')::int <> 30 THEN RAISE EXCEPTION 'primero %', r -> 'top' -> 0; END IF;
  IF r -> 'top' -> 1 ->> 'name' <> 'Jesús E.' OR NOT (r -> 'top' -> 1 ->> 'me')::boolean THEN RAISE EXCEPTION 'segundo %', r -> 'top' -> 1; END IF;
  IF r -> 'top' -> 2 ->> 'name' <> 'Atleta' OR (r -> 'top' -> 2 ->> 'bukys')::int <> 5 THEN RAISE EXCEPTION 'tercero (regalados no cuentan) %', r -> 'top' -> 2; END IF;
  IF (r -> 'me' ->> 'pos')::int <> 2 THEN RAISE EXCEPTION 'mi posición %', r -> 'me'; END IF;
  IF r::text LIKE '%Pedro%' OR r::text LIKE '%@%' THEN RAISE EXCEPTION 'datos de más en el ranking'; END IF;
  SELECT * INTO w FROM public.buky_sponsorship_winners() LIMIT 1;
  IF w.name <> 'Ana' OR w.campaign <> '3BUK PATROCINA' OR jsonb_array_length(w.media) <> 2 THEN RAISE EXCEPTION 'ganador %', row_to_json(w); END IF;
  IF (SELECT count(*) FROM public.buky_sponsorship_winners()) <> 1 THEN RAISE EXCEPTION 'solo ganadores'; END IF;
END $$;
COMMIT;
