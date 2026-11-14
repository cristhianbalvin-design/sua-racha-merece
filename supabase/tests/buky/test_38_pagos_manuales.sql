\c - postgres
DELETE FROM public.app_settings WHERE key = 'payments_manual_started_once';
\i :sqldir/38_pagos_manuales.sql
DO $$ BEGIN
 IF public.app_payments_config()->>'mode' <> 'manual' OR public.app_payments_config()->>'contact_email' <> 'contato@3buk.com' OR public.shop_is_enabled() THEN RAISE EXCEPTION 'configuración inicial'; END IF;
END $$;
UPDATE public.app_settings SET value = '"mercadopago"' WHERE key = 'payments_mode';
UPDATE public.app_settings SET value = 'true' WHERE key = 'shop_enabled';
\i :sqldir/38_pagos_manuales.sql
DO $$ BEGIN
 IF public.app_payments_config()->>'mode' <> 'mercadopago' OR NOT public.shop_is_enabled() THEN RAISE EXCEPTION 're-ejecución sobrescribió cambios'; END IF;
END $$;
INSERT INTO public.users (id,email,name,role,plan,created_at) VALUES
 ('38000000-0000-0000-0000-000000000001','t38@buky.test','Atleta','USUARIO','Freemium',now()),
 ('38000000-0000-0000-0000-000000000002','t38admin@buky.test','Admin','ADMIN','Freemium',now()) ON CONFLICT (id) DO NOTHING;
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '38000000-0000-0000-0000-000000000002', true);
DO $$ DECLARE r jsonb; BEGIN
 r := public.admin_grant_premium('38000000-0000-0000-0000-000000000001', 12, 'Pix');
 IF (r->>'premium_until')::timestamptz < now() + interval '1 year' - interval '1 second' OR (r->>'wallet_cents')::int <> 5000 THEN RAISE EXCEPTION 'Premium %', r; END IF;
 BEGIN PERFORM public.admin_grant_premium('38000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'doble clic aceptado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'grant_too_recent' THEN RAISE; END IF; END;
 r := public.admin_wallet_credit('38000000-0000-0000-0000-000000000001', 2500, 'Pix');
 IF (r->>'balance_cents')::int <> 7500 THEN RAISE EXCEPTION 'saldo %', r; END IF;
 BEGIN PERFORM public.admin_wallet_credit('38000000-0000-0000-0000-000000000001', 99, 'Pix'); RAISE EXCEPTION 'límite inferior'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid_credit' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_wallet_credit('38000000-0000-0000-0000-000000000001', 100001, 'Pix'); RAISE EXCEPTION 'límite superior'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid_credit' THEN RAISE; END IF; END;
END $$;
COMMIT;
\c - postgres
DO $$ BEGIN
 IF (SELECT count(*) FROM public.wallet_ledger WHERE user_id='38000000-0000-0000-0000-000000000001' AND reason='premium_bonus') <> 1 OR NOT EXISTS (SELECT 1 FROM public.wallet_ledger WHERE user_id='38000000-0000-0000-0000-000000000001' AND ref_type='manual_payment' AND delta_cents=2500) THEN RAISE EXCEPTION 'movimientos'; END IF;
END $$;
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '38000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
 BEGIN PERFORM public.admin_grant_premium('38000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'no admin aceptado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_wallet_credit('38000000-0000-0000-0000-000000000001', 100, 'Pix'); RAISE EXCEPTION 'no admin aceptado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
END $$;
COMMIT;
