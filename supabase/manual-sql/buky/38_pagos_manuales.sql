-- Pagos manuales: configuración reversible y operaciones auditadas.
BEGIN;
INSERT INTO public.app_settings (key, value, description) VALUES
 ('payments_mode', '"manual"', 'Modo de pago: manual o mercadopago'),
 ('payments_contact_email', '"contato@3buk.com"', 'Correo de contacto para pagos manuales')
ON CONFLICT (key) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'payments_manual_started_once') THEN
  UPDATE public.app_settings SET value = '"manual"', updated_at = now() WHERE key = 'payments_mode';
  UPDATE public.app_settings SET value = 'false', updated_at = now() WHERE key = 'shop_enabled';
  INSERT INTO public.app_settings (key, value, description) VALUES ('payments_manual_started_once', 'true', 'Inicio de pagos manuales aplicado');
 END IF;
END $$;
-- La visibilidad pública no depende de que el visitante sea administrador.
CREATE OR REPLACE FUNCTION public.shop_is_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce((SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key='shop_enabled'), false)
$$;
CREATE TABLE IF NOT EXISTS public.manual_premium_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id),
 admin_id uuid NOT NULL, payment_id uuid NOT NULL REFERENCES public.payments(id),
 months integer NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manual_premium_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_premium_grants FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.app_payments_config() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('mode', coalesce((SELECT value #>> '{}' FROM public.app_settings WHERE key='payments_mode'), 'manual'),
 'contact_email', coalesce((SELECT value #>> '{}' FROM public.app_settings WHERE key='payments_contact_email'), 'contato@3buk.com'))
$$;
CREATE OR REPLACE FUNCTION public.admin_grant_premium(p_user_id uuid, p_months integer DEFAULT 12, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_payment uuid; v_result jsonb; v_until timestamptz;
BEGIN
 IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_months IS NULL OR p_months < 1 OR p_months > 120 THEN RAISE EXCEPTION 'invalid_months'; END IF;
 PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
 IF EXISTS (SELECT 1 FROM public.manual_premium_grants WHERE user_id = p_user_id AND created_at > now() - interval '60 seconds') THEN RAISE EXCEPTION 'grant_too_recent'; END IF;
 INSERT INTO public.payments(user_id, provider, product, amount_cents, currency, status)
 VALUES(p_user_id, 'manual', 'premium_annual', 5000, 'BRL', 'approved') RETURNING id INTO v_payment;
 v_result := public.apply_premium_payment(v_payment);
 IF p_months <> 12 THEN
  UPDATE public.users SET premium_until = premium_until - interval '1 year' + make_interval(months => p_months) WHERE id = p_user_id RETURNING premium_until INTO v_until;
  v_result := jsonb_set(v_result, '{premium_until}', to_jsonb(v_until));
 END IF;
 INSERT INTO public.manual_premium_grants(user_id, admin_id, payment_id, months, note) VALUES(p_user_id, auth.uid(), v_payment, p_months, nullif(trim(p_note), ''));
 RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION public.admin_wallet_credit(p_user_id uuid, p_amount_cents integer, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_amount_cents IS NULL OR p_amount_cents NOT BETWEEN 100 AND 100000 OR nullif(trim(p_note), '') IS NULL THEN RAISE EXCEPTION 'invalid_credit'; END IF;
 RETURN public.apply_wallet_movement(p_user_id, p_amount_cents, 'admin_adjustment', 'manual_payment', NULL, NULL, trim(p_note), auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_payments_config(p_mode text, p_email text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_mode IS NULL OR p_mode NOT IN ('manual', 'mercadopago') OR p_email IS NULL OR trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'invalid_config'; END IF;
 UPDATE public.app_settings SET value = to_jsonb(p_mode), updated_at = now() WHERE key = 'payments_mode';
 UPDATE public.app_settings SET value = to_jsonb(trim(p_email)), updated_at = now() WHERE key = 'payments_contact_email';
END $$;
REVOKE ALL ON FUNCTION public.app_payments_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_payments_config() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, integer, text), public.admin_wallet_credit(uuid, integer, text), public.admin_set_payments_config(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium(uuid, integer, text), public.admin_wallet_credit(uuid, integer, text), public.admin_set_payments_config(text, text) TO authenticated;
COMMIT;
