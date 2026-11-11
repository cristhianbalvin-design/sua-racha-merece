-- Pruebas del marketplace; los datos se revierten al final.
\c - postgres
\i :sqldir/27_saldo_fotos_premium.sql
\i :sqldir/28_patrocinadores_avisos.sql
\i :sqldir/32_marketplace.sql
BEGIN;
INSERT INTO public.users(id,email,name,role) VALUES
 ('32000000-0000-0000-0000-000000000001','t32a@buky.test','A','USUARIO'),
 ('32000000-0000-0000-0000-000000000002','t32b@buky.test','B','USUARIO'),
 ('32000000-0000-0000-0000-000000000003','t32admin@buky.test','Admin','ADMIN');
UPDATE public.app_settings SET value='true' WHERE key='shop_enabled';
INSERT INTO public.shop_products(id,slug,name,price_cents,active) VALUES ('32000000-0000-0000-0000-000000000010','teste-32','Camisa',1000,true);
INSERT INTO public.shop_variants(id,product_id,color,size,sku,stock) VALUES ('32000000-0000-0000-0000-000000000011','32000000-0000-0000-0000-000000000010','Azul','M','T32',1);
INSERT INTO public.shop_discounts(id,brand_name,title,code,active) VALUES ('32000000-0000-0000-0000-000000000012','Marca','Oferta','SEGREDO',true);
SELECT set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000001',true);
INSERT INTO public.shop_shipping_quotes(id,user_id,cep,items_hash,options,expires_at) VALUES
 ('32000000-0000-0000-0000-000000000020','32000000-0000-0000-0000-000000000001','24210470',public.shop_items_hash('[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]'), '[{"id":"1","company":"Teste","service":"PAC","price_cents":200,"days":3}]',now()+interval '1 hour');
DO $$ DECLARE oid uuid; items jsonb:='[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]'; addr jsonb:='{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niterói","uf":"RJ"}'; failed boolean:=false;
BEGIN
 INSERT INTO public.shop_shipping_quotes(id,user_id,cep,items_hash,options,expires_at) VALUES ('32000000-0000-0000-0000-000000000023',auth.uid(),'24210470',public.shop_items_hash(items),'[{"id":"1","company":"Teste","service":"PAC","price_cents":200}]',now()+interval '1 hour');
 oid:=public.shop_create_order(items,addr,'{"quote_id":"32000000-0000-0000-0000-000000000020","option_id":"1"}');
 IF (SELECT stock FROM public.shop_variants WHERE sku='T32')<>0 THEN RAISE EXCEPTION 'reserva'; END IF;
 BEGIN PERFORM public.shop_create_order(items,addr,'{"quote_id":"32000000-0000-0000-0000-000000000023","option_id":"1"}'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'sobreventa'; END IF;
 failed:=false; BEGIN PERFORM public.shop_pay_with_wallet(oid); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'saldo insuficiente'; END IF;
 PERFORM public.apply_wallet_movement('32000000-0000-0000-0000-000000000001',1200,'admin_adjustment','test','32','test32');
 PERFORM public.shop_pay_with_wallet(oid); PERFORM public.shop_pay_with_wallet(oid);
 IF (SELECT balance_cents FROM public.wallet_balances WHERE user_id='32000000-0000-0000-0000-000000000001')<>0 THEN RAISE EXCEPTION 'pago duplicado'; END IF;
 failed:=false; BEGIN PERFORM public.shop_request_exchange(oid,'M'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'cambio inválido'; END IF;
 UPDATE public.shop_orders SET status='delivered',delivered_at=now()-interval '8 days' WHERE id=oid;
 failed:=false; BEGIN PERFORM public.shop_request_exchange(oid,'M'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'cambio fuera de plazo'; END IF;
 IF (public.shop_reveal_discount('32000000-0000-0000-0000-000000000012')->>'code')<>'SEGREDO' THEN RAISE EXCEPTION 'código'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shop_discount_reveals WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'revelado'; END IF;
 IF to_jsonb((SELECT d FROM public.shop_public_discounts() d WHERE id='32000000-0000-0000-0000-000000000012')) ? 'code' THEN RAISE EXCEPTION 'código público'; END IF;
 PERFORM set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000003',true);
 failed:=false; BEGIN PERFORM public.admin_shop_update_order(oid,'shipped','a','https://example.com',NULL); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'transición inválida'; END IF;
END $$;
-- Reserva vencida se libera una sola vez.
UPDATE public.shop_variants SET stock=1 WHERE sku='T32';
SELECT set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000001',true);
INSERT INTO public.shop_shipping_quotes(id,user_id,cep,items_hash,options,expires_at) VALUES ('32000000-0000-0000-0000-000000000021',auth.uid(),'24210470',public.shop_items_hash('[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]'),'[{"id":"1","company":"Teste","service":"PAC","price_cents":200}]',now()+interval '1 hour');
DO $$ DECLARE oid uuid; BEGIN
 oid:=public.shop_create_order('[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]','{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niterói","uf":"RJ"}','{"quote_id":"32000000-0000-0000-0000-000000000021","option_id":"1"}');
 UPDATE public.shop_orders SET reserved_until=now()-interval '1 minute' WHERE id=oid;
 PERFORM public.shop_release_expired(); PERFORM public.shop_release_expired();
 IF (SELECT stock FROM public.shop_variants WHERE sku='T32')<>1 THEN RAISE EXCEPTION 'liberación'; END IF;
END $$;
-- Aplicar y revertir un pago de Mercado Pago.
INSERT INTO public.shop_shipping_quotes(id,user_id,cep,items_hash,options,expires_at) VALUES ('32000000-0000-0000-0000-000000000022',auth.uid(),'24210470',public.shop_items_hash('[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]'),'[{"id":"1","company":"Teste","service":"PAC","price_cents":200}]',now()+interval '1 hour');
DO $$ DECLARE oid uuid; pid uuid; BEGIN
 oid:=public.shop_create_order('[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]','{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niterói","uf":"RJ"}','{"quote_id":"32000000-0000-0000-0000-000000000022","option_id":"1"}');
 pid:=public.shop_begin_checkout(oid,auth.uid());
 UPDATE public.payments SET status='approved' WHERE id=pid;
 PERFORM public.apply_premium_payment(pid); PERFORM public.apply_premium_payment(pid);
 IF (SELECT status FROM public.shop_orders WHERE id=oid)<>'paid' THEN RAISE EXCEPTION 'pago MP'; END IF;
 UPDATE public.payments SET status='refunded' WHERE id=pid;
 PERFORM public.revoke_premium_payment(pid); PERFORM public.revoke_premium_payment(pid);
 IF (SELECT stock FROM public.shop_variants WHERE sku='T32')<>1 THEN RAISE EXCEPTION 'reembolso MP'; END IF;
END $$;
-- Pago tardío (después de liberada la reserva): si hay stock se vuelve a reservar; si no, se devuelve al saldo.
DO $$ DECLARE oid uuid; pid uuid; r jsonb;
  items jsonb := '[{"variant_id":"32000000-0000-0000-0000-000000000011","qty":1}]';
  addr jsonb := '{"recipient":"A","phone":"123","cep":"24210470","street":"Rua","number":"1","district":"Centro","city":"Niterói","uf":"RJ"}';
  bal_before bigint;
BEGIN
  UPDATE public.shop_variants SET stock = 1 WHERE sku = 'T32';
  INSERT INTO public.shop_shipping_quotes(id,user_id,cep,items_hash,options,expires_at) VALUES
    ('32000000-0000-0000-0000-000000000024', auth.uid(), '24210470', public.shop_items_hash(items),
     '[{"id":"1","company":"Teste","service":"PAC","price_cents":200}]', now() + interval '1 hour');
  oid := public.shop_create_order(items, addr, '{"quote_id":"32000000-0000-0000-0000-000000000024","option_id":"1"}');
  pid := public.shop_begin_checkout(oid, auth.uid());
  UPDATE public.shop_orders SET reserved_until = now() - interval '1 minute' WHERE id = oid;
  PERFORM public.shop_release_expired();
  UPDATE public.payments SET status = 'approved' WHERE id = pid;
  r := public.apply_premium_payment(pid);
  IF (SELECT status FROM public.shop_orders WHERE id = oid) <> 'paid'
     OR (SELECT stock FROM public.shop_variants WHERE sku = 'T32') <> 0 THEN
    RAISE EXCEPTION 'pago tardío con stock debe re-reservar: %', r;
  END IF;

  UPDATE public.shop_variants SET stock = 1 WHERE sku = 'T32';
  INSERT INTO public.shop_shipping_quotes(id,user_id,cep,items_hash,options,expires_at) VALUES
    ('32000000-0000-0000-0000-000000000025', auth.uid(), '24210470', public.shop_items_hash(items),
     '[{"id":"1","company":"Teste","service":"PAC","price_cents":200}]', now() + interval '1 hour');
  oid := public.shop_create_order(items, addr, '{"quote_id":"32000000-0000-0000-0000-000000000025","option_id":"1"}');
  pid := public.shop_begin_checkout(oid, auth.uid());
  UPDATE public.shop_orders SET reserved_until = now() - interval '1 minute' WHERE id = oid;
  PERFORM public.shop_release_expired();
  UPDATE public.shop_variants SET stock = 0 WHERE sku = 'T32';  -- otro comprador se llevó la última
  SELECT coalesce(balance_cents, 0) INTO bal_before FROM public.wallet_balances WHERE user_id = auth.uid();
  UPDATE public.payments SET status = 'approved' WHERE id = pid;
  r := public.apply_premium_payment(pid);
  PERFORM public.apply_premium_payment(pid);  -- idempotente
  IF (SELECT status FROM public.shop_orders WHERE id = oid) <> 'cancelled'
     OR (SELECT balance_cents FROM public.wallet_balances WHERE user_id = auth.uid()) <> coalesce(bal_before, 0) + 1200
     OR (SELECT stock FROM public.shop_variants WHERE sku = 'T32') <> 0 THEN
    RAISE EXCEPTION 'pago tardío sin stock debe devolver al saldo: %', r;
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.shop_orders WHERE user_id='32000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'RLS'; END IF; END $$;
ROLLBACK;
