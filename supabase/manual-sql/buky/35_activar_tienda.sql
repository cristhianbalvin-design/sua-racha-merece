-- Paso 35 (11/11/2026): abre la Loja 3buk al público con "frete a combinar". Se aplica UNA sola vez
-- (marca shop_opened_once): si después el admin apaga la tienda desde el panel, los despliegues
-- siguientes no la vuelven a encender.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'shop_opened_once') THEN
    UPDATE public.app_settings SET value = 'true', updated_at = now() WHERE key = 'shop_enabled';
    UPDATE public.app_settings SET value = '"arrange"', updated_at = now() WHERE key = 'shop_shipping_mode';
    INSERT INTO public.app_settings (key, value, description)
    VALUES ('shop_opened_once', 'true', 'La tienda se abrió por primera vez (paso 35)');
  END IF;
END $$;
