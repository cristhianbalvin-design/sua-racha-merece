-- Pruebas del paso 15 con casos reales de producción (ciudades escritas a mano).
BEGIN;
INSERT INTO public.users (id, city, country) VALUES
(gen_random_uuid(), 'Niterói ', 'Río de Janeiro'),
(gen_random_uuid(), 'Niteroi', 'Acre'),
(gen_random_uuid(), 'rio de janeiro', 'Ceará'),
(gen_random_uuid(), 'ItaboraÍ', 'Río de Janeiro'),
(gen_random_uuid(), 'Sao Gonçalo ', 'Río de Janeiro'),
(gen_random_uuid(), 'Niterói, rj', 'Río de Janeiro'),
(gen_random_uuid(), 'Sg', 'Río de Janeiro'),
(gen_random_uuid(), 'Valença ', 'Bahía'),
(gen_random_uuid(), 'Belém', 'Test Region'),
(gen_random_uuid(), 'Serra ', 'Espírito Santo'),
(gen_random_uuid(), NULL, NULL),
(gen_random_uuid(), 'Petropolis ', 'Río de Janeiro'),
(gen_random_uuid(), 'Niteroi', NULL),
(gen_random_uuid(), 'Chaclacayo', 'Amazonas');

DO $$
DECLARE r record; v_ok int; v_bad int;
BEGIN
  SELECT count(*) FILTER (WHERE status='ok'), count(*) FILTER (WHERE status<>'ok') INTO v_ok, v_bad
  FROM public.buky_match_user_cities();
  -- ok: Niterói(RJ), Niteroi/Acre->RJ, rio de janeiro/Ceará->RJ, ItaboraÍ, Sao Gonçalo, Valença/Bahía, Belém (ambiguo nacional? no: hay varios Belém)...
  FOR r IN SELECT * FROM public.buky_match_user_cities() ORDER BY city LOOP
    RAISE NOTICE '% | % -> % (%)', r.city, r.country, r.matched_city, r.status;
  END LOOP;
  IF (SELECT city_code FROM public.buky_match_user_cities() WHERE city='Niteroi' AND country='Acre') <> 3303302 THEN
    RAISE EXCEPTION 'Niteroi con estado equivocado debe resolverse a Niterói-RJ';
  END IF;
  IF (SELECT city_code FROM public.buky_match_user_cities() WHERE city='rio de janeiro') <> 3304557 THEN
    RAISE EXCEPTION 'rio de janeiro debe resolverse a 3304557';
  END IF;
  IF (SELECT status FROM public.buky_match_user_cities() WHERE city='Sg') <> 'no_encontrada' THEN
    RAISE EXCEPTION 'Sg no debe adivinarse';
  END IF;
  IF (SELECT status FROM public.buky_match_user_cities() WHERE city IS NULL) <> 'sin_ciudad' THEN
    RAISE EXCEPTION 'ciudad nula';
  END IF;
END $$;

SELECT public.buky_apply_user_city_matches();

DO $$
BEGIN
  IF (SELECT city FROM public.users WHERE city_code = 3303302 LIMIT 1) <> 'Niterói' THEN
    RAISE EXCEPTION 'el trigger debe escribir el nombre oficial';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE city_code = 3303302 AND country <> 'Rio de Janeiro') THEN
    RAISE EXCEPTION 'el estado debe quedar como Rio de Janeiro';
  END IF;
END $$;

-- El atleta puede fijar su ciudad, Instagram (sin @) y barrio; formato inválido se rechaza.
INSERT INTO public.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'a@x.com');
COMMIT;

-- Desde aquí, como la API: conexión 'authenticator' + rol authenticated.
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
UPDATE public.users SET city_code = 3303302, instagram = '@jesus.run', neighborhood = '  Ingá ' WHERE id = auth.uid();
DO $$
BEGIN
  IF (SELECT instagram || '|' || neighborhood || '|' || state_code || '|' || city FROM public.users WHERE id = auth.uid())
     <> 'jesus.run|Ingá|33|Niterói' THEN RAISE EXCEPTION 'perfil mal normalizado'; END IF;
  BEGIN
    UPDATE public.users SET instagram = 'no válido!' WHERE id = auth.uid();
    RAISE EXCEPTION 'debió rechazar instagram inválido';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.br_cities (code, name, state_code, lat, lon) VALUES (1, 'x', 33, 0, 0);
    RAISE EXCEPTION 'el catálogo no debe poder modificarse';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT count(*) FROM public.br_cities) < 5570 THEN RAISE EXCEPTION 'catálogo incompleto'; END IF;
END $$;
-- Un atleta no puede usar la vista previa de normalización
DO $$ BEGIN
  IF (SELECT count(*) FROM public.buky_match_user_cities()) <> 0 THEN RAISE EXCEPTION 'vista previa expuesta'; END IF;
END $$;
ROLLBACK;
