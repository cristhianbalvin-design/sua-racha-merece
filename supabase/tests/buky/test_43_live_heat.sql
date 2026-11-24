\c - postgres
\i :sqldir/43_live_heat.sql
\i :sqldir/43_live_heat.sql
BEGIN;
INSERT INTO public.users(id,email,name,role) VALUES
 ('43000000-0000-0000-0000-000000000001','admin43@test','Admin','ADMIN'),
 ('43000000-0000-0000-0000-000000000002','athlete43@test','Athlete','USUARIO'),
 ('43000000-0000-0000-0000-000000000003','athlete43b@test','Athlete B','USUARIO');
SELECT set_config('request.jwt.claim.sub','43000000-0000-0000-0000-000000000001',true);
-- The test database may contain earlier test fixtures: isolate the zero case.
DELETE FROM public.buky_sessions;
DO $$ BEGIN
 IF (public.admin_buky_live()->'now'->>'total')::int <> 0 THEN RAISE EXCEPTION 'live zero'; END IF;
END $$;
INSERT INTO public.buky_sessions(id,user_id,mode,status,start_city_code,started_at,last_seen_at) VALUES
 ('43000000-0000-0000-0000-000000000101','43000000-0000-0000-0000-000000000002','free','valid',3302700,now(),now()),
 ('43000000-0000-0000-0000-000000000102','43000000-0000-0000-0000-000000000003','free','valid',3302700,now(),now()),
 ('43000000-0000-0000-0000-000000000103','43000000-0000-0000-0000-000000000002','free','running',3302700,now(),now()),
 ('43000000-0000-0000-0000-000000000104','43000000-0000-0000-0000-000000000003','free','running',3302700,now(),now()-interval '3 minutes');
DO $$ DECLARE payload jsonb := '{"session_id":"43000000-0000-0000-0000-000000000101","cells":[{"x":-1,"y":-2,"hits":4}]}'::jsonb; BEGIN
 IF NOT public.buky_heat_add(3302700,payload) OR public.buky_heat_add(3302700,payload) THEN RAISE EXCEPTION 'idempotence'; END IF;
 IF (SELECT hits FROM public.buky_heat_cells WHERE city_code=3302700 AND cell_x=-1 AND cell_y=-2) <> 4 THEN RAISE EXCEPTION 'duplicate counted'; END IF;
 IF jsonb_array_length(public.admin_buky_heat(3302700,NULL)->'cells') <> 0 THEN RAISE EXCEPTION 'privacy'; END IF;
 IF (public.admin_buky_live()->'now'->>'total')::int <> 1 THEN RAISE EXCEPTION 'live recent'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','43000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.admin_buky_live(); RAISE EXCEPTION 'non-admin live'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_buky_heat(3302700,NULL); RAISE EXCEPTION 'non-admin heat'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.buky_heat_cells; RAISE EXCEPTION 'non-admin read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_buky_heat_add(3302700,'{}'); RAISE EXCEPTION 'non-admin rpc write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.buky_heat_add(3302700,'{}'); RAISE EXCEPTION 'non-admin write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
