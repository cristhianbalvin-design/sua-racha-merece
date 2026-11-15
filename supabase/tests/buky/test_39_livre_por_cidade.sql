-- Contratos del permiso por ciudad y re-ejecución de la migración.
\c - postgres
\i :sqldir/39_livre_por_cidade.sql
\i :sqldir/39_livre_por_cidade.sql
BEGIN;
UPDATE public.br_cities SET buky_free_enabled = false WHERE code = 3302700;
INSERT INTO public.users(id, email, name, role, plan, city_code) VALUES
 ('39000000-0000-0000-0000-000000000001', 'free39@buky.test', 'Livre 39', 'USUARIO', 'Freemium', 3302700),
 ('39000000-0000-0000-0000-000000000002', 'tester39@buky.test', 'Tester 39', 'USUARIO', 'Freemium', 3302700);
INSERT INTO public.buky_routes(id, name, city_code, kind, length_m) VALUES
 ('39000000-0000-0000-0000-000000000003', 'Rota 39', 3302700, 'official', 5000);
SELECT set_config('request.jwt.claim.sub', '39000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
 IF (public.buky_my_status()->>'free_enabled')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'status deshabilitado'; END IF;
 BEGIN
  PERFORM public.buky_start_session('39000000-0000-0000-0000-000000000101', NULL, '{"platform":"native"}', 'free');
  RAISE EXCEPTION 'inicio libre aceptado';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'free_not_enabled' THEN RAISE; END IF; END;
 PERFORM public.buky_start_session('39000000-0000-0000-0000-000000000102', '39000000-0000-0000-0000-000000000003', '{"platform":"native"}', 'route');
END $$;
UPDATE public.br_cities SET buky_free_enabled = true WHERE code = 3302700;
DO $$ BEGIN
 IF (public.buky_my_status()->>'free_enabled')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'status habilitado'; END IF;
 PERFORM public.buky_start_session('39000000-0000-0000-0000-000000000103', NULL, '{"platform":"native"}', 'free');
END $$;
UPDATE public.br_cities SET buky_free_enabled = false WHERE code = 3302700;
INSERT INTO public.buky_route_testers(user_id) VALUES ('39000000-0000-0000-0000-000000000002');
SELECT set_config('request.jwt.claim.sub', '39000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
 IF (public.buky_my_status()->>'free_enabled')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'status tester'; END IF;
 PERFORM public.buky_start_session('39000000-0000-0000-0000-000000000104', NULL, '{}', 'free');
END $$;
ROLLBACK;
