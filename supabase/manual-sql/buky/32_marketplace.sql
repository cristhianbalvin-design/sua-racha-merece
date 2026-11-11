-- Paso 32: tienda, reservas, pagos y descuentos. Ejecutar después del paso 30.
BEGIN;
INSERT INTO public.app_settings(key,value,description) VALUES
 ('shop_enabled','false','Habilitar la tienda'),
 ('shop_origin_cep','"24210470"','CEP de origen'),
 ('shop_default_package','{"weight_kg":0.5,"width_cm":25,"height_cm":5,"length_cm":30}','Paquete por defecto'),
 ('shop_exchange_days','7','Plazo para solicitar cambio'),
 ('shop_reservation_minutes','30','Duración de la reserva') ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_reason_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check CHECK (reason IN ('premium_bonus','topup','photo_purchase','payment_reverted','admin_refund','admin_adjustment','shop_purchase','shop_refund'));
CREATE TABLE IF NOT EXISTS public.shop_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', images text[] NOT NULL DEFAULT '{}', price_cents integer NOT NULL CHECK(price_cents>0), active boolean NOT NULL DEFAULT false,
 weight_kg numeric NOT NULL DEFAULT 0.5 CHECK(weight_kg>0), width_cm numeric NOT NULL DEFAULT 25 CHECK(width_cm>0), height_cm numeric NOT NULL DEFAULT 5 CHECK(height_cm>0), length_cm numeric NOT NULL DEFAULT 30 CHECK(length_cm>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.shop_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.shop_products(id), color text NOT NULL, size text NOT NULL, sku text NOT NULL UNIQUE, stock integer NOT NULL DEFAULT 0 CHECK(stock>=0), active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS public.shop_shipping_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id), cep text NOT NULL, items_hash text NOT NULL, options jsonb NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.shop_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id), status text NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','preparing','shipped','delivered','cancelled','exchange_requested','exchanged')),
 items_cents integer NOT NULL CHECK(items_cents>0), shipping_cents integer NOT NULL CHECK(shipping_cents>=0), total_cents integer NOT NULL CHECK(total_cents=items_cents+shipping_cents), payment_method text CHECK(payment_method IN ('mercadopago','wallet')), payment_id uuid REFERENCES public.payments(id), shipping_service text NOT NULL, shipping_quote jsonb NOT NULL, address jsonb NOT NULL,
 tracking_code text, tracking_url text, paid_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, exchange_requested_at timestamptz, exchange_note text, reserved_until timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.shop_order_items (
 order_id uuid NOT NULL REFERENCES public.shop_orders(id), variant_id uuid NOT NULL REFERENCES public.shop_variants(id), product_name text NOT NULL, color text NOT NULL, size text NOT NULL, unit_cents integer NOT NULL CHECK(unit_cents>0), qty integer NOT NULL CHECK(qty>0), PRIMARY KEY(order_id,variant_id));
CREATE TABLE IF NOT EXISTS public.shop_discounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sponsor_id uuid REFERENCES public.buky_sponsors(id), brand_name text NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', conditions text NOT NULL DEFAULT '', code text, link_url text, image_url text, valid_until timestamptz, active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.shop_discount_reveals (
 discount_id uuid NOT NULL REFERENCES public.shop_discounts(id), user_id uuid NOT NULL REFERENCES public.users(id), revealed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(discount_id,user_id));
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_discount_reveals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_products_read ON public.shop_products;
CREATE POLICY shop_products_read ON public.shop_products FOR SELECT USING (active OR public.is_admin());
DROP POLICY IF EXISTS shop_products_admin ON public.shop_products;
CREATE POLICY shop_products_admin ON public.shop_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS shop_variants_read ON public.shop_variants;
CREATE POLICY shop_variants_read ON public.shop_variants FOR SELECT USING ((active AND EXISTS(SELECT 1 FROM public.shop_products p WHERE p.id=product_id AND p.active)) OR public.is_admin());
DROP POLICY IF EXISTS shop_variants_admin ON public.shop_variants;
CREATE POLICY shop_variants_admin ON public.shop_variants FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS shop_orders_read ON public.shop_orders;
CREATE POLICY shop_orders_read ON public.shop_orders FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS shop_items_read ON public.shop_order_items;
CREATE POLICY shop_items_read ON public.shop_order_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.shop_orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS shop_quotes_read ON public.shop_shipping_quotes;
CREATE POLICY shop_quotes_read ON public.shop_shipping_quotes FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS shop_discounts_admin ON public.shop_discounts;
CREATE POLICY shop_discounts_admin ON public.shop_discounts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS shop_reveals_read ON public.shop_discount_reveals;
CREATE POLICY shop_reveals_read ON public.shop_discount_reveals FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
REVOKE ALL ON public.shop_shipping_quotes,public.shop_orders,public.shop_order_items,public.shop_discount_reveals FROM anon,authenticated;
GRANT SELECT ON public.shop_shipping_quotes,public.shop_orders,public.shop_order_items,public.shop_discount_reveals TO authenticated;
REVOKE ALL ON public.shop_discounts FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.shop_discounts TO authenticated;
REVOKE ALL ON public.shop_products,public.shop_variants FROM anon,authenticated;
GRANT SELECT ON public.shop_products,public.shop_variants TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.shop_products,public.shop_variants TO authenticated;

-- La representación canónica liga la cotización a las variantes y cantidades exactas.
CREATE OR REPLACE FUNCTION public.shop_items_hash(p_items jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT pg_catalog.md5(coalesce(jsonb_agg(jsonb_build_object('variant_id',x.variant_id,'qty',x.qty) ORDER BY x.variant_id)::text,'[]'))
 FROM (SELECT (v->>'variant_id')::uuid AS variant_id, sum((v->>'qty')::integer)::integer AS qty FROM jsonb_array_elements(p_items) v GROUP BY 1) x
$$;
CREATE OR REPLACE FUNCTION public.shop_quote_package(p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE n int; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 OR jsonb_array_length(p_items)>100 THEN RAISE EXCEPTION 'invalid_items'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE coalesce((x->>'qty')::int,0)<1 OR (x->>'qty')::int>100) THEN RAISE EXCEPTION 'invalid_items'; END IF;
 SELECT count(*),jsonb_build_object('weight',sum(p.weight_kg*x.qty),'width',max(p.width_cm),'height',max(p.height_cm),'length',max(p.length_cm)) INTO n,result
 FROM (SELECT (v->>'variant_id')::uuid id,sum((v->>'qty')::int)::int qty FROM jsonb_array_elements(p_items) v GROUP BY 1) x
 JOIN public.shop_variants v ON v.id=x.id AND v.active AND v.stock>=x.qty JOIN public.shop_products p ON p.id=v.product_id AND p.active;
 IF n<>(SELECT count(DISTINCT v->>'variant_id') FROM jsonb_array_elements(p_items) v) THEN RAISE EXCEPTION 'invalid_stock'; END IF;
 RETURN jsonb_build_object('package',result,'items_hash',public.shop_items_hash(p_items));
END $$;
CREATE OR REPLACE FUNCTION public.shop_create_order(p_items jsonb,p_address jsonb,p_shipping jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE q public.shop_shipping_quotes%ROWTYPE; opt jsonb; x record; oid uuid; subtotal bigint:=0; shipping int; unit_price integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF NOT coalesce((SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key='shop_enabled'),false) AND NOT public.is_admin() THEN RAISE EXCEPTION 'shop_disabled'; END IF;
 PERFORM public.shop_quote_package(p_items);
 SELECT * INTO q FROM public.shop_shipping_quotes WHERE id=(p_shipping->>'quote_id')::uuid AND user_id=auth.uid() AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR q.items_hash<>public.shop_items_hash(p_items) OR q.cep<>regexp_replace(coalesce(p_address->>'cep',''),'[^0-9]','','g') THEN RAISE EXCEPTION 'invalid_quote'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['recipient','phone','street','number','district','city','uf']) k WHERE length(trim(coalesce(p_address->>k,'')))=0) THEN RAISE EXCEPTION 'invalid_address'; END IF;
 SELECT value INTO opt FROM jsonb_array_elements(q.options) WHERE value->>'id'=p_shipping->>'option_id';
 IF opt IS NULL THEN RAISE EXCEPTION 'invalid_shipping_option'; END IF;
 shipping:=(opt->>'price_cents')::int; IF shipping<0 THEN RAISE EXCEPTION 'invalid_shipping'; END IF;
 -- Orden estable evita bloqueos cruzados; el UPDATE condicional impide sobreventa.
 FOR x IN SELECT (v->>'variant_id')::uuid id,sum((v->>'qty')::int)::int qty FROM jsonb_array_elements(p_items) v GROUP BY 1 ORDER BY 1 LOOP
   UPDATE public.shop_variants SET stock=stock-x.qty WHERE id=x.id AND active AND stock>=x.qty;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_stock'; END IF;
   SELECT p.price_cents INTO unit_price FROM public.shop_variants v JOIN public.shop_products p ON p.id=v.product_id WHERE v.id=x.id AND p.active FOR SHARE OF p;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_product'; END IF;
   subtotal:=subtotal + unit_price*x.qty;
 END LOOP;
 INSERT INTO public.shop_orders(user_id,items_cents,shipping_cents,total_cents,shipping_service,shipping_quote,address,reserved_until)
 VALUES(auth.uid(),subtotal,shipping,subtotal+shipping,concat_ws(' - ',opt->>'company',opt->>'service'),opt,p_address,now()+make_interval(mins=>public.setting_int('shop_reservation_minutes',30))) RETURNING id INTO oid;
 INSERT INTO public.shop_order_items (order_id, variant_id, product_name, color, size, unit_cents, qty)
 SELECT oid, v.id, p.name, v.color, v.size, p.price_cents, it.qty
 FROM (SELECT (j->>'variant_id')::uuid AS vid, sum((j->>'qty')::int)::int AS qty FROM jsonb_array_elements(p_items) j GROUP BY 1) it
 JOIN public.shop_variants v ON v.id = it.vid
 JOIN public.shop_products p ON p.id = v.product_id;
 DELETE FROM public.shop_shipping_quotes WHERE id=q.id;
 RETURN oid;
END $$;
CREATE OR REPLACE FUNCTION public.shop_restore_stock(p_order uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
 UPDATE public.shop_variants v SET stock=v.stock+i.qty FROM public.shop_order_items i WHERE i.order_id=p_order AND i.variant_id=v.id
$$;
CREATE OR REPLACE FUNCTION public.shop_release_expired() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o record; n int:=0;
BEGIN
 FOR o IN SELECT id FROM public.shop_orders WHERE status='pending_payment' AND reserved_until<=now() FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.shop_orders SET status='cancelled' WHERE id=o.id; PERFORM public.shop_restore_stock(o.id); n:=n+1; END LOOP; RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.shop_pay_with_wallet(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.shop_orders WHERE id=p_order_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
 IF o.status='paid' AND o.payment_method='wallet' THEN RETURN jsonb_build_object('paid',true,'duplicate',true); END IF;
 IF o.status<>'pending_payment' OR o.reserved_until<=now() OR o.payment_id IS NOT NULL THEN RAISE EXCEPTION 'order_not_payable'; END IF;
 PERFORM public.apply_wallet_movement(o.user_id,-o.total_cents,'shop_purchase','shop_order',o.id::text,'shop:'||o.id::text);
 UPDATE public.shop_orders SET status='paid',payment_method='wallet',paid_at=now() WHERE id=o.id;
 INSERT INTO public.notifications(user_id,type,title,message) VALUES(o.user_id,'shop_order_paid','Pagamento confirmado','Seu pedido foi pago.');
 RETURN jsonb_build_object('paid',true,'duplicate',false);
END $$;
CREATE OR REPLACE FUNCTION public.admin_shop_update_order(p_order_id uuid,p_status text,p_tracking_code text DEFAULT NULL,p_tracking_url text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT * INTO o FROM public.shop_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
 IF NOT ((o.status='paid' AND p_status IN ('preparing','cancelled')) OR (o.status='pending_payment' AND p_status='cancelled') OR (o.status='preparing' AND p_status IN ('shipped','cancelled')) OR (o.status='shipped' AND p_status='delivered') OR (o.status='exchange_requested' AND p_status='exchanged')) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
 IF p_status='shipped' AND (coalesce(trim(p_tracking_code),'')='' OR coalesce(trim(p_tracking_url),'')='') THEN RAISE EXCEPTION 'tracking_required'; END IF;
 IF p_status='cancelled' THEN
 PERFORM public.shop_restore_stock(o.id);
 IF o.payment_method='wallet' AND o.paid_at IS NOT NULL THEN PERFORM public.apply_wallet_movement(o.user_id,o.total_cents,'shop_refund','shop_order',o.id::text,'shop_refund:'||o.id::text,p_note,auth.uid()); END IF;
 END IF;
 UPDATE public.shop_orders SET status=p_status,tracking_code=coalesce(p_tracking_code,tracking_code),tracking_url=coalesce(p_tracking_url,tracking_url),shipped_at=CASE WHEN p_status='shipped' THEN now() ELSE shipped_at END,delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END WHERE id=o.id;
 IF p_status IN ('shipped','delivered') THEN INSERT INTO public.notifications(user_id,type,title,message) VALUES(o.user_id,'shop_order_'||p_status,CASE WHEN p_status='shipped' THEN 'Pedido enviado' ELSE 'Pedido entregue' END,'Confira os detalhes do seu pedido.'); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.shop_request_exchange(p_order_id uuid,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 UPDATE public.shop_orders SET status='exchange_requested',exchange_requested_at=now(),exchange_note=p_note WHERE id=p_order_id AND user_id=auth.uid() AND status='delivered' AND delivered_at IS NOT NULL AND now()<=delivered_at+make_interval(days=>public.setting_int('shop_exchange_days',7));
 IF NOT FOUND THEN RAISE EXCEPTION 'exchange_unavailable'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.shop_public_discounts() RETURNS TABLE(id uuid,sponsor_id uuid,brand_name text,title text,description text,conditions text,image_url text,valid_until timestamptz,created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT d.id,d.sponsor_id,d.brand_name,d.title,d.description,d.conditions,d.image_url,d.valid_until,d.created_at FROM public.shop_discounts d WHERE d.active AND (d.valid_until IS NULL OR d.valid_until>now())
$$;
CREATE OR REPLACE FUNCTION public.shop_reveal_discount(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE d public.shop_discounts%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT * INTO d FROM public.shop_discounts WHERE id=p_id AND active AND (valid_until IS NULL OR valid_until>now()); IF NOT FOUND THEN RAISE EXCEPTION 'discount_not_found'; END IF;
 INSERT INTO public.shop_discount_reveals(discount_id,user_id) VALUES(d.id,auth.uid()) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('code',d.code,'link_url',d.link_url);
END $$;
REVOKE ALL ON FUNCTION public.shop_restore_stock(uuid),public.shop_release_expired() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shop_quote_package(jsonb),public.shop_create_order(jsonb,jsonb,jsonb),public.shop_pay_with_wallet(uuid),public.admin_shop_update_order(uuid,text,text,text,text),public.shop_request_exchange(uuid,text),public.shop_reveal_discount(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shop_quote_package(jsonb),public.shop_create_order(jsonb,jsonb,jsonb),public.shop_pay_with_wallet(uuid),public.admin_shop_update_order(uuid,text,text,text,text),public.shop_request_exchange(uuid,text),public.shop_reveal_discount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_public_discounts() TO anon,authenticated;
INSERT INTO storage.buckets(id,name,public) VALUES('shop-images','shop-images',true) ON CONFLICT(id) DO UPDATE SET public=true;
DROP POLICY IF EXISTS shop_images_read ON storage.objects;
CREATE POLICY shop_images_read ON storage.objects FOR SELECT USING(bucket_id='shop-images');
DROP POLICY IF EXISTS shop_images_admin ON storage.objects;
CREATE POLICY shop_images_admin ON storage.objects FOR ALL TO authenticated USING(bucket_id='shop-images' AND public.is_admin()) WITH CHECK(bucket_id='shop-images' AND public.is_admin());
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='shop-release-expired'; PERFORM cron.schedule('shop-release-expired','*/5 * * * *','SELECT public.shop_release_expired()'); END IF; END $$;
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

  IF v_payment.product = 'shop_order' THEN
    SELECT * INTO v_order FROM public.shop_orders
    WHERE payment_id = v_payment.id AND user_id = v_payment.user_id FOR UPDATE;

    IF FOUND AND v_order.total_cents = v_payment.amount_cents AND v_order.status = 'pending_payment' THEN
      -- Caso normal (aunque la reserva haya vencido hace instantes: el stock sigue descontado).
      UPDATE public.shop_orders SET status = 'paid', paid_at = now(), payment_method = 'mercadopago' WHERE id = v_order.id;
      v_shop_ok := true;
    ELSIF FOUND AND v_order.total_cents = v_payment.amount_cents AND v_order.status = 'cancelled' AND v_order.paid_at IS NULL THEN
      -- Pago tardío: la reserva venció y el stock se liberó. Se intenta reservar de nuevo todo el pedido;
      -- si falta alguna unidad, no se vende y el monto pagado vuelve al saldo del atleta.
      BEGIN
        FOR v_item IN SELECT variant_id, qty FROM public.shop_order_items WHERE order_id = v_order.id ORDER BY variant_id LOOP
          UPDATE public.shop_variants SET stock = stock - v_item.qty WHERE id = v_item.variant_id AND stock >= v_item.qty;
          IF NOT FOUND THEN RAISE EXCEPTION 'late_payment_no_stock'; END IF;
        END LOOP;
        UPDATE public.shop_orders SET status = 'paid', paid_at = now(), payment_method = 'mercadopago' WHERE id = v_order.id;
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
IF NEW.type NOT IN ('buky_raffle_won','buky_raffle_substitute','premium_expiring','shop_order_paid','shop_order_shipped','shop_order_delivered','shop_order_refunded') AND NOT admin_notice THEN
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
-- La Edge Function crea el registro bajo bloqueo para evitar pagos simultáneos.
CREATE OR REPLACE FUNCTION public.shop_begin_checkout(p_order_id uuid,p_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.shop_orders%ROWTYPE; pid uuid;
BEGIN
 SELECT * INTO o FROM public.shop_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'pending_payment' OR o.reserved_until<=now() OR o.payment_id IS NOT NULL THEN RAISE EXCEPTION 'order_not_payable'; END IF;
 INSERT INTO public.payments(user_id,provider,product,amount_cents,currency,status) VALUES(o.user_id,'mercadopago','shop_order',o.total_cents,'BRL','pending') RETURNING id INTO pid;
 UPDATE public.shop_orders SET payment_id=pid,payment_method='mercadopago' WHERE id=o.id;
 RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.shop_begin_checkout(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_begin_checkout(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.admin_shop_set_enabled(p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
 UPDATE public.app_settings SET value=to_jsonb(p_enabled),updated_at=now() WHERE key='shop_enabled';
END $$;
REVOKE ALL ON FUNCTION public.admin_shop_set_enabled(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_shop_set_enabled(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.shop_is_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT coalesce((SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key='shop_enabled'),false) OR coalesce(public.is_admin(),false)
$$;
GRANT EXECUTE ON FUNCTION public.shop_is_enabled() TO anon,authenticated;
COMMIT;
