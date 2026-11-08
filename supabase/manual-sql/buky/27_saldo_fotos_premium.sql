-- Paso 27 · Saldo en reales, fotos gratis por año y Premium (ronda 3 de respuestas, 8/11/2026).
--   · Ya no hay créditos: las tablas credit_* quedan como historial, sin uso.
--   · Saldo en R$ (wallet_balances / wallet_ledger, en centavos). Entra por:
--       - Premium (R$50): cada pago aprobado acredita wallet_premium_grant_cents (R$50) al saldo.
--       - Recargas: R$20, R$30 o R$50 (wallet_topup_options). "Otro monto" queda para cuando 3buk
--         defina los límites.
--     Sale por: compra de fotos (R$10, photo_price_cents) y ajustes/devoluciones del admin.
--     El saldo no vence, ni al terminar el Premium. El Premium NUNCA se paga con saldo.
--   · Fotos gratis por año: Premium 3 (año contado desde que se hizo Premium), Freemium 1 (año contado
--     desde el registro, y solo con 300 Bukys recogidos corriendo). Volver a bajar una foto es gratis.
--     Sin fotos gratis, la foto cuesta R$10 del saldo y el atleta lo confirma antes (p_confirm_purchase).
--   · Devoluciones: el atleta pide a la administración. Si se devuelve el pago en Mercado Pago, el webhook
--     ya retira del saldo lo no usado (revoke_premium_payment). También hay ajuste manual del admin.
--   · Aviso de vencimiento del Premium: 15 y 3 días antes (bandeja de notificaciones), una vez por fecha.
-- Va después del 26. Idempotente.
BEGIN;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('wallet_premium_grant_cents', '5000', 'Saldo (centavos) que acredita cada pago aprobado del Premium anual'),
  ('photo_price_cents', '1000', 'Precio de una foto (centavos) cuando no quedan fotos gratis'),
  ('wallet_topup_options', '[2000, 3000, 5000]', 'Montos de recarga de saldo (centavos)'),
  ('free_photos_premium_per_year', '3', 'Fotos gratis por año para Premium (año desde que se hizo Premium)'),
  ('free_photos_freemium_per_year', '1', 'Fotos gratis por año para Freemium (año desde el registro; requiere Bukys)')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- Saldo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta_cents bigint NOT NULL CHECK (delta_cents <> 0),
  balance_after_cents bigint NOT NULL,
  reason text NOT NULL CHECK (reason IN ('premium_bonus', 'topup', 'photo_purchase', 'payment_reverted', 'admin_refund', 'admin_adjustment')),
  ref_type text,
  ref_id text,
  note text,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_idem ON public.wallet_ledger (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_ledger_user ON public.wallet_ledger (user_id, created_at DESC);

ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_balances_select ON public.wallet_balances;
CREATE POLICY wallet_balances_select ON public.wallet_balances FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS wallet_ledger_select ON public.wallet_ledger;
CREATE POLICY wallet_ledger_select ON public.wallet_ledger FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
REVOKE ALL ON public.wallet_balances, public.wallet_ledger FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.wallet_balances, public.wallet_ledger FROM authenticated;
GRANT SELECT ON public.wallet_balances, public.wallet_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.setting_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT coalesce((SELECT (value #>> '{}')::integer FROM public.app_settings WHERE key = p_key), p_default)
$$;

-- Único punto que mueve el saldo. Idempotente por (usuario, clave). Sin saldo suficiente: insufficient_balance.
CREATE OR REPLACE FUNCTION public.apply_wallet_movement(
  p_user_id uuid, p_delta_cents bigint, p_reason text, p_ref_type text, p_ref_id text,
  p_idempotency_key text, p_note text DEFAULT NULL, p_created_by uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_prev public.wallet_ledger%ROWTYPE;
  v_balance bigint;
  v_id bigint;
BEGIN
  IF p_delta_cents = 0 THEN
    RAISE EXCEPTION 'zero_amount' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.wallet_ledger WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('ledger_id', v_prev.id, 'balance_cents', v_prev.balance_after_cents, 'duplicate', true);
    END IF;
  END IF;
  INSERT INTO public.wallet_balances (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance + p_delta_cents < 0 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;
  v_balance := v_balance + p_delta_cents;
  UPDATE public.wallet_balances SET balance_cents = v_balance, updated_at = now() WHERE user_id = p_user_id;
  INSERT INTO public.wallet_ledger (user_id, delta_cents, balance_after_cents, reason, ref_type, ref_id, note, idempotency_key, created_by)
  VALUES (p_user_id, p_delta_cents, v_balance, p_reason, p_ref_type, p_ref_id, p_note, p_idempotency_key, p_created_by)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ledger_id', v_id, 'balance_cents', v_balance, 'duplicate', false);
END;
$$;

-- ------------------------------------------------------------
-- Pagos aprobados y devueltos (los llaman mercadopago-webhook y sync-premium-payment)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_premium_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_current_until timestamptz;
  v_was_active boolean;
  v_new_until timestamptz;
  v_grant integer;
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
SET search_path TO 'public'
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

-- ------------------------------------------------------------
-- Fotos: gratis por año, después R$10 del saldo
-- ------------------------------------------------------------
ALTER TABLE public.photo_downloads ADD COLUMN IF NOT EXISTS charge text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.photo_downloads ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.photo_downloads ADD CONSTRAINT photo_downloads_charge CHECK (charge IN ('free', 'paid', 'admin', 'legacy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Año de fotos del usuario: Premium desde que se hizo Premium; Freemium desde el registro.
CREATE OR REPLACE FUNCTION public.photo_year_start(p_user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH a AS (
    SELECT CASE WHEN public.user_is_premium(u.id) THEN coalesce(u.premium_since, u.created_at, now()) ELSE coalesce(u.created_at, now()) END AS anchor
    FROM public.users u WHERE u.id = p_user_id
  )
  SELECT anchor + make_interval(years => greatest(extract(year FROM age(now(), anchor))::integer, 0)) FROM a
$$;

CREATE OR REPLACE FUNCTION public.get_my_download_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_premium boolean;
  v_start timestamptz;
  v_total integer;
  v_used integer;
  v_found integer;
  v_min integer;
  v_eligible boolean;
  v_price integer;
  v_balance bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  v_premium := public.user_is_premium(v_user_id);
  v_start := public.photo_year_start(v_user_id);
  v_total := CASE WHEN v_premium THEN public.setting_int('free_photos_premium_per_year', 3)
                  ELSE public.setting_int('free_photos_freemium_per_year', 1) END;
  v_found := coalesce((SELECT found_total FROM public.buky_balances WHERE user_id = v_user_id), 0);
  v_min := public.buky_setting_num('buky_free_photo_min_found', 300);
  v_eligible := v_premium OR v_found >= v_min;
  SELECT count(*) INTO v_used FROM public.photo_downloads
  WHERE user_id = v_user_id AND charge = 'free' AND first_downloaded_at >= v_start;
  v_price := public.setting_int('photo_price_cents', 1000);
  v_balance := coalesce((SELECT balance_cents FROM public.wallet_balances WHERE user_id = v_user_id), 0);
  RETURN jsonb_build_object(
    'plan', CASE WHEN v_premium THEN 'Premium' ELSE 'Freemium' END,
    'premium_until', (SELECT premium_until FROM public.users WHERE id = v_user_id),
    'free_total', v_total,
    'free_used', LEAST(v_used, v_total),
    'free_remaining', CASE WHEN v_eligible THEN GREATEST(v_total - v_used, 0) ELSE 0 END,
    'free_eligible', v_eligible,
    'found_total', v_found,
    'found_min', v_min,
    'year_start', v_start,
    'next_free_at', v_start + interval '1 year',
    'price_cents', v_price,
    'balance_cents', v_balance,
    'photos_affordable', CASE WHEN v_price > 0 THEN v_balance / v_price ELSE 0 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid, p_confirm_purchase boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status jsonb;
  v_charge text;
  v_price integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 12));

  -- Regla de acceso vigente: cualquier participación distinta de 'Não concluído'.
  IF NOT EXISTS (SELECT 1 FROM public.participations WHERE user_id = v_user_id AND status <> 'Não concluído') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'participation_required');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_photos WHERE id = p_event_photo_id AND status = 'published') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'photo_not_available');
  END IF;

  IF EXISTS (SELECT 1 FROM public.photo_downloads WHERE user_id = v_user_id AND event_photo_id = p_event_photo_id) THEN
    v_charge := 'again';  -- volver a bajar es gratis
  ELSIF public.is_admin() THEN
    v_charge := 'admin';
  ELSE
    v_status := public.get_my_download_status();
    IF (v_status ->> 'free_remaining')::integer > 0 THEN
      v_charge := 'free';
    ELSE
      v_price := (v_status ->> 'price_cents')::integer;
      IF NOT coalesce(p_confirm_purchase, false) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'purchase_required', 'price_cents', v_price, 'status', v_status);
      END IF;
      BEGIN
        PERFORM public.apply_wallet_movement(v_user_id, -v_price, 'photo_purchase', 'event_photo', p_event_photo_id::text,
                                             'photo:' || p_event_photo_id::text, NULL);
      EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'insufficient_balance' THEN RAISE; END IF;
        RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_balance', 'price_cents', v_price, 'status', v_status);
      END;
      v_charge := 'paid';
    END IF;
  END IF;

  IF v_charge = 'again' THEN
    UPDATE public.photo_downloads SET last_downloaded_at = now(), download_count = download_count + 1
    WHERE user_id = v_user_id AND event_photo_id = p_event_photo_id;
  ELSE
    INSERT INTO public.photo_downloads (user_id, event_photo_id, charge, amount_cents)
    VALUES (v_user_id, p_event_photo_id, v_charge, v_price);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'charged', CASE v_charge WHEN 'paid' THEN 'wallet' WHEN 'free' THEN 'free' ELSE 'none' END,
                            'price_cents', v_price, 'status', public.get_my_download_status());
END;
$$;

-- La versión de un parámetro (apps viejas) nunca cobra: pide confirmar la compra.
CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.check_and_register_download(p_event_photo_id, false)
$$;

-- ------------------------------------------------------------
-- Pantalla de saldo del atleta y ajustes del admin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'balance_cents', coalesce((SELECT balance_cents FROM public.wallet_balances WHERE user_id = auth.uid()), 0),
    'premium', (SELECT jsonb_build_object('active', public.user_is_premium(u.id), 'since', u.premium_since, 'until', u.premium_until)
                FROM public.users u WHERE u.id = auth.uid()),
    'premium_price_cents', 5000,
    'topup_options', coalesce((SELECT value FROM public.app_settings WHERE key = 'wallet_topup_options'), '[2000,3000,5000]'::jsonb),
    'photo_price_cents', public.setting_int('photo_price_cents', 1000),
    'movements', coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'delta_cents', l.delta_cents, 'reason', l.reason,
                                  'note', l.note, 'ref_type', l.ref_type, 'created_at', l.created_at) ORDER BY l.created_at DESC)
                           FROM (SELECT * FROM public.wallet_ledger WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 40) l), '[]'::jsonb)
  ) END
$$;

-- Admin: devolver (negativo) o ajustar saldo, siempre con motivo
CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(p_user_id uuid, p_delta_cents bigint, p_note text, p_refund boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = '22023';
  END IF;
  IF p_refund AND p_delta_cents >= 0 THEN
    RAISE EXCEPTION 'refund_must_be_negative' USING ERRCODE = '22023';
  END IF;
  RETURN public.apply_wallet_movement(p_user_id, p_delta_cents, CASE WHEN p_refund THEN 'admin_refund' ELSE 'admin_adjustment' END,
                                      'admin', NULL, NULL, btrim(p_note), auth.uid());
END;
$$;

-- ------------------------------------------------------------
-- Aviso de vencimiento del Premium (15 y 3 días antes), una vez por fecha de vencimiento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_reminders_sent (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  premium_until timestamptz NOT NULL,
  days integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, premium_until, days)
);
ALTER TABLE public.premium_reminders_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_reminders_sent FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.premium_expiry_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_n integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT u.id, u.premium_until, d.days
    FROM public.users u CROSS JOIN (VALUES (15), (3)) d(days)
    WHERE u.plan = 'Premium' AND u.premium_until > now() AND u.premium_until <= now() + make_interval(days => d.days)
      AND NOT EXISTS (SELECT 1 FROM public.premium_reminders_sent s
                      WHERE s.user_id = u.id AND s.premium_until = u.premium_until AND s.days <= d.days)
    ORDER BY d.days
  LOOP
    INSERT INTO public.premium_reminders_sent (user_id, premium_until, days) VALUES (r.id, r.premium_until, r.days)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (r.id, 'premium_expiring', 'Seu Premium está acabando',
              format('Seu Premium vence em %s. Renove por R$ 50 para manter suas 3 fotos grátis por ano e ganhar R$ 50 de saldo.',
                     to_char(r.premium_until AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')));
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_movement(uuid, bigint, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_and_register_download(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_and_register_download(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_download_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_wallet() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_wallet_adjust(uuid, bigint, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.premium_expiry_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.photo_year_start(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_premium_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_premium_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wallet_movement(uuid, bigint, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_register_download(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_register_download(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_download_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_wallet() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_wallet_adjust(uuid, bigint, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.premium_expiry_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_premium_payment(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_premium_payment(uuid) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'premium-expiry-reminders';
    PERFORM cron.schedule('premium-expiry-reminders', '7 13 * * *', 'SELECT public.premium_expiry_reminders()');
  ELSE
    RAISE NOTICE 'pg_cron no está instalado: programar premium_expiry_reminders() manualmente';
  END IF;
END $$;

COMMIT;
