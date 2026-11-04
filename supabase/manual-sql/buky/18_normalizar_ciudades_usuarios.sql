-- ============================================================
-- 3BUK · Buky · PASO 18 — Normalizar la ciudad de los usuarios existentes
-- Correr DESPUÉS del paso 15. Idempotente.
--
-- 1) Respaldo: guarda city/country de cada usuario sin city_code (una sola vez) en
--    public.buky_city_backup, sin acceso desde la API.
-- 2) Corrige a mano 3 errores de tipeo con una única respuesta posible.
-- 3) Aplica las coincidencias seguras de buky_match_user_cities() (estado 'ok').
-- Los demás (cuentas de prueba, abreviaturas, estados en lugar de ciudad) no se adivinan:
-- la app les pide elegir la ciudad al entrar a Buky.
--
-- Revertir:
--   UPDATE public.users u SET city = b.city, country = b.country, city_code = NULL, state_code = NULL
--   FROM public.buky_city_backup b WHERE b.user_id = u.id;
-- (el trigger users_sync_city_from_code no reescribe city/country cuando city_code queda NULL)
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.buky_city_backup (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  city text,
  country text,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.buky_city_backup ENABLE ROW LEVEL SECURITY;  -- sin políticas: nadie lo lee por la API
REVOKE ALL ON public.buky_city_backup FROM anon, authenticated;

INSERT INTO public.buky_city_backup (user_id, city, country)
SELECT id, city, country FROM public.users WHERE city_code IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Errores de tipeo con una única respuesta posible
UPDATE public.users SET city_code = 3303302   -- Niterói (RJ)
WHERE city_code IS NULL AND public.br_norm(city) IN ('niteroi rj', 'niteori');
UPDATE public.users SET city_code = 4102000   -- Assis Chateaubriand (PR)
WHERE city_code IS NULL AND public.br_norm(city) = 'assis chateaunbriand';

-- Coincidencias seguras (misma ciudad dentro del estado del perfil, o única en Brasil)
SELECT public.buky_apply_user_city_matches() AS aplicadas;

COMMIT;

-- Verificación
SELECT
  (SELECT count(*) FROM public.users WHERE city_code IS NOT NULL) AS con_ciudad,
  (SELECT count(*) FROM public.users WHERE city_code IS NULL AND nullif(btrim(city), '') IS NOT NULL) AS por_revisar,
  (SELECT count(*) FROM public.users WHERE nullif(btrim(city), '') IS NULL) AS sin_ciudad,
  (SELECT count(*) FROM public.buky_city_backup) AS respaldados;
