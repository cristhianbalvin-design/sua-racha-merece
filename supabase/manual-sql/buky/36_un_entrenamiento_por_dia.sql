-- Paso 36 (14/11/2026): pedido de 3buk — 1 entrenamiento por día para Freemium y Premium.
-- Los topes de Bukys por día no cambian (Freemium 12, Premium 21). Re-ejecutable.
UPDATE public.app_settings SET value = '1', updated_at = now()
WHERE key IN ('buky_daily_sessions_freemium', 'buky_daily_sessions_premium');
