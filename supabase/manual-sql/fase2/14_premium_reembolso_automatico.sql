-- ============================================================
-- 3BUK · Fase 2 · PASO 14 — Reembolso automático del Premium
-- Correr en el SQL Editor de Supabase. Es idempotente.
--
-- Cuando Mercado Pago confirma un reembolso total o contracargo, el webhook llama a
-- revoke_premium_payment(payment_id), que:
--   1. Resta 1 año a premium_until (si el Premium sigue vigente por una renovación, sigue Premium;
--      si ya no queda vigencia, el plan vuelve a Freemium).
--   2. Retira los créditos que ese pago otorgó, hasta el saldo disponible (los ya gastados en
--      fotos descargadas no se recuperan; el saldo nunca queda negativo).
--   3. Marca payments.premium_revoked_at, así un aviso repetido no actúa dos veces.
-- Solo service_role (el webhook) puede ejecutarla.
-- ============================================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS premium_revoked_at timestamptz;

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
  v_granted integer;
  v_balance integer;
  v_take integer;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_payment.status NOT IN ('refunded', 'charged_back') THEN
    RAISE EXCEPTION 'payment_not_reverted' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.product <> 'premium_annual' OR v_payment.user_id IS NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'not_applicable');
  END IF;
  IF v_payment.premium_applied_at IS NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'not_applied');
  END IF;
  IF v_payment.premium_revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'already_revoked');
  END IF;

  -- 1. Premium: se resta el año de este pago
  SELECT premium_until INTO v_until
  FROM public.users
  WHERE id = v_payment.user_id
  FOR UPDATE;

  IF v_until IS NOT NULL THEN
    v_new_until := v_until - interval '1 year';
    UPDATE public.users
    SET premium_until = v_new_until,
        plan = CASE WHEN v_new_until > now() THEN 'Premium' ELSE 'Freemium' END
    WHERE id = v_payment.user_id;
  END IF;

  -- 2. Créditos: se retira lo que dio este pago, hasta el saldo disponible
  SELECT delta INTO v_granted
  FROM public.credit_ledger
  WHERE user_id = v_payment.user_id
    AND idempotency_key = 'premium:' || v_payment.id::text;

  v_take := 0;
  IF v_granted IS NOT NULL AND v_granted > 0 THEN
    SELECT COALESCE(balance, 0) INTO v_balance
    FROM public.credit_balances
    WHERE user_id = v_payment.user_id;
    v_take := LEAST(v_granted, COALESCE(v_balance, 0));
    IF v_take > 0 THEN
      PERFORM public.apply_credit_movement(
        v_payment.user_id,
        -v_take,
        'premium_refund',
        'payment',
        v_payment.id::text,
        'premium_refund:' || v_payment.id::text,
        'Estorno do plano Premium'
      );
    END IF;
  END IF;

  -- 3. Marca de revocación
  UPDATE public.payments
  SET premium_revoked_at = now()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'revoked', true,
    'premium_until', v_new_until,
    'credits_removed', v_take
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_premium_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_premium_payment(uuid) TO service_role;
