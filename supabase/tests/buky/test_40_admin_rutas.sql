-- Ejecutar contra una base de pruebas con los pasos anteriores aplicados.
\c - postgres
\i :sqldir/40_admin_rutas.sql
\i :sqldir/40_admin_rutas.sql
BEGIN;
INSERT INTO public.users(id, email, name, role, plan, city_code) VALUES
 ('40000000-0000-0000-0000-000000000001', 'admin40@buky.test', 'Admin 40', 'ADMIN', 'Freemium', 3302700),
 ('40000000-0000-0000-0000-000000000002', 'user40@buky.test', 'User 40', 'USUARIO', 'Freemium', 3302700);
INSERT INTO public.buky_routes(id, name, city_code, kind) VALUES
 ('40000000-0000-0000-0000-000000000003', 'Rota sem sessões', 3302700, 'official'),
 ('40000000-0000-0000-0000-000000000004', 'Rota com sessões', 3302700, 'official');
INSERT INTO public.buky_points(route_id, seq, lat, lon) VALUES
 ('40000000-0000-0000-0000-000000000003', 0, -22.9, -43.1);
INSERT INTO public.buky_sessions(id, user_id, route_id) VALUES
 ('40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004');
INSERT INTO public.buky_raffle_periods(id, name, starts_at, ends_at, draw_at, cadence, status, min_participants) VALUES
 ('40000000-0000-0000-0000-000000000006', 'Sorteio 40', now() - interval '1 day', now() + interval '1 day', now() + interval '2 days', 'none', 'open', 30),
 ('40000000-0000-0000-0000-000000000007', 'Teste 40', now() - interval '1 day', now() + interval '1 day', now() + interval '2 days', 'none', 'open', 30);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_buky_delete_route('40000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'non-admin accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.admin_buky_list_entries('40000000-0000-0000-0000-000000000006');
    RAISE EXCEPTION 'non-admin entries accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.admin_buky_draw_now('40000000-0000-0000-0000-000000000006', false);
    RAISE EXCEPTION 'non-admin draw accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
  IF public.admin_buky_delete_route('40000000-0000-0000-0000-000000000003')->>'status' <> 'deleted' THEN RAISE EXCEPTION 'not deleted'; END IF;
  IF EXISTS (SELECT 1 FROM public.buky_points WHERE route_id = '40000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'points retained'; END IF;
  IF public.admin_buky_delete_route('40000000-0000-0000-0000-000000000004')->>'status' <> 'archived' THEN RAISE EXCEPTION 'not archived'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buky_routes WHERE id = '40000000-0000-0000-0000-000000000004' AND NOT active AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'archive missing'; END IF;
  IF public.admin_buky_draw_now('40000000-0000-0000-0000-000000000006', false)->>'status' <> 'review' THEN RAISE EXCEPTION 'minimum ignored'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE id = '40000000-0000-0000-0000-000000000006' AND status = 'closed' AND needs_review) THEN RAISE EXCEPTION 'review missing'; END IF;
  IF public.admin_buky_draw_now('40000000-0000-0000-0000-000000000007', true)->>'status' <> 'drawn' THEN RAISE EXCEPTION 'test not drawn'; END IF;
  IF (public.admin_buky_draw_now('40000000-0000-0000-0000-000000000007', true)->>'duplicate')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'duplicate draw'; END IF;
END $$;
ROLLBACK;
