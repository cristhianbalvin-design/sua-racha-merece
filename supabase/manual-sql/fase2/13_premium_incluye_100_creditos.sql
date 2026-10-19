-- ============================================================
-- 3BUK · Fase 2 · PASO 13 — El Premium anual incluye 100 créditos
-- Correr en el SQL Editor de Supabase. Es idempotente.
--
-- Regla: cada pago aprobado del Premium anual (alta o renovación) suma 12 meses de Premium
-- Y acredita premium_credits_grant créditos (hoy 100 = 10 fotos).
--
-- Cómo: apply_premium_payment, que ya era idempotente por payments.premium_applied_at, ahora
-- también llama a apply_credit_movement con idempotency_key 'premium:<payment_id>', en la misma
-- transacción. Si algo falla, no se activa Premium ni se acreditan créditos (todo o nada).
-- El valor se cambia sin desplegar: UPDATE app_settings SET value='150' WHERE key='premium_credits_grant';
-- ============================================================

INSERT INTO public.app_settings (key, value, description) VALUES
  ('premium_credits_grant', '100'::jsonb, 'Créditos que se acreditan por cada pago aprobado del Premium anual')
ON CONFLICT (key) DO NOTHING;

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
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_payment.status <> 'approved' THEN
    RAISE EXCEPTION 'payment_not_approved' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.product <> 'premium_annual' THEN
    RAISE EXCEPTION 'unsupported_product' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.user_id IS NULL THEN
    RAISE EXCEPTION 'payment_without_user' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.premium_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_applied');
  END IF;

  SELECT premium_until INTO v_current_until
  FROM public.users
  WHERE id = v_payment.user_id
  FOR UPDATE;

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

  -- Créditos incluidos en el Premium (idempotente por pago)
  v_grant := COALESCE((SELECT (value #>> '{}')::integer FROM public.app_settings WHERE key = 'premium_credits_grant'), 100);
  IF v_grant > 0 THEN
    PERFORM public.apply_credit_movement(
      v_payment.user_id,
      v_grant,
      'premium_purchase',
      'payment',
      v_payment.id::text,
      'premium:' || v_payment.id::text,
      NULL
    );
  END IF;

  UPDATE public.payments
  SET premium_applied_at = now()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object('applied', true, 'premium_until', v_new_until, 'credits_granted', GREATEST(v_grant, 0));
END;
$function$;

-- Se mantienen los permisos: solo service_role (webhook) la ejecuta.
REVOKE ALL ON FUNCTION public.apply_premium_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_premium_payment(uuid) TO service_role;
