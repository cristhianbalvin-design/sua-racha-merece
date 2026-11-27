-- Preparação de exclusão. Aplicar somente após revisão e testes em banco isolado.
BEGIN;
ALTER TABLE public.shop_orders ALTER COLUMN user_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.buky_ledger_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 AND NOT EXISTS (SELECT 1 FROM public.users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'buky_ledger es inmutable' USING ERRCODE = '42501';
END $$;

CREATE OR REPLACE FUNCTION public.buky_entries_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 AND NOT EXISTS (SELECT 1 FROM public.users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' AND current_setting('buky.delete_period_id', true) = OLD.period_id::text
     AND public.is_admin() AND EXISTS (
       SELECT 1 FROM public.buky_raffle_periods p WHERE p.id = OLD.period_id AND p.is_test) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'buky_entries es inmutable' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_results_write_once()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_mutable text[] := ARRAY['delivery_status', 'delivery_note', 'delivered_at',
  'redeem_deadline', 'activated_at', 'republished_to', 'redeem_code', 'redeem_token',
  'redeemed_at', 'redeemed_by', 'redeemed_channel'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('buky.delete_period_id', true) = OLD.period_id::text
       AND public.is_admin() AND EXISTS (
         SELECT 1 FROM public.buky_raffle_periods p WHERE p.id = OLD.period_id
           AND (p.is_test OR NOT EXISTS (
             SELECT 1 FROM public.buky_entries e WHERE e.period_id = OLD.period_id))) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'buky_raffle_results es inmutable' USING ERRCODE = '42501';
  END IF;
  -- FK ON DELETE SET NULL runs inside the referential-action trigger.
  IF pg_trigger_depth() > 1 AND OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    v_mutable := array_append(v_mutable, 'user_id');
  END IF;
  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'buky_raffle_results es inmutable (solo cambia la entrega)' USING ERRCODE = '42501';
  END IF;
  IF OLD.redeem_code IS NOT NULL AND NEW.redeem_code IS DISTINCT FROM OLD.redeem_code THEN
    RAISE EXCEPTION 'redeem_code_locked' USING ERRCODE = '42501';
  END IF;
  IF OLD.redeem_token IS NOT NULL AND NEW.redeem_token IS DISTINCT FROM OLD.redeem_token THEN
    RAISE EXCEPTION 'redeem_token_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_prepare_account_deletion(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Serialize concurrent deletion attempts and order creation through the user FK lock.
  PERFORM 1 FROM public.users WHERE id = p_user FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.users WHERE id=p_user AND upper(role)='ADMIN') THEN RAISE EXCEPTION 'blocked_admin'; END IF;
  IF EXISTS (SELECT 1 FROM public.buky_sponsor_members WHERE user_id=p_user) THEN RAISE EXCEPTION 'blocked_sponsor_member'; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_orders WHERE user_id=p_user AND status NOT IN ('delivered','cancelled','exchanged')) THEN RAISE EXCEPTION 'blocked_open_order'; END IF;
  UPDATE public.buky_raffle_results SET redeemed_by=NULL WHERE redeemed_by=p_user;
  UPDATE public.buky_sponsor_members SET invited_by=NULL WHERE invited_by=p_user;
  UPDATE public.notification_types SET updated_by=NULL WHERE updated_by=p_user;
  -- Some deployments predate the moderation column.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='event_photos' AND column_name='reviewed_by') THEN
    EXECUTE 'UPDATE public.event_photos SET reviewed_by=NULL WHERE reviewed_by=$1' USING p_user;
  END IF;
  DELETE FROM public.manual_premium_grants WHERE user_id=p_user;
  DELETE FROM public.notification_outbox WHERE user_id=p_user;
  DELETE FROM public.shop_discount_reveals WHERE user_id=p_user;
  DELETE FROM public.shop_shipping_quotes WHERE user_id=p_user;
  UPDATE public.shop_orders SET user_id=NULL, address='{}'::jsonb, shipping_quote='{}'::jsonb,
    exchange_note=NULL, freight_note=NULL WHERE user_id=p_user;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.buky_prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buky_prepare_account_deletion(uuid) TO service_role;
COMMIT;
