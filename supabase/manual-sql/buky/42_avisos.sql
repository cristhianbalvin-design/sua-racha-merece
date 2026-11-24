-- Catálogo y eventos de avisos. Aplicar después del paso 41.
BEGIN;
CREATE TABLE IF NOT EXISTS public.notification_types (
 kind text PRIMARY KEY, label text NOT NULL, description text NOT NULL,
 audience text NOT NULL CHECK (audience IN ('athlete','admin','sponsor')),
 in_app_enabled boolean NOT NULL, email_enabled boolean NOT NULL, push_enabled boolean NOT NULL,
 legacy boolean NOT NULL DEFAULT false, implemented boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES public.users(id)
);
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_types_admin ON public.notification_types;
CREATE POLICY notification_types_admin ON public.notification_types TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.notification_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_types TO authenticated;
INSERT INTO public.notification_types(kind,label,description,audience,in_app_enabled,email_enabled,push_enabled,legacy,implemented) VALUES
 ('premium_activated','Premium ativado','Confirmação da ativação do plano.','athlete',true,true,true,false,true),
 ('premium_expiring','Premium vencendo','Lembrete de vencimento do plano.','athlete',true,true,true,false,true),
 ('buky_raffle_won','Prêmio ganho','Resultado premiado do sorteio.','athlete',true,true,true,false,true),
 ('buky_raffle_substitute','Suplente','Aviso de suplência no sorteio.','athlete',true,false,false,false,true),
 ('buky_raffle_closing_soon','Sorteio encerrando','Sorteio participante encerra em até 24 horas.','athlete',true,false,true,false,true),
 ('buky_raffle_lost','Resultado do sorteio','Resultado para participantes não premiados.','athlete',true,false,false,false,true),
 ('wallet_credited','Saldo creditado','Confirmação de recarga aprovada.','athlete',true,false,true,false,true),
 ('buky_prize_redeemed','Prêmio resgatado','Confirmação de resgate.','athlete',true,false,false,false,true),
 ('buky_raffle_review','Revisão de sorteio','Sorteio precisa de revisão.','admin',true,true,false,false,true),
 ('buky_prize_unclaimed','Prêmio não resgatado','Prêmio sem resgate.','admin',true,true,false,false,true),
 ('shop_order_paid','Pedido pago','Pagamento de pedido confirmado.','athlete',true,true,false,false,true),
 ('shop_order_shipped','Pedido enviado','Pedido enviado.','athlete',true,true,false,false,true),
 ('shop_order_delivered','Pedido entregue','Pedido entregue.','athlete',true,true,false,false,true),
 ('shop_order_refunded','Pedido reembolsado','Pedido reembolsado.','athlete',true,true,false,false,true),
 ('shop_freight_requested','Frete solicitado','Pagamento de frete solicitado.','athlete',true,true,false,false,true),
 ('shop_freight_waiting','Frete pendente','Pedido aguardando definição do frete.','admin',true,false,false,false,true),
 ('shop_freight_overdue','Frete vencido','Pagamento de frete não recebido.','admin',true,false,false,false,true),
 ('new_campaign','Nova campanha','Aviso da versão antiga.','athlete',false,false,false,true,true),
 ('campaign_status','Estado da campanha','Aviso da versão antiga.','athlete',false,false,false,true,true),
 ('participation_status','Estado da participação','Aviso da versão antiga.','athlete',false,false,false,true,true)
ON CONFLICT (kind) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_set_notification_type(p_kind text,p_in_app boolean,p_email boolean,p_push boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 UPDATE public.notification_types SET in_app_enabled=p_in_app,email_enabled=p_email,push_enabled=p_push,updated_at=now(),updated_by=auth.uid() WHERE kind=p_kind;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown_kind'; END IF;
END $$;

-- Expone únicamente las reglas de visibilidad, no el catálogo administrativo.
CREATE OR REPLACE FUNCTION public.my_notification_visibility()
RETURNS TABLE(kind text, visible boolean) LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
 SELECT t.kind, t.in_app_enabled AND NOT t.legacy FROM public.notification_types t
$$;
CREATE OR REPLACE FUNCTION public.notify_user(p_user_id uuid,p_kind text,p_title text,p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_id uuid; v_type public.notification_types%ROWTYPE;
BEGIN
 SELECT * INTO v_type FROM public.notification_types WHERE kind=p_kind;
 IF FOUND AND NOT (v_type.in_app_enabled OR v_type.email_enabled OR v_type.push_enabled) THEN RETURN NULL; END IF;
 INSERT INTO public.notifications(user_id,type,title,message) VALUES(p_user_id,p_kind,p_title,p_message) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.notify_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE rid uuid; t public.notification_types%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.notification_types WHERE kind=NEW.type;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF t.audience='admin' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id=NEW.user_id AND role='ADMIN') THEN RETURN NEW; END IF;
 -- Suplentes em espera recebem apenas o aviso no app. A ativação posterior
 -- tem seu próprio fluxo e não deve enviar o prêmio antecipadamente.
 IF NEW.type='buky_raffle_substitute' THEN RETURN NEW; END IF;
 IF NEW.type='buky_raffle_won' THEN
   SELECT r.id INTO rid FROM public.buky_raffle_results r
   WHERE r.user_id=NEW.user_id AND r.delivery_status IN ('pending','notified') AND NOT EXISTS
     (SELECT 1 FROM public.notification_outbox o WHERE o.user_id=NEW.user_id AND o.payload->>'result_id'=r.id::text)
   ORDER BY coalesce(r.activated_at,r.drawn_at) DESC,r.ctid DESC LIMIT 1;
 END IF;
 IF t.email_enabled THEN
   INSERT INTO public.notification_outbox(notification_id,user_id,kind,channel,subject,payload,dedupe_key)
   VALUES(NEW.id,NEW.user_id,NEW.type,'email',NEW.title,jsonb_build_object('message',NEW.message,'result_id',rid),'notif:'||NEW.id||':email') ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 IF t.push_enabled THEN
   INSERT INTO public.notification_outbox(notification_id,user_id,kind,channel,subject,payload,dedupe_key)
   VALUES(NEW.id,NEW.user_id,NEW.type,'push',NEW.title,jsonb_build_object('message',NEW.message,'result_id',rid),'notif:'||NEW.id||':push') ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 IF t.email_enabled OR t.push_enabled THEN PERFORM public.notify_dispatch(); END IF;
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_event_keys (kind text NOT NULL, event_id text NOT NULL, user_id uuid NOT NULL, PRIMARY KEY(kind,event_id,user_id));
REVOKE ALL ON public.notification_event_keys FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.notify_event(p_user_id uuid,p_kind text,p_event_id text,p_title text,p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 INSERT INTO public.notification_event_keys(kind,event_id,user_id) VALUES(p_kind,p_event_id,p_user_id) ON CONFLICT DO NOTHING;
 IF FOUND THEN PERFORM public.notify_user(p_user_id,p_kind,p_title,p_message); END IF;
END $$;
-- La transición solo ocurre tras acreditar el pago y queda protegida por el bloqueo del pago.
CREATE OR REPLACE FUNCTION public.notify_payment_applied() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_until timestamptz;
BEGIN
 IF OLD.premium_applied_at IS NULL AND NEW.premium_applied_at IS NOT NULL AND NEW.status='approved' THEN
   IF NEW.product='premium_annual' THEN
     SELECT premium_until INTO v_until FROM public.users WHERE id=NEW.user_id;
     PERFORM public.notify_event(NEW.user_id,'premium_activated',NEW.id::text,'Você agora é Premium!',
       format('Seu plano Premium está ativo até %s. Aproveite fotos, saldo e prêmios.',to_char(v_until AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY')));
   ELSIF NEW.product='wallet_topup' THEN
     PERFORM public.notify_event(NEW.user_id,'wallet_credited',NEW.id::text,'Saldo creditado','Sua recarga foi aprovada e o saldo está disponível.');
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_payment_applied ON public.payments;
CREATE TRIGGER notify_payment_applied AFTER UPDATE OF premium_applied_at ON public.payments FOR EACH ROW EXECUTE FUNCTION public.notify_payment_applied();
CREATE OR REPLACE FUNCTION public.buky_raffle_closing_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT DISTINCT p.id,e.user_id FROM public.buky_raffle_periods p JOIN public.buky_raffle_periods ep ON ep.id=p.id OR ep.merged_into=p.id JOIN public.buky_entries e ON e.period_id=ep.id WHERE p.status='open' AND p.ends_at>now() AND p.ends_at<=now()+interval '24 hours' LOOP
   PERFORM public.notify_event(r.user_id,'buky_raffle_closing_soon',r.id::text,'Sorteio encerrando','O sorteio em que você participa termina nas próximas 24 horas.'); n:=n+1;
 END LOOP;
 RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.notify_raffle_lost() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r record;
BEGIN
 IF NEW.status='drawn' AND OLD.status IS DISTINCT FROM 'drawn' THEN
   FOR r IN SELECT DISTINCT e.user_id FROM public.buky_entries e JOIN public.buky_raffle_periods p ON p.id=e.period_id WHERE (p.id=NEW.id OR p.merged_into=NEW.id) AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_results x WHERE x.period_id=NEW.id AND x.user_id=e.user_id) LOOP
     PERFORM public.notify_event(r.user_id,'buky_raffle_lost',NEW.id::text,'Resultado do sorteio','O sorteio terminou e você não foi premiado desta vez.');
   END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_raffle_lost ON public.buky_raffle_periods;
CREATE TRIGGER notify_raffle_lost AFTER UPDATE OF status ON public.buky_raffle_periods FOR EACH ROW EXECUTE FUNCTION public.notify_raffle_lost();
CREATE OR REPLACE FUNCTION public.admin_notification_counts()
RETURNS TABLE(kind text, status text, total bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT o.kind,o.status,count(*) FROM public.notification_outbox o WHERE o.created_at>=now()-interval '7 days' AND o.status IN ('sent','failed','skipped') GROUP BY o.kind,o.status;
END $$;
REVOKE ALL ON FUNCTION public.admin_notification_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_notification_counts() TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_test_push() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 INSERT INTO public.notification_outbox(user_id,kind,channel,subject,payload,dedupe_key) VALUES(auth.uid(),'admin_test','push','Teste de notificação',jsonb_build_object('message','Este é um push de teste.'),'test:'||gen_random_uuid()::text);
 PERFORM public.notify_dispatch();
END $$;
REVOKE ALL ON FUNCTION public.admin_set_notification_type(text,boolean,boolean,boolean),public.my_notification_visibility(),public.admin_test_push() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_notification_type(text,boolean,boolean,boolean),public.my_notification_visibility(),public.admin_test_push() TO authenticated;
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text),public.notify_event(uuid,text,text,text,text),public.notify_payment_applied(),public.notify_raffle_lost(),public.buky_raffle_closing_reminders(),public.notify_enqueue() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text),public.buky_raffle_closing_reminders() TO service_role;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
   PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('premium-expiry-reminders','buky-raffle-closing-reminders');
   PERFORM cron.schedule('premium-expiry-reminders','7 13 * * *','SELECT public.premium_expiry_reminders()');
   PERFORM cron.schedule('buky-raffle-closing-reminders','7 13 * * *','SELECT public.buky_raffle_closing_reminders()');
 ELSE RAISE NOTICE 'pg_cron no está instalado: programar los recordatorios externamente'; END IF;
END $$;
COMMIT;
