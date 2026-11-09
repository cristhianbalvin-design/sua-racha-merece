-- Paso 28: aislamiento, canje y cola.
\c - postgres
\i :sqldir/28_patrocinadores_avisos.sql
BEGIN;
INSERT INTO public.users(id,name,email,role,email_notifications) VALUES
 ('28000000-0000-0000-0000-000000000001','Atleta Um','atleta28@example.test','USUARIO',false),
 ('28000000-0000-0000-0000-000000000002','Marca Um','marca28@example.test','USUARIO',true),
 ('28000000-0000-0000-0000-000000000003','Marca Dois','marca282@example.test','USUARIO',true),
 ('28000000-0000-0000-0000-000000000004','Atleta Dois','atleta282@example.test','USUARIO',true),
 ('28000000-0000-0000-0000-000000000005','Atleta Tres','atleta283@example.test','USUARIO',true);
INSERT INTO public.buky_sponsors(id,name) VALUES ('28000000-0000-0000-0000-000000000011','Marca A'),('28000000-0000-0000-0000-000000000012','Marca B');
INSERT INTO public.buky_sponsor_members(sponsor_id,user_id,role) VALUES ('28000000-0000-0000-0000-000000000011','28000000-0000-0000-0000-000000000002','owner'),('28000000-0000-0000-0000-000000000012','28000000-0000-0000-0000-000000000003','staff');
INSERT INTO public.buky_raffle_periods(id,name,starts_at,ends_at,draw_at) VALUES ('28000000-0000-0000-0000-000000000021','Teste',now(),now()+interval '1 day',now()+interval '2 days');
INSERT INTO public.buky_coupons(id,period_id,sponsor_id,title,kind,scope) VALUES ('28000000-0000-0000-0000-000000000031','28000000-0000-0000-0000-000000000021','28000000-0000-0000-0000-000000000011','Prêmio A','digital','raffle'),('28000000-0000-0000-0000-000000000032','28000000-0000-0000-0000-000000000021','28000000-0000-0000-0000-000000000011','Prêmio B','physical','raffle');
INSERT INTO public.buky_raffle_results(id,period_id,coupon_id,rank,user_id,redeem_code,total_weight,candidates,candidates_sha256,delivery_status,redeem_deadline) VALUES
 ('28000000-0000-0000-0000-000000000041','28000000-0000-0000-0000-000000000021','28000000-0000-0000-0000-000000000031',1,'28000000-0000-0000-0000-000000000001','TEST28',1,'[]','x','notified',now()+interval '1 day');
INSERT INTO public.buky_raffle_results(id,period_id,coupon_id,rank,user_id,redeem_code,total_weight,candidates,candidates_sha256,delivery_status,redeem_deadline) VALUES
 ('28000000-0000-0000-0000-000000000042','28000000-0000-0000-0000-000000000021','28000000-0000-0000-0000-000000000032',1,'28000000-0000-0000-0000-000000000004','CODE28',1,'[]','x','notified',now()+interval '1 day'),
 ('28000000-0000-0000-0000-000000000043','28000000-0000-0000-0000-000000000021','28000000-0000-0000-0000-000000000032',2,'28000000-0000-0000-0000-000000000005','OLD28',1,'[]','x','notified',now()-interval '1 day');
INSERT INTO public.notifications(id,user_id,type,title,message) VALUES ('28000000-0000-0000-0000-000000000051','28000000-0000-0000-0000-000000000001','buky_raffle_won','Ganhou','Premio');
DO $$ BEGIN IF (SELECT count(*) FROM public.notification_outbox WHERE notification_id='28000000-0000-0000-0000-000000000051')<>2 THEN RAISE EXCEPTION 'dedupe ou canais'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','28000000-0000-0000-0000-000000000003',true);
DO $$ BEGIN IF public.buky_sponsor_lookup('TEST28')->>'status'<>'not_found' THEN RAISE EXCEPTION 'aislamiento'; END IF; BEGIN PERFORM public.buky_sponsor_redeem('28000000-0000-0000-0000-000000000041','code'); RAISE EXCEPTION 'debió fallar'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_member' THEN RAISE; END IF; END; END $$;
SELECT set_config('request.jwt.claim.sub','28000000-0000-0000-0000-000000000002',true);
DO $$ DECLARE t text; BEGIN SELECT redeem_token INTO t FROM public.buky_raffle_results WHERE id='28000000-0000-0000-0000-000000000041'; IF length(t)<20 OR public.buky_sponsor_lookup(t)->>'status'<>'valid' OR public.buky_sponsor_lookup('TEST28')->>'status'<>'valid' THEN RAISE EXCEPTION 'lookup'; END IF; PERFORM public.buky_sponsor_redeem('28000000-0000-0000-0000-000000000041','qr'); IF public.buky_sponsor_lookup(t)->>'status'<>'redeemed' THEN RAISE EXCEPTION 'canje'; END IF; BEGIN PERFORM public.buky_sponsor_redeem('28000000-0000-0000-0000-000000000041','code'); RAISE EXCEPTION 'debió fallar'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'already_redeemed' THEN RAISE; END IF; END; END $$;
DO $$ BEGIN PERFORM public.buky_sponsor_redeem('28000000-0000-0000-0000-000000000042','code'); IF public.buky_sponsor_lookup('CODE28')->>'status'<>'redeemed' THEN RAISE EXCEPTION 'code'; END IF; IF public.buky_sponsor_lookup('OLD28')->>'status'<>'expired' THEN RAISE EXCEPTION 'expired lookup'; END IF; BEGIN PERFORM public.buky_sponsor_redeem('28000000-0000-0000-0000-000000000043','code'); RAISE EXCEPTION 'expected expired'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'expired' THEN RAISE; END IF; END; END $$;
INSERT INTO public.notifications(user_id,type,title,message) VALUES ('28000000-0000-0000-0000-000000000001','premium_expiring','Premium','Vence');
DO $$ DECLARE j jsonb; BEGIN IF (SELECT count(*) FROM public.notification_outbox WHERE kind='premium_expiring' AND user_id='28000000-0000-0000-0000-000000000001')<>1 THEN RAISE EXCEPTION 'outbox'; END IF; SELECT x INTO j FROM public.notify_outbox_claim(20) x WHERE x->>'kind'='premium_expiring' LIMIT 1; IF j IS NULL OR (j->>'email_notifications')::boolean THEN RAISE EXCEPTION 'claim'; END IF; PERFORM public.notify_outbox_mark((j->>'id')::bigint,'skipped',NULL,NULL); IF (SELECT status FROM public.notification_outbox WHERE id=(j->>'id')::bigint)<>'skipped' THEN RAISE EXCEPTION 'mark'; END IF; END $$;
ROLLBACK;
-- Dos premios del mismo atleta avisados en la misma pasada: cada aviso apunta a un resultado distinto
\c - postgres
BEGIN;
INSERT INTO public.users(id,name,email,role) VALUES ('28000000-0000-0000-0000-000000000006','Atleta Seis','atleta286@example.test','USUARIO');
INSERT INTO public.buky_sponsors(id,name) VALUES ('28000000-0000-0000-0000-000000000013','Marca C');
INSERT INTO public.buky_raffle_periods(id,name,starts_at,ends_at,draw_at) VALUES
 ('28000000-0000-0000-0000-000000000022','P1',now(),now()+interval '1 day',now()+interval '2 days'),
 ('28000000-0000-0000-0000-000000000023','P2',now(),now()+interval '1 day',now()+interval '2 days');
INSERT INTO public.buky_coupons(id,period_id,sponsor_id,title,kind,scope) VALUES
 ('28000000-0000-0000-0000-000000000033','28000000-0000-0000-0000-000000000022','28000000-0000-0000-0000-000000000013','Prêmio P1','digital','raffle'),
 ('28000000-0000-0000-0000-000000000034','28000000-0000-0000-0000-000000000023','28000000-0000-0000-0000-000000000013','Prêmio P2','digital','raffle');
INSERT INTO public.buky_raffle_results(id,period_id,coupon_id,rank,user_id,redeem_code,total_weight,candidates,candidates_sha256,delivery_status,redeem_deadline) VALUES
 ('28000000-0000-0000-0000-000000000044','28000000-0000-0000-0000-000000000022','28000000-0000-0000-0000-000000000033',1,'28000000-0000-0000-0000-000000000006','P1X',1,'[]','x','notified',now()+interval '1 day'),
 ('28000000-0000-0000-0000-000000000045','28000000-0000-0000-0000-000000000023','28000000-0000-0000-0000-000000000034',1,'28000000-0000-0000-0000-000000000006','P2X',1,'[]','x','notified',now()+interval '1 day');
INSERT INTO public.notifications(user_id,type,title,message) VALUES ('28000000-0000-0000-0000-000000000006','buky_raffle_won','Ganhou','P1');
INSERT INTO public.notifications(user_id,type,title,message) VALUES ('28000000-0000-0000-0000-000000000006','buky_raffle_won','Ganhou','P2');
DO $$ BEGIN
  IF (SELECT count(DISTINCT payload->>'result_id') FROM public.notification_outbox
      WHERE user_id='28000000-0000-0000-0000-000000000006' AND channel='email') <> 2 THEN
    RAISE EXCEPTION 'cada aviso debe apuntar a su propio premio';
  END IF;
END $$;
ROLLBACK;
