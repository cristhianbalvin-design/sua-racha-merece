-- Contratos del paso 37 y re-ejecución de la migración.
\c - postgres
\i :sqldir/37_treino_livre.sql
\i :sqldir/37_treino_livre.sql
BEGIN;
INSERT INTO public.users(id, email, name, role, plan, city_code) VALUES
 ('37000000-0000-0000-0000-000000000001', 'free37@buky.test', 'Livre 37', 'USUARIO', 'Freemium', 3302700),
 ('37000000-0000-0000-0000-000000000002', 'cap37@buky.test', 'Cap 37', 'USUARIO', 'Freemium', 3302700);
INSERT INTO public.buky_routes(id, name, city_code, kind, length_m) VALUES
 ('37000000-0000-0000-0000-000000000003', 'Rota 37', 3302700, 'official', 5000);
UPDATE public.app_settings SET value = '1' WHERE key = 'buky_daily_sessions_freemium';
SELECT set_config('request.jwt.claim.sub', '37000000-0000-0000-0000-000000000001', true);
DO $$ DECLARE r jsonb; marks jsonb; BEGIN
 PERFORM public.buky_start_session('37000000-0000-0000-0000-000000000101', NULL, '{"platform":"native"}', 'free');
 BEGIN
  PERFORM public.buky_start_session('37000000-0000-0000-0000-000000000102', '37000000-0000-0000-0000-000000000003', '{"platform":"native"}', 'free');
  RAISE EXCEPTION 'inicio free con ruta aceptado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.buky_finalize_session('37000000-0000-0000-0000-000000000101', '37000000-0000-0000-0000-000000000001', 'valid', NULL, '{}', '[]');
 IF (public.buky_my_status()->>'sessions_today')::int <> 0 THEN RAISE EXCEPTION 'cero Bukys consumió cupo'; END IF;
 PERFORM public.buky_start_session('37000000-0000-0000-0000-000000000102', NULL, '{"platform":"native"}', 'free');
 -- Una sesión offline ya iniciada se cierra más tarde.
 INSERT INTO public.buky_sessions(id,user_id,mode,route_id,status) VALUES
 ('37000000-0000-0000-0000-000000000103','37000000-0000-0000-0000-000000000001','free',NULL,'abandoned');
 SELECT jsonb_agg(jsonb_build_object('km_mark', i * 1.5, 'passed_at', now(), 'valid', true)) INTO marks FROM generate_series(1,4) i;
 r := public.buky_finalize_session('37000000-0000-0000-0000-000000000102', '37000000-0000-0000-0000-000000000001', 'valid', NULL, '{"free_km_per_buky":1.5}', marks, NULL, 'abc');
 IF (r->>'bukys')::int <> 4 OR NOT EXISTS (SELECT 1 FROM public.buky_balances WHERE user_id='37000000-0000-0000-0000-000000000001' AND balance=4 AND found_total=4) THEN RAISE EXCEPTION 'marcas o saldo: %', r; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.buky_ledger WHERE user_id='37000000-0000-0000-0000-000000000001' AND kind='found') THEN RAISE EXCEPTION 'falta ledger'; END IF;
 IF (public.buky_my_status()->>'sessions_today')::int <> 1 THEN RAISE EXCEPTION 'sessions_today'; END IF;
 IF (public.buky_national_ranking()->'me'->>'bukys')::int <> 4 THEN RAISE EXCEPTION 'ranking libre'; END IF;
 BEGIN
  PERFORM public.buky_start_session('37000000-0000-0000-0000-000000000104', NULL, '{"platform":"native"}', 'free');
  RAISE EXCEPTION 'inicio excedió cupo';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'daily_sessions_limit' THEN RAISE; END IF; END;
 r := public.buky_finalize_session('37000000-0000-0000-0000-000000000103', '37000000-0000-0000-0000-000000000001', 'valid', NULL, '{}', marks);
 IF (r->>'bukys')::int <> 0 OR (SELECT count(*) FROM public.buky_passes WHERE session_id='37000000-0000-0000-0000-000000000103' AND reject_reason='daily_sessions_limit' AND NOT awarded) <> 4 THEN RAISE EXCEPTION 'cierre tardío: %', r; END IF;
END $$;
INSERT INTO public.buky_route_testers(user_id) VALUES ('37000000-0000-0000-0000-000000000002');
INSERT INTO public.buky_points(id, route_id, seq, label, lat, lon)
SELECT ('37000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid,
 '37000000-0000-0000-0000-000000000003', i, 'P' || i, -22.9, -43.1 FROM generate_series(1,9) i;
SELECT set_config('request.jwt.claim.sub', '37000000-0000-0000-0000-000000000002', true);
DO $$ DECLARE r jsonb; marks jsonb; BEGIN
 PERFORM public.buky_start_session('37000000-0000-0000-0000-000000000105', '37000000-0000-0000-0000-000000000003', '{"platform":"native"}', 'route');
 SELECT jsonb_agg(jsonb_build_object('point_id', id, 'passed_at', now(), 'valid', true)) INTO marks FROM public.buky_points WHERE route_id='37000000-0000-0000-0000-000000000003';
 r := public.buky_finalize_session('37000000-0000-0000-0000-000000000105', '37000000-0000-0000-0000-000000000002', 'valid', NULL, '{}', marks);
 IF (r->>'bukys')::int <> 9 THEN RAISE EXCEPTION 'pasadas de ruta: %', r; END IF;
 PERFORM public.buky_start_session('37000000-0000-0000-0000-000000000106', NULL, '{"platform":"native"}', 'free');
 SELECT jsonb_agg(jsonb_build_object('km_mark', i * 1.5, 'passed_at', now(), 'valid', true)) INTO marks FROM generate_series(1,4) i;
 r := public.buky_finalize_session('37000000-0000-0000-0000-000000000106', '37000000-0000-0000-0000-000000000002', 'valid', NULL, '{}', marks);
 IF (r->>'bukys')::int <> 3 OR NOT EXISTS (SELECT 1 FROM public.buky_passes WHERE session_id='37000000-0000-0000-0000-000000000106' AND reject_reason='daily_total_cap') THEN RAISE EXCEPTION 'tope mixto: %', r; END IF;
END $$;
ROLLBACK;
