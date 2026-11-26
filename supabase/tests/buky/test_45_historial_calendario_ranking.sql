\c - postgres
\i :sqldir/45_historial_calendario_ranking.sql
\i :sqldir/45_historial_calendario_ranking.sql

BEGIN;
INSERT INTO public.users(id,email,name,nickname,role,city_code) VALUES
 ('45000000-0000-0000-0000-000000000001','a45@test','Ana Teste','ana45','USUARIO',1100015),
 ('45000000-0000-0000-0000-000000000002','b45@test','Bia Teste','bia45','USUARIO',1100015),
 ('45000000-0000-0000-0000-000000000003','c45@test','Caio Teste','caio45','USUARIO',1100015);
INSERT INTO public.buky_routes(id,name,city_code,kind) VALUES
 ('45000000-0000-0000-0000-000000000010','Rota 45',1100015,'official');
INSERT INTO public.buky_points(id,route_id,seq,lat,lon) VALUES
 ('45000000-0000-0000-0000-000000000011','45000000-0000-0000-0000-000000000010',1,-22.9,-43.1),
 ('45000000-0000-0000-0000-000000000012','45000000-0000-0000-0000-000000000010',2,-22.9,-43.1);
INSERT INTO public.buky_sessions(id,user_id,route_id,status) VALUES
 ('45000000-0000-0000-0000-000000000021','45000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000010','valid'),
 ('45000000-0000-0000-0000-000000000022','45000000-0000-0000-0000-000000000002','45000000-0000-0000-0000-000000000010','valid'),
 ('45000000-0000-0000-0000-000000000023','45000000-0000-0000-0000-000000000003','45000000-0000-0000-0000-000000000010','valid');
INSERT INTO public.buky_passes(session_id,user_id,route_id,route_kind,point_id,passed_at,local_day,valid,awarded) VALUES
 ('45000000-0000-0000-0000-000000000021','45000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000010','official','45000000-0000-0000-0000-000000000011',now(),(now() AT TIME ZONE public.buky_tz())::date,true,true),
 ('45000000-0000-0000-0000-000000000022','45000000-0000-0000-0000-000000000002','45000000-0000-0000-0000-000000000010','official','45000000-0000-0000-0000-000000000011',now(),(now() AT TIME ZONE public.buky_tz())::date,true,true),
 ('45000000-0000-0000-0000-000000000023','45000000-0000-0000-0000-000000000003','45000000-0000-0000-0000-000000000010','official','45000000-0000-0000-0000-000000000011',now(),(now() AT TIME ZONE public.buky_tz())::date,true,true),
 ('45000000-0000-0000-0000-000000000023','45000000-0000-0000-0000-000000000003','45000000-0000-0000-0000-000000000010','official','45000000-0000-0000-0000-000000000012',now(),(now() AT TIME ZONE public.buky_tz())::date,true,true),
 ('45000000-0000-0000-0000-000000000021','45000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000010','official','45000000-0000-0000-0000-000000000012',now()-interval '1 month',(now() AT TIME ZONE public.buky_tz())::date-interval '1 month',true,true);
INSERT INTO public.buky_raffle_periods(id,name,starts_at,ends_at,draw_at,status,city_codes) VALUES
 ('45000000-0000-0000-0000-000000000031','Atual 45',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','drawn','{1100015}'),
 ('45000000-0000-0000-0000-000000000032','Anterior 45',now()-interval '35 days',now()-interval '34 days',now()-interval '33 days','drawn','{1100015}'),
 ('45000000-0000-0000-0000-000000000033','Outra cidade 45',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','drawn','{3304557}');
INSERT INTO public.buky_entries(period_id,user_id,amount,city_code,state_code,ticket_code,created_at) VALUES
 ('45000000-0000-0000-0000-000000000031','45000000-0000-0000-0000-000000000001',1,1100015,(SELECT state_code FROM public.br_cities WHERE code=1100015),'T45-A',now()-interval '4 days'),
 ('45000000-0000-0000-0000-000000000031','45000000-0000-0000-0000-000000000002',1,1100015,(SELECT state_code FROM public.br_cities WHERE code=1100015),'T45-B',now()-interval '4 days');

DO $$ DECLARE j jsonb; m text; d date; BEGIN
  IF has_function_privilege('anon','public.buky_ranking_page(text,integer,text,integer,integer)','EXECUTE')
    OR has_function_privilege('anon','public.buky_raffle_calendar(date,date)','EXECUTE')
    OR has_function_privilege('anon','public.buky_my_raffle_history(text,integer,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute block 45 functions'; END IF;
  PERFORM set_config('request.jwt.claim.sub','45000000-0000-0000-0000-000000000001',true);
  m := to_char(now() AT TIME ZONE public.buky_tz(),'YYYY-MM');
  d := (now() AT TIME ZONE public.buky_tz())::date;
  j := public.buky_ranking_page('city',NULL,NULL,1,0);
  IF (j->>'total')::int <> 3 OR (j->'items'->0->>'pos')::int <> 1
    OR (j->'me'->>'pos')::int <> 2 OR j->'items'->0->>'me' <> 'false' THEN
    RAISE EXCEPTION 'ranking page and position: %',j; END IF;
  IF j::text ~* 'a45@test|b45@test|Ana Teste|Bia Teste|phone' THEN
    RAISE EXCEPTION 'ranking personal data leaked: %',j; END IF;
  IF NOT (j->'months' @> to_jsonb(ARRAY[m])) THEN
    RAISE EXCEPTION 'ranking month missing: %',j; END IF;
  j := public.buky_ranking_page('city',NULL,NULL,1,1);
  IF (j->'items'->0->>'pos')::int <> 2 OR (j->'items'->0->>'bukys')::int <> 1 THEN
    RAISE EXCEPTION 'ranking tie: %',j; END IF;
  j := public.buky_ranking_page('national',NULL,NULL,25,0);
  IF (j->>'total')::int < 3 OR (j->'me'->>'pos')::int < 1 THEN
    RAISE EXCEPTION 'national ranking: %',j; END IF;
  j := public.buky_ranking_page('city',NULL,to_char(d-interval '1 month','YYYY-MM'),25,0);
  IF (j->>'total')::int <> 1 OR (j->'me'->>'bukys')::int <> 1 THEN RAISE EXCEPTION 'previous month: %',j; END IF;
  BEGIN PERFORM public.buky_ranking_page('other'); RAISE EXCEPTION 'invalid scope accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'invalid scope accepted' THEN RAISE; END IF; END;
  j := public.buky_my_raffle_history(NULL,1,0);
  IF (j->>'total')::int < 1 OR jsonb_array_length(j->'months') < 2 THEN
    RAISE EXCEPTION 'default history: %',j; END IF;
  j := public.buky_my_raffle_history(m,50,0);
  IF NOT (j->'items' @> '[{"id":"45000000-0000-0000-0000-000000000031"}]'::jsonb) THEN
    RAISE EXCEPTION 'month history misses period: %',j; END IF;
  j := public.buky_my_raffle_history(m,1,1);
  IF j->'items' @> '[{"id":"45000000-0000-0000-0000-000000000033"}]'::jsonb THEN
    RAISE EXCEPTION 'foreign city visible: %',j; END IF;
  j := public.buky_my_raffle_history('2020-01',12,0);
  IF (j->>'total')::int <> 0 THEN RAISE EXCEPTION 'empty month: %',j; END IF;
  j := public.buky_my_raffle_history(m,1,100);
  IF jsonb_array_length(j->'items') <> 0 THEN RAISE EXCEPTION 'history offset ignored: %',j; END IF;
  j := public.buky_raffle_calendar(d-2,d);
  IF jsonb_array_length(j) < 1 OR (j->0->>'my_tickets')::int < 1 THEN
    RAISE EXCEPTION 'calendar own tickets: %',j; END IF;
  IF j @> '[{"id":"45000000-0000-0000-0000-000000000033"}]'::jsonb THEN
    RAISE EXCEPTION 'foreign city in calendar: %',j; END IF;
  BEGIN PERFORM public.buky_raffle_calendar(d-92,d); RAISE EXCEPTION 'long range accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'long range accepted' THEN RAISE; END IF; END;
  IF j::text ~* 'a45@test|b45@test|Ana Teste|Bia Teste|phone' THEN
    RAISE EXCEPTION 'personal data leaked: %',j; END IF;
END $$;
ROLLBACK;
