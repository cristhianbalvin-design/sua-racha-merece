\c - postgres
\i :sqldir/42_avisos.sql
\i :sqldir/42_avisos.sql
BEGIN;
INSERT INTO public.users(id,email,name,role,plan) VALUES
 ('42000000-0000-0000-0000-000000000001','atleta42@buky.test','Atleta','USUARIO','Freemium'),
 ('42000000-0000-0000-0000-000000000002','admin42@buky.test','Admin','ADMIN','Freemium');
INSERT INTO public.payments(id,user_id,provider,product,amount_cents,status) VALUES
 ('42000000-0000-0000-0000-000000000003','42000000-0000-0000-0000-000000000001','mercadopago','premium_annual',5000,'approved'),
 ('42000000-0000-0000-0000-000000000004','42000000-0000-0000-0000-000000000001','mercadopago','wallet_topup',2000,'approved');
SELECT set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notification_types) < 20 THEN RAISE EXCEPTION 'catálogo incompleto'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.notification_types) THEN RAISE EXCEPTION 'catálogo visible para atleta'; END IF;
 IF (SELECT visible FROM public.my_notification_visibility() WHERE kind='new_campaign') THEN RAISE EXCEPTION 'legado visible'; END IF;
 BEGIN
   PERFORM public.admin_set_notification_type('premium_activated',false,false,false);
   RAISE EXCEPTION 'atleta alterou cat?logo';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT public.apply_premium_payment('42000000-0000-0000-0000-000000000003');
SELECT public.apply_premium_payment('42000000-0000-0000-0000-000000000003');
SELECT public.apply_premium_payment('42000000-0000-0000-0000-000000000004');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notifications WHERE user_id='42000000-0000-0000-0000-000000000001' AND type='premium_activated')<>1 THEN RAISE EXCEPTION 'premium duplicado'; END IF;
 IF (SELECT count(*) FROM public.notification_outbox WHERE user_id='42000000-0000-0000-0000-000000000001' AND kind='premium_activated')<>2 THEN RAISE EXCEPTION 'canais premium'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE user_id='42000000-0000-0000-0000-000000000001' AND type='wallet_credited')<>1 THEN RAISE EXCEPTION 'recarga'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000002',true);
SELECT public.admin_set_notification_type('buky_raffle_substitute',true,true,true);
INSERT INTO public.notifications(user_id,type,title,message) VALUES
 ('42000000-0000-0000-0000-000000000001','buky_raffle_substitute','Suplente','Em espera');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.message='Em espera') THEN
   RAISE EXCEPTION 'suplente em espera saiu por e-mail ou push';
 END IF;
END $$;
SELECT public.admin_set_notification_type('buky_raffle_substitute',true,false,false);
SELECT public.admin_set_notification_type('wallet_credited',true,false,false);
SELECT public.notify_event('42000000-0000-0000-0000-000000000001','wallet_credited','test','Saldo','Teste');
SELECT public.notify_event('42000000-0000-0000-0000-000000000001','wallet_credited','test','Saldo','Teste');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notifications WHERE user_id='42000000-0000-0000-0000-000000000001' AND type='wallet_credited')<>2 THEN RAISE EXCEPTION 'evento duplicado'; END IF;
 IF EXISTS (SELECT 1 FROM public.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.title='Saldo') THEN RAISE EXCEPTION 'canais desativados enfileirados'; END IF;
END $$;
SELECT public.admin_set_notification_type('premium_activated',true,true,false);
SELECT public.notify_event('42000000-0000-0000-0000-000000000001','premium_activated','push-off','Premium','Sem push');
SELECT public.admin_set_notification_type('premium_activated',true,false,true);
SELECT public.notify_event('42000000-0000-0000-0000-000000000001','premium_activated','email-off','Premium','Sem e-mail');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.message='Sem push')<>1
    OR EXISTS (SELECT 1 FROM public.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.message='Sem push' AND o.channel='push')
 THEN RAISE EXCEPTION 'push desligado não respeitado'; END IF;
 IF (SELECT count(*) FROM public.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.message='Sem e-mail')<>1
    OR EXISTS (SELECT 1 FROM public.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.message='Sem e-mail' AND o.channel='email')
 THEN RAISE EXCEPTION 'e-mail desligado não respeitado'; END IF;
END $$;
INSERT INTO public.buky_raffle_periods(id,name,starts_at,ends_at,draw_at,cadence,status) VALUES
 ('42000000-0000-0000-0000-000000000005','Sorteio 42',now()-interval '1 day',now()+interval '12 hours',now()+interval '13 hours','none','open');
INSERT INTO public.buky_entries(period_id,user_id,amount,city_code,state_code,ticket_code) VALUES
 ('42000000-0000-0000-0000-000000000005','42000000-0000-0000-0000-000000000001',1,3302700,(SELECT state_code FROM public.br_cities WHERE code=3302700),'T42-A');
SELECT public.buky_raffle_closing_reminders();
SELECT public.buky_raffle_closing_reminders();
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notifications WHERE user_id='42000000-0000-0000-0000-000000000001' AND type='buky_raffle_closing_soon')<>1 THEN RAISE EXCEPTION 'recordatorio duplicado'; END IF;
END $$;
UPDATE public.buky_raffle_periods SET status='drawn', drawn_at=now() WHERE id='42000000-0000-0000-0000-000000000005';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notifications WHERE user_id='42000000-0000-0000-0000-000000000001' AND type='buky_raffle_lost')<>1 THEN RAISE EXCEPTION 'resultado sem aviso'; END IF;
END $$;
ROLLBACK;
