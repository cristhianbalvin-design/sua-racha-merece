-- Paso 27: saldo en R$, Premium acredita R$50, recargas, fotos gratis por año, compra a R$10, devoluciones.
\c - postgres
\i :sqldir/19_testadores_rutas.sql
\i :sqldir/24_recoleccion_bicicleta.sql
\i :sqldir/27_saldo_fotos_premium.sql
BEGIN;
INSERT INTO public.users (id, email, name, role, plan, created_at) VALUES
  ('27000000-0000-0000-0000-000000000001', 't27a@buky.test', 'Free', 'USUARIO', 'Freemium', now() - interval '400 days'),
  ('27000000-0000-0000-0000-000000000002', 't27b@buky.test', 'Pro', 'USUARIO', 'Freemium', now() - interval '20 days'),
  ('27000000-0000-0000-0000-0000000000ad', 't27adm@buky.test', 'Adm', 'ADMIN', 'Freemium', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.campaigns (id, name, status) VALUES ('27000000-0000-0000-0000-0000000000c1', 'C', 'Aberto') ON CONFLICT DO NOTHING;
INSERT INTO public.participations (user_id, campaign_id, status) VALUES
  ('27000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-0000000000c1', 'Qualificado'),
  ('27000000-0000-0000-0000-000000000002', '27000000-0000-0000-0000-0000000000c1', 'Qualificado');
INSERT INTO public.event_photos (id) SELECT ('27000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 9) i;
-- Pagos aprobados: Premium del usuario 2 y una recarga de R$20
INSERT INTO public.payments (id, user_id, provider, product, amount_cents, status) VALUES
  ('27000000-0000-0000-0000-0000000000a1', '27000000-0000-0000-0000-000000000002', 'mercadopago', 'premium_annual', 5000, 'approved'),
  ('27000000-0000-0000-0000-0000000000a2', '27000000-0000-0000-0000-000000000002', 'mercadopago', 'wallet_topup', 2000, 'approved');
COMMIT;

DO $$
DECLARE r jsonb;
BEGIN
  r := public.apply_premium_payment('27000000-0000-0000-0000-0000000000a1');
  IF (r ->> 'wallet_cents')::int <> 5000 THEN RAISE EXCEPTION 'premium %', r; END IF;
  r := public.apply_premium_payment('27000000-0000-0000-0000-0000000000a1');
  IF (r ->> 'applied')::boolean THEN RAISE EXCEPTION 'debe ser idempotente'; END IF;
  r := public.apply_premium_payment('27000000-0000-0000-0000-0000000000a2');
  IF (SELECT balance_cents FROM public.wallet_balances WHERE user_id = '27000000-0000-0000-0000-000000000002') <> 7000 THEN
    RAISE EXCEPTION 'saldo esperado R$70';
  END IF;
  IF NOT public.user_is_premium('27000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'debe ser Premium'; END IF;
END $$;

\c - authenticator
-- Freemium sin 300 Bukys: sin foto gratis; comprar exige confirmar; sin saldo no puede
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb; s jsonb;
BEGIN
  s := public.get_my_download_status();
  IF (s ->> 'free_total')::int <> 1 OR (s ->> 'free_remaining')::int <> 0 OR (s ->> 'free_eligible')::boolean THEN RAISE EXCEPTION 'estado free %', s; END IF;
  r := public.check_and_register_download('27000000-0000-0000-0000-000000000101');
  IF r ->> 'reason' <> 'purchase_required' OR (r ->> 'price_cents')::int <> 1000 THEN RAISE EXCEPTION 'sin confirmar %', r; END IF;
  r := public.check_and_register_download('27000000-0000-0000-0000-000000000101', true);
  IF r ->> 'reason' <> 'insufficient_balance' THEN RAISE EXCEPTION 'sin saldo %', r; END IF;
  -- La versión vieja de la app nunca cobra
  IF (public.check_and_register_download('27000000-0000-0000-0000-000000000101') ->> 'allowed')::boolean THEN RAISE EXCEPTION 'no debía bajar'; END IF;
END $$;
COMMIT;

\c - postgres
-- Con 300 Bukys corriendo, el Freemium tiene 1 foto gratis en su año (contado desde el registro)
SELECT public.apply_buky_movement('27000000-0000-0000-0000-000000000001', 'found', 300);
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb; s jsonb;
BEGIN
  s := public.get_my_download_status();
  IF (s ->> 'free_remaining')::int <> 1 THEN RAISE EXCEPTION 'debía tener 1 gratis %', s; END IF;
  -- Año desde el registro (hace 400 días): empezó hace 35 días
  IF (s ->> 'year_start')::timestamptz < now() - interval '40 days' OR (s ->> 'year_start')::timestamptz > now() - interval '30 days' THEN
    RAISE EXCEPTION 'inicio del año %', s ->> 'year_start';
  END IF;
  r := public.check_and_register_download('27000000-0000-0000-0000-000000000101');
  IF r ->> 'charged' <> 'free' THEN RAISE EXCEPTION 'gratis %', r; END IF;
  -- Volver a bajar la misma no gasta
  r := public.check_and_register_download('27000000-0000-0000-0000-000000000101');
  IF NOT (r ->> 'allowed')::boolean OR r ->> 'charged' <> 'none' THEN RAISE EXCEPTION 'volver a bajar %', r; END IF;
  IF (r -> 'status' ->> 'free_remaining')::int <> 0 THEN RAISE EXCEPTION 'cupo gastado'; END IF;
END $$;
COMMIT;

-- Premium: 3 gratis y después R$10 del saldo
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE r jsonb; i int; w jsonb;
BEGIN
  IF (public.get_my_download_status() ->> 'free_total')::int <> 3 THEN RAISE EXCEPTION 'premium 3 gratis'; END IF;
  FOR i IN 2 .. 4 LOOP
    r := public.check_and_register_download(('27000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid);
    IF r ->> 'charged' <> 'free' THEN RAISE EXCEPTION 'foto % gratis %', i, r; END IF;
  END LOOP;
  r := public.check_and_register_download('27000000-0000-0000-0000-000000000105', true);
  IF r ->> 'charged' <> 'wallet' OR (r -> 'status' ->> 'balance_cents')::int <> 6000 THEN RAISE EXCEPTION 'compra %', r; END IF;
  -- Doble clic: no cobra dos veces
  r := public.check_and_register_download('27000000-0000-0000-0000-000000000105', true);
  IF (r -> 'status' ->> 'balance_cents')::int <> 6000 THEN RAISE EXCEPTION 'cobró dos veces'; END IF;
  w := public.get_my_wallet();
  IF (w ->> 'balance_cents')::int <> 6000 OR jsonb_array_length(w -> 'movements') <> 3 THEN RAISE EXCEPTION 'cartera %', w; END IF;
  IF w -> 'topup_options' <> '[2000, 3000, 5000]'::jsonb THEN RAISE EXCEPTION 'opciones %', w -> 'topup_options'; END IF;
  -- El atleta no puede mover su saldo directo
  BEGIN
    PERFORM public.admin_wallet_adjust('27000000-0000-0000-0000-000000000002', 100000, 'yo');
    RAISE EXCEPTION 'no debía';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
COMMIT;

\c - postgres
-- Devolución en Mercado Pago de la recarga: se retira del saldo lo no usado (R$20)
DO $$
DECLARE r jsonb;
BEGIN
  UPDATE public.payments SET status = 'refunded' WHERE id = '27000000-0000-0000-0000-0000000000a2';
  r := public.revoke_premium_payment('27000000-0000-0000-0000-0000000000a2');
  IF (r ->> 'wallet_removed_cents')::int <> 2000 THEN RAISE EXCEPTION 'devolución %', r; END IF;
  IF NOT public.user_is_premium('27000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'la recarga no toca el Premium'; END IF;
  -- Aviso de vencimiento: una vez a los 15 días y otra a los 3
  UPDATE public.users SET premium_until = now() + interval '10 days' WHERE id = '27000000-0000-0000-0000-000000000002';
  IF public.premium_expiry_reminders() <> 1 OR public.premium_expiry_reminders() <> 0 THEN RAISE EXCEPTION 'aviso 15 días'; END IF;
END $$;

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-0000000000ad', true);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.admin_wallet_adjust('27000000-0000-0000-0000-000000000002', -1000, 'Devolução pedida por e-mail', true);
  IF (r ->> 'balance_cents')::int <> 3000 THEN RAISE EXCEPTION 'ajuste admin %', r; END IF;
  BEGIN
    PERFORM public.admin_wallet_adjust('27000000-0000-0000-0000-000000000002', -999999, 'x', true);
    RAISE EXCEPTION 'no debía dejar saldo negativo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'insufficient_balance' THEN RAISE; END IF; END;
END $$;
COMMIT;
