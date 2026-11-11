-- Contratos de la entrega F; los cambios de prueba se revierten.
\c - postgres
\i :sqldir/31_limites_ranking_fotos.sql
\i :sqldir/31_limites_ranking_fotos.sql
DO $$ BEGIN
 IF NOT public.buky_valid_cpf('529.982.247-25') OR public.buky_valid_cpf('111.111.111-11') OR public.buky_valid_cpf('52998224724') THEN
   RAISE EXCEPTION 'validacion CPF incorrecta';
 END IF;
 IF NOT public.buky_nickname_valid('BukyRunner_10') OR public.buky_nickname_valid('con espacio') THEN
   RAISE EXCEPTION 'validacion nickname incorrecta';
 END IF;
END $$;
BEGIN;
INSERT INTO public.users(id, email, name, role, plan, city_code) VALUES
 ('31000000-0000-0000-0000-000000000001', 'f31@buky.test', 'Teste F', 'USUARIO', 'Freemium', 3302700);
INSERT INTO public.event_photos(id, status) VALUES ('31000000-0000-0000-0000-000000000002', 'published');
INSERT INTO public.buky_routes(id, name, city_code, kind, length_m) VALUES
 ('31000000-0000-0000-0000-000000000003', 'Rota F', 3302700, 'official', 5000);
COMMIT;
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
DO $$ DECLARE r jsonb; i integer; BEGIN
 r := public.check_and_register_download('31000000-0000-0000-0000-000000000002');
 IF r->>'reason' <> 'not_recognized' THEN RAISE EXCEPTION 'match requerido: %', r; END IF;
 FOR i IN 1..3 LOOP
   PERFORM public.buky_start_session(('31000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid,
     '31000000-0000-0000-0000-000000000003', '{"platform":"native"}');
 END LOOP;
 PERFORM public.buky_start_session('31000000-0000-0000-0000-000000000101', '31000000-0000-0000-0000-000000000003', '{"platform":"native"}');
 BEGIN
   PERFORM public.buky_start_session('31000000-0000-0000-0000-000000000104', '31000000-0000-0000-0000-000000000003', '{"platform":"native"}');
   RAISE EXCEPTION 'limite no aplicado';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'daily_sessions_limit' THEN RAISE; END IF; END;
 r := public.buky_my_status();
 IF (r->>'sessions_today')::int <> 3 OR (r->>'sessions_max')::int <> 3 OR (r->>'bukys_max')::int <> 12 THEN RAISE EXCEPTION 'estado: %', r; END IF;
 IF public.buky_national_ranking()->>'period' <> to_char(now() AT TIME ZONE public.buky_tz(), 'YYYY-MM') THEN RAISE EXCEPTION 'periodo incorrecto'; END IF;
END $$;
COMMIT;
\c - postgres
-- Transición (photo_require_face_match = 0): sin coincidencia guardada, la inscripción sigue sirviendo.
INSERT INTO public.participations(id, user_id, status) VALUES
 ('31000000-0000-0000-0000-0000000000a1', '31000000-0000-0000-0000-000000000001', 'Ganhador');
DO $$ DECLARE r jsonb; BEGIN
  PERFORM set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
  r := public.check_and_register_download('31000000-0000-0000-0000-000000000002');
  IF r->>'reason' <> 'cpf_required' THEN RAISE EXCEPTION 'inscripción debe valer en transición: %', r; END IF;
  UPDATE public.app_settings SET value = '1' WHERE key = 'photo_require_face_match';
  r := public.check_and_register_download('31000000-0000-0000-0000-000000000002');
  IF r->>'reason' <> 'not_recognized' THEN RAISE EXCEPTION 'con 1 se exige coincidencia: %', r; END IF;
  UPDATE public.app_settings SET value = '0' WHERE key = 'photo_require_face_match';
END $$;
DELETE FROM public.participations WHERE id = '31000000-0000-0000-0000-0000000000a1';
INSERT INTO public.photo_face_matches(user_id, photo_id, similarity) VALUES
 ('31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', 0.9);
SELECT public.apply_buky_movement('31000000-0000-0000-0000-000000000001', 'found', 300);
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
DO $$ DECLARE r jsonb; BEGIN
 r := public.check_and_register_download('31000000-0000-0000-0000-000000000002');
 IF r->>'reason' <> 'cpf_required' THEN RAISE EXCEPTION 'CPF requerido: %', r; END IF;
 PERFORM public.set_my_cpf('529.982.247-25');
 IF public.get_my_cpf_masked() <> '***.***.*47-25' THEN RAISE EXCEPTION 'mascara incorrecta'; END IF;
 r := public.check_and_register_download('31000000-0000-0000-0000-000000000002');
 IF NOT (r->>'allowed')::boolean THEN RAISE EXCEPTION 'descarga sin inscripcion: %', r; END IF;
END $$;
COMMIT;
\c - postgres
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.photo_downloads WHERE user_id = '31000000-0000-0000-0000-000000000001'
    AND event_photo_id = '31000000-0000-0000-0000-000000000002' AND cpf = '52998224725') THEN
   RAISE EXCEPTION 'falta snapshot CPF';
 END IF;
END $$;

-- Premium tiene dos entrenamientos y hasta 21 Bukys, independientemente de regalos.
INSERT INTO public.users(id, email, name, role, plan, premium_until, city_code) VALUES
 ('31000000-0000-0000-0000-000000000004', 'p31@buky.test', 'Premium F', 'USUARIO', 'Premium', now() + interval '1 year', 3302700);
INSERT INTO public.buky_points(id, route_id, seq, label, lat, lon)
SELECT ('31000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid,
 '31000000-0000-0000-0000-000000000003', i, 'P' || i, -22.9, -43.1
FROM generate_series(1, 22) i;
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000004', true);
DO $$ DECLARE r jsonb; BEGIN
 PERFORM public.buky_start_session('31000000-0000-0000-0000-000000000105', '31000000-0000-0000-0000-000000000003', '{"platform":"native"}');
 PERFORM public.buky_start_session('31000000-0000-0000-0000-000000000106', '31000000-0000-0000-0000-000000000003', '{"platform":"native"}');
 BEGIN
   PERFORM public.buky_start_session('31000000-0000-0000-0000-000000000107', '31000000-0000-0000-0000-000000000003', '{"platform":"native"}');
   RAISE EXCEPTION 'limite premium no aplicado';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'daily_sessions_limit' THEN RAISE; END IF; END;
 r := public.buky_my_status();
 IF r->>'plan' <> 'premium' OR (r->>'sessions_max')::int <> 2 OR (r->>'bukys_max')::int <> 21 THEN RAISE EXCEPTION 'estado premium: %', r; END IF;
END $$;
COMMIT;
\c - postgres
DO $$ DECLARE r jsonb; passes jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('point_id', id, 'passed_at', now(), 'valid', true)) INTO passes
 FROM public.buky_points WHERE route_id = '31000000-0000-0000-0000-000000000003';
 r := public.buky_finalize_session('31000000-0000-0000-0000-000000000106', '31000000-0000-0000-0000-000000000004', 'valid', NULL, '{}', passes);
 IF (r->>'bukys')::int <> 21 THEN RAISE EXCEPTION 'tope premium: %', r; END IF;
 PERFORM public.apply_buky_movement('31000000-0000-0000-0000-000000000001', 'gift', 500);
END $$;
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000004', true);
DO $$ DECLARE r jsonb; BEGIN
 r := public.buky_national_ranking();
 IF (r->'me'->>'bukys')::int <> 21 THEN RAISE EXCEPTION 'ranking mensual: %', r; END IF;
 r := public.buky_city_ranking();
 IF (r->'me'->>'bukys')::int <> 21 THEN RAISE EXCEPTION 'ranking ciudad: %', r; END IF;
END $$;
ROLLBACK;
