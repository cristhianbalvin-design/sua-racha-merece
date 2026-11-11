-- Entrega E: privacidad del ranking, contacto y contador de sorteos.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE OR REPLACE FUNCTION public.buky_nickname_valid(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT p_name IS NULL OR (char_length(p_name) BETWEEN 2 AND 20
    AND p_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .-]+$'
    AND lower(p_name) !~ '(puta|porra|caralho|merda|buceta)');
$$;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS buky_nickname_check;
ALTER TABLE public.users ADD CONSTRAINT buky_nickname_check CHECK (public.buky_nickname_valid(nickname)) NOT VALID;
-- Sin CHECK en phone: la columna ya existía y la web la guarda en formato libre (252 de 254 filas en
-- producción no son E.164). Un CHECK, incluso NOT VALID, haría fallar cualquier UPDATE de esos usuarios.
-- La app Buky la guarda normalizada (+55…); el formato se valida en el cliente.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS buky_phone_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS buky_whatsapp_check;
ALTER TABLE public.users ADD CONSTRAINT buky_whatsapp_check CHECK (whatsapp IS NULL OR whatsapp ~ '^\+55[0-9]{10,11}$') NOT VALID;

CREATE OR REPLACE FUNCTION public.buky_initials(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE WHEN p_name IS NULL OR btrim(p_name) = '' THEN '' ELSE
    upper(translate(left(parts[1], 1) || CASE WHEN cardinality(parts) > 1 THEN left(parts[cardinality(parts)], 1) ELSE '' END,
      'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ', 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ')) END
  FROM (SELECT regexp_split_to_array(btrim(p_name), '\s+') AS parts) n;
$$;

CREATE OR REPLACE FUNCTION public.buky_city_ranking(p_city_code integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  WITH city AS (
    SELECT coalesce(p_city_code, (SELECT u.city_code FROM public.users u WHERE u.id = auth.uid())) AS code
  ), ranked AS (
    SELECT u.id, u.name, u.nickname, u.avatar_url, b.found_total,
           rank() OVER (ORDER BY b.found_total DESC) AS pos
    FROM public.buky_balances b JOIN public.users u ON u.id = b.user_id
    JOIN city ON u.city_code = city.code WHERE b.found_total > 0
  )
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'city', (SELECT c.name FROM public.br_cities c JOIN city ON c.code = city.code),
    'top', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'pos', r.pos, 'initials', public.buky_initials(r.name), 'nickname', r.nickname,
      'avatar_url', r.avatar_url, 'bukys', r.found_total, 'me', r.id = auth.uid())
      ORDER BY r.pos, r.found_total DESC)
      FROM (SELECT * FROM ranked ORDER BY pos LIMIT 3) r), '[]'::jsonb),
    'me', (SELECT jsonb_build_object('pos', r.pos, 'bukys', r.found_total) FROM ranked r WHERE r.id = auth.uid()),
    'total', (SELECT count(*) FROM ranked)) END;
$$;

CREATE OR REPLACE FUNCTION public.buky_my_counters()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'sorteios', (SELECT count(DISTINCT period_id) FROM public.buky_entries WHERE user_id = auth.uid())) END;
$$;
REVOKE ALL ON FUNCTION public.buky_my_counters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_my_counters() TO authenticated;
COMMIT;
