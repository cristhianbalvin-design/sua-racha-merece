-- Paso 34: cobro del frete después de los productos.
BEGIN;
INSERT INTO public.app_settings(key, value, description) VALUES
  ('shop_shipping_mode', '"arrange"', 'Modo de envío de la tienda'),
  ('shop_freight_pay_days', '7', 'Plazo de pago del frete'),
  ('shop_freight_reminder_days', '3', 'Días hasta el recordatorio')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_status_check;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_status_check CHECK (status IN
  ('pending_payment', 'paid', 'awaiting_freight', 'freight_pending', 'preparing', 'shipped',
   'delivered', 'cancelled', 'exchange_requested', 'exchanged'));
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS freight_cents integer,
  ADD COLUMN IF NOT EXISTS freight_carrier text,
  ADD COLUMN IF NOT EXISTS freight_note text,
  ADD COLUMN IF NOT EXISTS freight_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS freight_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS freight_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS freight_payment_method text,
  ADD COLUMN IF NOT EXISTS freight_payment_id uuid REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS freight_reminded_at timestamptz;
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_freight_payment_method_check;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_freight_payment_method_check
  CHECK (freight_payment_method IN ('mercadopago', 'wallet'));
-- Conserva cualquier restricción existente de producto y admite el nuevo tipo.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid = 'public.payments'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '\mproduct\M'
      AND pg_get_constraintdef(oid) NOT LIKE '%shop_freight%'
  LOOP
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', c.conname);
    EXECUTE format('ALTER TABLE public.payments ADD CONSTRAINT %I CHECK ((%s) OR product = ''shop_freight'')',
      c.conname, substring(c.definition FROM 8 FOR length(c.definition) - 8));
  END LOOP;
END $$;
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_reason_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check CHECK (reason IN
  ('premium_bonus', 'topup', 'photo_purchase', 'payment_reverted', 'admin_refund',
   'admin_adjustment', 'shop_purchase', 'shop_refund', 'shop_freight'));
CREATE OR REPLACE FUNCTION public.shop_shipping_mode() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce((SELECT value #>> '{}' FROM public.app_settings WHERE key = 'shop_shipping_mode'), 'arrange')
$$;
GRANT EXECUTE ON FUNCTION public.shop_shipping_mode() TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.shop_create_order(p_items jsonb,p_address jsonb,p_shipping jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE q public.shop_shipping_quotes%ROWTYPE; opt jsonb; x record; oid uuid; subtotal bigint:=0; shipping int; unit_price integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF NOT coalesce((SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key='shop_enabled'),false) AND NOT public.is_admin() THEN RAISE EXCEPTION 'shop_disabled'; END IF;
 PERFORM public.shop_quote_package(p_items);
 IF public.shop_shipping_mode() = 'quote' THEN
 SELECT * INTO q FROM public.shop_shipping_quotes WHERE id=(p_shipping->>'quote_id')::uuid AND user_id=auth.uid() AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR q.items_hash<>public.shop_items_hash(p_items) OR q.cep<>regexp_replace(coalesce(p_address->>'cep',''),'[^0-9]','','g') THEN RAISE EXCEPTION 'invalid_quote'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['recipient','phone','street','number','district','city','uf']) k WHERE length(trim(coalesce(p_address->>k,'')))=0) THEN RAISE EXCEPTION 'invalid_address'; END IF;
 SELECT value INTO opt FROM jsonb_array_elements(q.options) WHERE value->>'id'=p_shipping->>'option_id';
 IF opt IS NULL THEN RAISE EXCEPTION 'invalid_shipping_option'; END IF;
 shipping:=(opt->>'price_cents')::int; IF shipping<0 THEN RAISE EXCEPTION 'invalid_shipping'; END IF;
 ELSE
   shipping := 0;
   opt := jsonb_build_object('company', 'A combinar');
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['recipient','phone','street','number','district','city','uf','cep']) k WHERE length(trim(coalesce(p_address->>k,'')))=0) THEN RAISE EXCEPTION 'invalid_address'; END IF;
 -- Orden estable evita bloqueos cruzados; el UPDATE condicional impide sobreventa.
 FOR x IN SELECT (v->>'variant_id')::uuid id,sum((v->>'qty')::int)::int qty FROM jsonb_array_elements(p_items) v GROUP BY 1 ORDER BY 1 LOOP
   UPDATE public.shop_variants SET stock=stock-x.qty WHERE id=x.id AND active AND stock>=x.qty;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_stock'; END IF;
   SELECT p.price_cents INTO unit_price FROM public.shop_variants v JOIN public.shop_products p ON p.id=v.product_id WHERE v.id=x.id AND p.active FOR SHARE OF p;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_product'; END IF;
   subtotal:=subtotal + unit_price*x.qty;
 END LOOP;
 INSERT INTO public.shop_orders(user_id,items_cents,shipping_cents,total_cents,shipping_service,shipping_quote,address,reserved_until)
 VALUES(auth.uid(),subtotal,shipping,subtotal+shipping,CASE WHEN public.shop_shipping_mode() = 'arrange' THEN 'A combinar' ELSE concat_ws(' - ',opt->>'company',opt->>'service') END,opt,p_address,now()+make_interval(mins=>public.setting_int('shop_reservation_minutes',30))) RETURNING id INTO oid;
 INSERT INTO public.shop_order_items (order_id, variant_id, product_name, color, size, unit_cents, qty)
 SELECT oid, v.id, p.name, v.color, v.size, p.price_cents, it.qty
 FROM (SELECT (j->>'variant_id')::uuid AS vid, sum((j->>'qty')::int)::int AS qty FROM jsonb_array_elements(p_items) j GROUP BY 1) it
 JOIN public.shop_variants v ON v.id = it.vid
 JOIN public.shop_products p ON p.id = v.product_id;
 DELETE FROM public.shop_shipping_quotes WHERE id=q.id;
 RETURN oid;
END $$;
CREATE OR REPLACE FUNCTION public.shop_pay_with_wallet(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.shop_orders WHERE id=p_order_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
 IF o.paid_at IS NOT NULL AND o.payment_method='wallet' THEN RETURN jsonb_build_object('paid',true,'duplicate',true); END IF;
 IF o.status<>'pending_payment' OR o.reserved_until<=now() OR o.payment_id IS NOT NULL THEN RAISE EXCEPTION 'order_not_payable'; END IF;
 PERFORM public.apply_wallet_movement(o.user_id,-o.total_cents,'shop_purchase','shop_order',o.id::text,'shop:'||o.id::text);
 UPDATE public.shop_orders SET status=CASE WHEN o.shipping_service='A combinar' THEN 'awaiting_freight' ELSE 'paid' END,payment_method='wallet',paid_at=now() WHERE id=o.id;
 IF o.shipping_service='A combinar' THEN
   PERFORM public.buky_notify_admins('shop_freight_waiting', 'Novo pedido aguardando frete', o.id::text);
 END IF;
 INSERT INTO public.notifications(user_id,type,title,message) VALUES(o.user_id,'shop_order_paid','Pagamento confirmado','Seu pedido foi pago.');
 RETURN jsonb_build_object('paid',true,'duplicate',false);
END $$;
CREATE OR REPLACE FUNCTION public.admin_shop_update_order(p_order_id uuid,p_status text,p_tracking_code text DEFAULT NULL,p_tracking_url text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT * INTO o FROM public.shop_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
 IF NOT ((o.status='paid' AND p_status IN ('preparing','cancelled')) OR (o.status IN ('pending_payment','awaiting_freight','freight_pending') AND p_status='cancelled') OR (o.status='preparing' AND p_status IN ('shipped','cancelled')) OR (o.status='shipped' AND p_status='delivered') OR (o.status='exchange_requested' AND p_status='exchanged')) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
 IF p_status='shipped' AND (coalesce(trim(p_tracking_code),'')='' OR coalesce(trim(p_tracking_url),'')='') THEN RAISE EXCEPTION 'tracking_required'; END IF;
 IF p_status='cancelled' THEN
 PERFORM public.shop_restore_stock(o.id);
 IF o.payment_method='wallet' AND o.paid_at IS NOT NULL THEN PERFORM public.apply_wallet_movement(o.user_id,o.total_cents,'shop_refund','shop_order',o.id::text,'shop_refund:'||o.id::text,p_note,auth.uid()); END IF;
 IF o.freight_payment_method='wallet' AND o.freight_paid_at IS NOT NULL THEN
   PERFORM public.apply_wallet_movement(o.user_id,o.freight_cents,'shop_refund','shop_order',o.id::text,'freight_refund:'||o.id::text,p_note,auth.uid());
 END IF;
 END IF;
 UPDATE public.shop_orders SET status=p_status,tracking_code=coalesce(p_tracking_code,tracking_code),tracking_url=coalesce(p_tracking_url,tracking_url),shipped_at=CASE WHEN p_status='shipped' THEN now() ELSE shipped_at END,delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END WHERE id=o.id;
 IF p_status IN ('shipped','delivered') THEN INSERT INTO public.notifications(user_id,type,title,message) VALUES(o.user_id,'shop_order_'||p_status,CASE WHEN p_status='shipped' THEN 'Pedido enviado' ELSE 'Pedido entregue' END,'Confira os detalhes do seu pedido.'); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.apply_premium_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_current_until timestamptz;
  v_was_active boolean;
  v_new_until timestamptz;
  v_grant integer;
  v_order public.shop_orders%ROWTYPE;
  v_item record;
  v_shop_ok boolean;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_payment.status <> 'approved' THEN
    RAISE EXCEPTION 'payment_not_approved' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.user_id IS NULL THEN
    RAISE EXCEPTION 'payment_without_user' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.premium_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_applied');
  END IF;

  IF v_payment.product = 'shop_freight' THEN
    SELECT * INTO v_order FROM public.shop_orders WHERE freight_payment_id = v_payment.id AND user_id = v_payment.user_id FOR UPDATE;
    IF FOUND AND v_order.status = 'freight_pending' AND v_order.freight_cents = v_payment.amount_cents THEN
      UPDATE public.shop_orders SET status = 'preparing', freight_paid_at = now(), freight_payment_method = 'mercadopago' WHERE id = v_order.id;
    ELSE
      PERFORM public.apply_wallet_movement(v_payment.user_id, v_payment.amount_cents, 'shop_refund', 'payment', v_payment.id::text, 'freight_late:' || v_payment.id::text);
      INSERT INTO public.notifications(user_id, type, title, message) VALUES (v_payment.user_id, 'shop_order_refunded', 'Frete devolvido', 'O valor do frete foi devolvido ao seu saldo.');
    END IF;
    UPDATE public.payments SET premium_applied_at = now() WHERE id = v_payment.id;
    RETURN jsonb_build_object('applied', true, 'product', 'shop_freight');
  END IF;
  IF v_payment.product = 'shop_order' THEN
    SELECT * INTO v_order FROM public.shop_orders
    WHERE payment_id = v_payment.id AND user_id = v_payment.user_id FOR UPDATE;

    IF FOUND AND v_order.total_cents = v_payment.amount_cents AND v_order.status = 'pending_payment' THEN
      -- Caso normal (aunque la reserva haya vencido hace instantes: el stock sigue descontado).
      UPDATE public.shop_orders SET status = CASE WHEN v_order.shipping_service = 'A combinar' THEN 'awaiting_freight' ELSE 'paid' END, paid_at = now(), payment_method = 'mercadopago' WHERE id = v_order.id;
      v_shop_ok := true;
    ELSIF FOUND AND v_order.total_cents = v_payment.amount_cents AND v_order.status = 'cancelled' AND v_order.paid_at IS NULL THEN
      -- Pago tardío: la reserva venció y el stock se liberó. Se intenta reservar de nuevo todo el pedido;
      -- si falta alguna unidad, no se vende y el monto pagado vuelve al saldo del atleta.
      BEGIN
        FOR v_item IN SELECT variant_id, qty FROM public.shop_order_items WHERE order_id = v_order.id ORDER BY variant_id LOOP
          UPDATE public.shop_variants SET stock = stock - v_item.qty WHERE id = v_item.variant_id AND stock >= v_item.qty;
          IF NOT FOUND THEN RAISE EXCEPTION 'late_payment_no_stock'; END IF;
        END LOOP;
        UPDATE public.shop_orders SET status = CASE WHEN v_order.shipping_service = 'A combinar' THEN 'awaiting_freight' ELSE 'paid' END, paid_at = now(), payment_method = 'mercadopago' WHERE id = v_order.id;
        v_shop_ok := true;
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'late_payment_no_stock' THEN RAISE; END IF;
        v_shop_ok := false;  -- el bloque deshace las reservas parciales
      END;
    ELSIF FOUND AND v_order.paid_at IS NOT NULL THEN
      UPDATE public.payments SET premium_applied_at = now() WHERE id = v_payment.id;
      RETURN jsonb_build_object('applied', false, 'reason', 'already_paid');
    ELSE
      v_shop_ok := false;  -- pedido inexistente o monto distinto: no se entrega nada, se devuelve al saldo
    END IF;

    UPDATE public.payments SET premium_applied_at = now() WHERE id = v_payment.id;
    IF v_shop_ok THEN
      IF v_order.shipping_service = 'A combinar' THEN
        PERFORM public.buky_notify_admins('shop_freight_waiting', 'Novo pedido aguardando frete', v_order.id::text);
      END IF;
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (v_payment.user_id, 'shop_order_paid', 'Pagamento confirmado', 'Seu pedido foi pago.');
      RETURN jsonb_build_object('applied', true, 'product', 'shop_order');
    END IF;
    PERFORM public.apply_wallet_movement(v_payment.user_id, v_payment.amount_cents, 'shop_refund', 'payment',
                                         v_payment.id::text, 'shop_late:' || v_payment.id::text,
                                         'Pagamento recebido depois do fim da reserva; valor devolvido ao saldo');
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_payment.user_id, 'shop_order_refunded', 'Pedido não confirmado',
            'Seu pagamento chegou depois do fim da reserva e o produto esgotou. O valor foi devolvido ao seu saldo 3buk.');
    RETURN jsonb_build_object('applied', true, 'product', 'shop_order', 'refunded_to_wallet', v_payment.amount_cents);
  END IF;
  IF v_payment.product = 'wallet_topup' THEN
    -- Recarga: el monto pagado entra al saldo
    PERFORM public.apply_wallet_movement(v_payment.user_id, v_payment.amount_cents, 'topup', 'payment',
                                         v_payment.id::text, 'topup:' || v_payment.id::text, NULL);
    UPDATE public.payments SET premium_applied_at = now() WHERE id = v_payment.id;
    RETURN jsonb_build_object('applied', true, 'product', 'wallet_topup', 'wallet_cents', v_payment.amount_cents);
  END IF;

  IF v_payment.product <> 'premium_annual' THEN
    RAISE EXCEPTION 'unsupported_product' USING ERRCODE = 'P0001';
  END IF;

  SELECT premium_until INTO v_current_until FROM public.users WHERE id = v_payment.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  v_was_active := v_current_until IS NOT NULL AND v_current_until > now();
  v_new_until := GREATEST(COALESCE(v_current_until, now()), now()) + interval '1 year';
  UPDATE public.users
  SET plan = 'Premium',
      premium_since = CASE WHEN v_was_active THEN COALESCE(premium_since, now()) ELSE now() END,
      premium_until = v_new_until
  WHERE id = v_payment.user_id;

  -- R$50 de saldo por cada pago del Premium (idempotente por pago)
  v_grant := public.setting_int('wallet_premium_grant_cents', 5000);
  IF v_grant > 0 THEN
    PERFORM public.apply_wallet_movement(v_payment.user_id, v_grant, 'premium_bonus', 'payment',
                                         v_payment.id::text, 'premium:' || v_payment.id::text, NULL);
  END IF;
  UPDATE public.payments SET premium_applied_at = now() WHERE id = v_payment.id;
  RETURN jsonb_build_object('applied', true, 'product', 'premium_annual', 'premium_until', v_new_until,
                            'wallet_cents', GREATEST(v_grant, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_premium_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_until timestamptz;
  v_new_until timestamptz;
  v_granted bigint;
  v_balance bigint;
  v_take bigint := 0;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_payment.status NOT IN ('refunded', 'charged_back') THEN
    RAISE EXCEPTION 'payment_not_reverted' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.product = 'shop_freight' THEN
    IF v_payment.premium_revoked_at IS NOT NULL THEN RETURN jsonb_build_object('revoked', false); END IF;
    UPDATE public.shop_orders SET status = 'freight_pending', freight_paid_at = NULL, freight_payment_id = NULL, freight_payment_method = NULL
      WHERE freight_payment_id = v_payment.id AND status = 'preparing';
    UPDATE public.payments SET premium_revoked_at = now() WHERE id = v_payment.id;
    RETURN jsonb_build_object('revoked', true);
  END IF;
  IF v_payment.product = 'shop_order' THEN
    IF v_payment.premium_revoked_at IS NOT NULL THEN RETURN jsonb_build_object('revoked',false,'reason','already_revoked'); END IF;
    PERFORM 1 FROM public.shop_orders WHERE payment_id=v_payment.id FOR UPDATE;
    IF FOUND THEN
      PERFORM public.shop_restore_stock(id) FROM public.shop_orders WHERE payment_id=v_payment.id AND status <> 'cancelled';
      UPDATE public.shop_orders SET status='cancelled' WHERE payment_id=v_payment.id AND status <> 'cancelled';
    END IF;
    UPDATE public.payments SET premium_revoked_at=now() WHERE id=v_payment.id;
    RETURN jsonb_build_object('revoked',true);
  END IF;
  IF v_payment.product NOT IN ('premium_annual', 'wallet_topup') OR v_payment.user_id IS NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'not_applicable');
  END IF;
  IF v_payment.premium_applied_at IS NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'not_applied');
  END IF;
  IF v_payment.premium_revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'already_revoked');
  END IF;

  IF v_payment.product = 'premium_annual' THEN
    SELECT premium_until INTO v_until FROM public.users WHERE id = v_payment.user_id FOR UPDATE;
    IF v_until IS NOT NULL THEN
      v_new_until := v_until - interval '1 year';
      UPDATE public.users
      SET premium_until = v_new_until,
          plan = CASE WHEN v_new_until > now() THEN 'Premium' ELSE 'Freemium' END
      WHERE id = v_payment.user_id;
    END IF;
  END IF;

  -- Se retira del saldo lo que ese pago acreditó y todavía no se usó
  SELECT delta_cents INTO v_granted FROM public.wallet_ledger
  WHERE user_id = v_payment.user_id
    AND idempotency_key = CASE v_payment.product WHEN 'wallet_topup' THEN 'topup:' ELSE 'premium:' END || v_payment.id::text;
  IF v_granted IS NOT NULL AND v_granted > 0 THEN
    SELECT coalesce(balance_cents, 0) INTO v_balance FROM public.wallet_balances WHERE user_id = v_payment.user_id;
    v_take := LEAST(v_granted, coalesce(v_balance, 0));
    IF v_take > 0 THEN
      PERFORM public.apply_wallet_movement(v_payment.user_id, -v_take, 'payment_reverted', 'payment', v_payment.id::text,
                                           'reverted:' || v_payment.id::text, 'Pagamento estornado');
    END IF;
  END IF;

  UPDATE public.payments SET premium_revoked_at = now() WHERE id = v_payment.id;
  RETURN jsonb_build_object('revoked', true, 'premium_until', v_new_until, 'wallet_removed_cents', v_take);
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE rid uuid;
admin_notice boolean;
BEGIN
  admin_notice:= NEW.type IN ('buky_raffle_review','buky_prize_unclaimed') AND EXISTS (SELECT 1
  FROM public.users
  WHERE id=NEW.user_id AND role='ADMIN');
IF NEW.type NOT IN ('buky_raffle_won','buky_raffle_substitute','premium_expiring','shop_order_paid','shop_order_shipped','shop_order_delivered','shop_order_refunded','shop_freight_requested') AND NOT admin_notice THEN
  RETURN NEW;
  END IF;
IF NEW.type='buky_raffle_substitute' THEN
  RETURN NEW;
  END IF;
IF NEW.type IN ('buky_raffle_won', 'buky_raffle_substitute') THEN
  -- Resultado activo más reciente que aún no tenga aviso (dos premios en la misma pasada no comparten aviso)
 SELECT r.id INTO rid
  FROM public.buky_raffle_results r
  WHERE r.user_id=NEW.user_id AND r.delivery_status IN ('pending','notified') AND NOT EXISTS (SELECT 1
  FROM public.notification_outbox o
  WHERE o.user_id=NEW.user_id AND o.payload->>'result_id'=r.id::text)
  ORDER BY coalesce(r.activated_at, r.drawn_at) DESC,r.ctid DESC LIMIT 1;
-- El paso 25 envía un aviso in-app a suplentes en espera; no es una activación.
 IF NEW.type='buky_raffle_substitute' AND rid IS NULL THEN
  RETURN NEW;
  END IF;
  END IF;
INSERT INTO public.notification_outbox(notification_id, user_id, kind, channel, subject,
   payload, dedupe_key)
  VALUES(NEW.id,NEW.user_id,NEW.type,'email',NEW.title, jsonb_build_object('message',
   NEW.message, 'result_id', rid),'notif:'||NEW.id||':email')
  ON CONFLICT(dedupe_key) DO NOTHING;
IF NEW.type IN ('buky_raffle_won', 'buky_raffle_substitute') THEN
  INSERT INTO public.notification_outbox(notification_id, user_id, kind, channel,
   subject, payload, dedupe_key)
  VALUES(NEW.id,NEW.user_id,NEW.type,'push',NEW.title, jsonb_build_object('message',
   NEW.message, 'result_id', rid),'notif:'||NEW.id||':push')
  ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
PERFORM public.notify_dispatch();
RETURN NEW;
END $$ ;
CREATE OR REPLACE FUNCTION public.admin_shop_set_shipping_mode(p_mode text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_mode NOT IN ('arrange', 'quote') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  UPDATE public.app_settings SET value = to_jsonb(p_mode), updated_at = now() WHERE key = 'shop_shipping_mode';
END $$;
CREATE OR REPLACE FUNCTION public.admin_shop_request_freight(
  p_order_id uuid, p_freight_cents integer, p_carrier text, p_note text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO o FROM public.shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status NOT IN ('awaiting_freight', 'freight_pending') THEN RAISE EXCEPTION 'invalid_order'; END IF;
  IF p_freight_cents IS NULL OR p_freight_cents <= 0 OR coalesce(trim(p_carrier), '') = '' THEN
    RAISE EXCEPTION 'invalid_freight';
  END IF;
  IF o.freight_payment_id IS NOT NULL THEN
    IF o.freight_cents <> p_freight_cents OR o.freight_carrier <> trim(p_carrier) THEN
      RAISE EXCEPTION 'checkout_in_progress';
    END IF;
  ELSE
    UPDATE public.shop_orders SET status = 'freight_pending', freight_cents = p_freight_cents,
      freight_carrier = trim(p_carrier), freight_note = p_note, freight_requested_at = now(),
      freight_due_at = now() + make_interval(days => public.setting_int('shop_freight_pay_days', 7)),
      freight_reminded_at = NULL WHERE id = o.id RETURNING * INTO o;
  END IF;
  INSERT INTO public.notifications(user_id, type, title, message)
  VALUES (o.user_id, 'shop_freight_requested', 'Frete do seu pedido',
    'Frete do seu pedido: R$ ' || to_char(o.freight_cents / 100.0, 'FM999999990D00') || ' via ' || o.freight_carrier ||
    '. Pague até ' || to_char(o.freight_due_at, 'DD/MM/YYYY') || ' em Meus pedidos.');
END $$;
CREATE OR REPLACE FUNCTION public.shop_pay_freight_with_wallet(p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.shop_orders WHERE id = p_order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.freight_paid_at IS NOT NULL AND o.freight_payment_method = 'wallet' THEN
    RETURN jsonb_build_object('paid', true, 'duplicate', true);
  END IF;
  IF o.status <> 'freight_pending' OR o.freight_payment_id IS NOT NULL THEN RAISE EXCEPTION 'order_not_payable'; END IF;
  PERFORM public.apply_wallet_movement(o.user_id, -o.freight_cents, 'shop_freight', 'shop_order', o.id::text, 'freight:' || o.id::text);
  UPDATE public.shop_orders SET status = 'preparing', freight_paid_at = now(), freight_payment_method = 'wallet' WHERE id = o.id;
  RETURN jsonb_build_object('paid', true, 'duplicate', false);
END $$;
CREATE OR REPLACE FUNCTION public.shop_begin_freight_checkout(p_order_id uuid, p_user_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE; pid uuid;
BEGIN
  SELECT * INTO o FROM public.shop_orders WHERE id = p_order_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'freight_pending' OR o.freight_payment_id IS NOT NULL THEN RAISE EXCEPTION 'order_not_payable'; END IF;
  INSERT INTO public.payments(user_id, provider, product, amount_cents, currency, status)
  VALUES(o.user_id, 'mercadopago', 'shop_freight', o.freight_cents, 'BRL', 'pending') RETURNING id INTO pid;
  UPDATE public.shop_orders SET freight_payment_id = pid, freight_payment_method = 'mercadopago' WHERE id = o.id;
  RETURN pid;
END $$;
CREATE OR REPLACE FUNCTION public.shop_freight_reminders() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
  FOR o IN SELECT * FROM public.shop_orders WHERE status = 'freight_pending' FOR UPDATE SKIP LOCKED LOOP
    IF o.freight_reminded_at IS NULL AND o.freight_requested_at + make_interval(days => public.setting_int('shop_freight_reminder_days', 3)) <= now() THEN
      INSERT INTO public.notifications(user_id, type, title, message)
      VALUES(o.user_id, 'shop_freight_requested', 'Lembrete de frete', 'Pague o frete do seu pedido em Meus pedidos.');
      UPDATE public.shop_orders SET freight_reminded_at = now() WHERE id = o.id;
    END IF;
    IF o.freight_due_at <= now() THEN
      PERFORM public.buky_notify_admins('shop_freight_overdue', 'Frete não pago', o.id::text);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.admin_shop_set_shipping_mode(text), public.admin_shop_request_freight(uuid, integer, text, text), public.shop_pay_freight_with_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_shop_set_shipping_mode(text), public.admin_shop_request_freight(uuid, integer, text, text), public.shop_pay_freight_with_wallet(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.shop_begin_freight_checkout(uuid, uuid), public.shop_freight_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_begin_freight_checkout(uuid, uuid) TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'shop-freight-reminders';
    PERFORM cron.schedule('shop-freight-reminders', '0 12 * * *', 'SELECT public.shop_freight_reminders()');
  END IF;
END $$;
COMMIT;
