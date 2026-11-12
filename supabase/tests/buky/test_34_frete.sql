-- Pruebas del frete; los datos se revierten al final.
\c - postgres
\i :sqldir/27_saldo_fotos_premium.sql
\i :sqldir/28_patrocinadores_avisos.sql
\i :sqldir/32_marketplace.sql
\i :sqldir/34_frete_a_combinar.sql
\i :sqldir/34_frete_a_combinar.sql
BEGIN;
INSERT INTO public.users(id, email, name, role) VALUES
  ('34000000-0000-0000-0000-000000000001', 't34@buky.test', 'Atleta', 'USUARIO'),
  ('34000000-0000-0000-0000-000000000002', 't34admin@buky.test', 'Admin', 'ADMIN');
UPDATE public.app_settings SET value = 'true' WHERE key = 'shop_enabled';
INSERT INTO public.shop_products(id, slug, name, price_cents, active)
VALUES ('34000000-0000-0000-0000-000000000010', 'teste-34', 'Camisa', 1000, true);
INSERT INTO public.shop_variants(id, product_id, color, size, sku, stock)
VALUES ('34000000-0000-0000-0000-000000000011', '34000000-0000-0000-0000-000000000010', 'Azul', 'M', 'T34', 10);
SELECT set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE
  oid uuid;
  pid uuid;
  failed boolean;
  items jsonb := '[{"variant_id":"34000000-0000-0000-0000-000000000011","qty":1}]';
  addr jsonb := '{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niterói","uf":"RJ"}';
BEGIN
  oid := public.shop_create_order(items, addr, NULL);
  IF (SELECT shipping_cents FROM public.shop_orders WHERE id = oid) <> 0 THEN RAISE EXCEPTION 'frete inicial'; END IF;
  PERFORM public.apply_wallet_movement(auth.uid(), 1000, 'admin_adjustment', 'test', '34', 'test34');
  PERFORM public.shop_pay_with_wallet(oid);
  IF (SELECT status FROM public.shop_orders WHERE id = oid) <> 'awaiting_freight' THEN RAISE EXCEPTION 'estado'; END IF;
  failed := false;
  BEGIN PERFORM public.admin_shop_request_freight(oid, 100, 'Teste', NULL); EXCEPTION WHEN OTHERS THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'solo admin'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000002', true);
  failed := false;
  BEGIN PERFORM public.admin_shop_request_freight(oid, 0, 'Teste', NULL); EXCEPTION WHEN OTHERS THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'valor inválido'; END IF;
  PERFORM public.admin_shop_request_freight(oid, 100, 'Teste', NULL);
  PERFORM set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
  failed := false;
  BEGIN PERFORM public.shop_pay_freight_with_wallet(oid); EXCEPTION WHEN OTHERS THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'saldo insuficiente'; END IF;
  PERFORM public.apply_wallet_movement(auth.uid(), 100, 'admin_adjustment', 'test', '34', 'test34freight');
  PERFORM public.shop_pay_freight_with_wallet(oid);
  PERFORM public.shop_pay_freight_with_wallet(oid);
  IF (SELECT status FROM public.shop_orders WHERE id = oid) <> 'preparing' OR
     (SELECT balance_cents FROM public.wallet_balances WHERE user_id = auth.uid()) <> 0 THEN RAISE EXCEPTION 'pago duplicado'; END IF;
  -- Cancelación de productos y frete pagados con saldo.
  PERFORM set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000002', true);
  PERFORM public.admin_shop_update_order(oid, 'cancelled');
  IF (SELECT stock FROM public.shop_variants WHERE sku = 'T34') <> 10 OR
     (SELECT balance_cents FROM public.wallet_balances WHERE user_id = '34000000-0000-0000-0000-000000000001') <> 1100 THEN RAISE EXCEPTION 'reembolso'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
  oid := public.shop_create_order(items, addr, NULL);
  PERFORM public.shop_pay_with_wallet(oid);
  PERFORM set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000002', true);
  PERFORM public.admin_shop_request_freight(oid, 100, 'Teste', NULL);
  UPDATE public.shop_orders SET freight_requested_at = now() - interval '4 days' WHERE id = oid;
  PERFORM public.shop_freight_reminders();
  PERFORM public.shop_freight_reminders();
  IF (SELECT count(*) FROM public.notifications WHERE user_id = '34000000-0000-0000-0000-000000000001' AND title = 'Lembrete de frete') <> 1 THEN RAISE EXCEPTION 'recordatorio duplicado'; END IF;
  pid := public.shop_begin_freight_checkout(oid, '34000000-0000-0000-0000-000000000001');
  UPDATE public.payments SET status = 'approved' WHERE id = pid;
  PERFORM public.apply_premium_payment(pid);
  IF (SELECT status FROM public.shop_orders WHERE id = oid) <> 'preparing' THEN RAISE EXCEPTION 'frete MP'; END IF;
  UPDATE public.payments SET status = 'refunded' WHERE id = pid;
  PERFORM public.revoke_premium_payment(pid);
  IF (SELECT status FROM public.shop_orders WHERE id = oid) <> 'freight_pending' THEN RAISE EXCEPTION 'revocación MP'; END IF;
  pid := public.shop_begin_freight_checkout(oid, '34000000-0000-0000-0000-000000000001');
  PERFORM public.admin_shop_update_order(oid, 'cancelled');
  UPDATE public.payments SET status = 'approved' WHERE id = pid;
  PERFORM public.apply_premium_payment(pid);
  IF (SELECT balance_cents FROM public.wallet_balances WHERE user_id = '34000000-0000-0000-0000-000000000001') <> 1200 THEN RAISE EXCEPTION 'frete tardío'; END IF;
END $$;
-- Cancelacion antes de definir el frete devuelve saldo y stock.
SELECT set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE
  oid uuid;
  items jsonb := '[{"variant_id":"34000000-0000-0000-0000-000000000011","qty":1}]';
  addr jsonb := '{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niteroi","uf":"RJ"}';
  balance_before bigint;
  stock_before integer;
BEGIN
  SELECT balance_cents INTO balance_before FROM public.wallet_balances WHERE user_id = auth.uid();
  SELECT stock INTO stock_before FROM public.shop_variants WHERE sku = 'T34';
  oid := public.shop_create_order(items, addr, NULL);
  PERFORM public.shop_pay_with_wallet(oid);
  PERFORM set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000002', true);
  PERFORM public.admin_shop_update_order(oid, 'cancelled');
  IF (SELECT balance_cents FROM public.wallet_balances WHERE user_id = '34000000-0000-0000-0000-000000000001') <> balance_before
     OR (SELECT stock FROM public.shop_variants WHERE sku = 'T34') <> stock_before THEN
    RAISE EXCEPTION 'cancelacion awaiting_freight';
  END IF;
END $$;
-- La cotizacion automatica conserva el precio de la opcion elegida.
UPDATE public.app_settings SET value = '"quote"' WHERE key = 'shop_shipping_mode';
SELECT set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE
  oid uuid;
  items jsonb := '[{"variant_id":"34000000-0000-0000-0000-000000000011","qty":1}]';
  addr jsonb := '{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niteroi","uf":"RJ"}';
BEGIN
  INSERT INTO public.shop_shipping_quotes(id, user_id, cep, items_hash, options, expires_at)
  VALUES ('34000000-0000-0000-0000-000000000020', auth.uid(), '24210470', public.shop_items_hash(items),
    '[{"id":"1","company":"Teste","service":"PAC","price_cents":200}]', now() + interval '1 hour');
  oid := public.shop_create_order(items, addr, '{"quote_id":"34000000-0000-0000-0000-000000000020","option_id":"1"}');
  IF (SELECT total_cents FROM public.shop_orders WHERE id = oid) <> 1200 THEN RAISE EXCEPTION 'cotizacion'; END IF;
END $$;
ROLLBACK;
