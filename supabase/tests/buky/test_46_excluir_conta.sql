\c - postgres
\i :sqldir/46_excluir_conta.sql
\i :sqldir/46_excluir_conta.sql
BEGIN;
-- IDs reservados para este teste; a transação é revertida ao final.
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES
 ('46000000-0000-0000-0000-000000000001','atleta46@test.invalid','{"accepted_terms":true}'::jsonb,'{"provider":"email"}'::jsonb),
 ('46000000-0000-0000-0000-000000000002','admin46@test.invalid','{"accepted_terms":true}'::jsonb,'{"provider":"email"}'::jsonb),
 ('46000000-0000-0000-0000-000000000003','sponsor46@test.invalid','{"accepted_terms":true}'::jsonb,'{"provider":"email"}'::jsonb),
 ('46000000-0000-0000-0000-000000000004','order46@test.invalid','{"accepted_terms":true}'::jsonb,'{"provider":"email"}'::jsonb);
INSERT INTO public.users(id,email,name,role) VALUES
 ('46000000-0000-0000-0000-000000000001','atleta46@test.invalid','Atleta','USUARIO'),
 ('46000000-0000-0000-0000-000000000002','admin46@test.invalid','Admin','ADMIN'),
 ('46000000-0000-0000-0000-000000000003','sponsor46@test.invalid','Sponsor','USUARIO'),
 ('46000000-0000-0000-0000-000000000004','order46@test.invalid','Pedido','USUARIO')
 ON CONFLICT (id) DO UPDATE SET role=excluded.role;
INSERT INTO public.buky_sponsors(id,name) VALUES ('46000000-0000-0000-0000-000000000010','Teste 46');
INSERT INTO public.buky_sponsor_members(sponsor_id,user_id,role) VALUES ('46000000-0000-0000-0000-000000000010','46000000-0000-0000-0000-000000000003','staff');
INSERT INTO public.shop_orders(id,user_id,status,items_cents,shipping_cents,total_cents,shipping_service,shipping_quote,address,reserved_until) VALUES
 ('46000000-0000-0000-0000-000000000011','46000000-0000-0000-0000-000000000004','pending_payment',100,0,100,'teste','{}','{}',now());
INSERT INTO public.buky_routes(id,name,city_code,kind) VALUES ('46000000-0000-0000-0000-000000000040','Rota 46',1100015,'official');
INSERT INTO public.buky_points(id,route_id,seq,lat,lon) VALUES ('46000000-0000-0000-0000-000000000041','46000000-0000-0000-0000-000000000040',1,-22.9,-43.1);
INSERT INTO public.buky_sessions(id,user_id,status,mode,route_id) VALUES ('46000000-0000-0000-0000-000000000020','46000000-0000-0000-0000-000000000001','valid','route','46000000-0000-0000-0000-000000000040');
INSERT INTO public.buky_passes(id,session_id,user_id,route_id,route_kind,point_id,passed_at,local_day,valid,awarded) VALUES ('46000000-0000-0000-0000-000000000042','46000000-0000-0000-0000-000000000020','46000000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000040','official','46000000-0000-0000-0000-000000000041',now(),current_date,true,true);
INSERT INTO public.buky_ledger(user_id,kind,amount,balance_after) VALUES ('46000000-0000-0000-0000-000000000001','found',1,1);
INSERT INTO public.notifications(id,user_id,type,title,message) VALUES ('46000000-0000-0000-0000-000000000021','46000000-0000-0000-0000-000000000001','test','Teste','Teste');
INSERT INTO public.notification_outbox(user_id,kind,channel,dedupe_key) VALUES ('46000000-0000-0000-0000-000000000001','test','email','test-46');
INSERT INTO public.buky_raffle_periods(id,name,starts_at,ends_at,draw_at,status) VALUES ('46000000-0000-0000-0000-000000000030','Teste 46',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','scheduled');
INSERT INTO public.buky_coupons(id,period_id,sponsor_id,title,kind,scope) VALUES ('46000000-0000-0000-0000-000000000031','46000000-0000-0000-0000-000000000030','46000000-0000-0000-0000-000000000010','Teste','digital','national');
UPDATE public.buky_raffle_periods SET status='drawn' WHERE id='46000000-0000-0000-0000-000000000030';
INSERT INTO public.buky_raffle_results(id,period_id,coupon_id,rank,user_id,redeemed_by,total_weight,candidates,candidates_sha256) VALUES ('46000000-0000-0000-0000-000000000032','46000000-0000-0000-0000-000000000030','46000000-0000-0000-0000-000000000031',1,'46000000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000001',1,'[]','test');
DO $$ DECLARE v text; BEGIN
 IF has_function_privilege('authenticated','public.buky_prepare_account_deletion(uuid)','EXECUTE') OR has_function_privilege('anon','public.buky_prepare_account_deletion(uuid)','EXECUTE') THEN RAISE EXCEPTION 'permissão indevida'; END IF;
 FOR v IN SELECT unnest(ARRAY['002:blocked_admin','003:blocked_sponsor_member','004:blocked_open_order']) LOOP
   BEGIN PERFORM public.buky_prepare_account_deletion(('46000000-0000-0000-0000-000000000'||split_part(v,':',1))::uuid); RAISE EXCEPTION 'bloqueio ausente';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM <> split_part(v,':',2) THEN RAISE; END IF; END;
 END LOOP;
 IF public.buky_prepare_account_deletion('46000000-0000-0000-0000-000000000001') <> '{"ok":true}'::jsonb THEN RAISE EXCEPTION 'resultado incorreto'; END IF;
END $$;
DELETE FROM auth.users WHERE id='46000000-0000-0000-0000-000000000001';
-- O stub de public.users não tem FK para auth.users (em produção é CASCADE).
DELETE FROM public.users WHERE id='46000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.users WHERE id='46000000-0000-0000-0000-000000000001') OR EXISTS(SELECT 1 FROM public.buky_sessions WHERE id='46000000-0000-0000-0000-000000000020') OR EXISTS(SELECT 1 FROM public.notification_outbox WHERE dedupe_key='test-46') THEN RAISE EXCEPTION 'dependências não removidas'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buky_raffle_results WHERE id='46000000-0000-0000-0000-000000000032' AND user_id IS NULL AND redeemed_by IS NULL) THEN RAISE EXCEPTION 'resultado perdido ou vinculado'; END IF;
END $$;
ROLLBACK;
