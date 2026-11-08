-- Paso 20 + datos_prueba_sorteios.sql: la pantalla Sorteios del atleta (después de los datos de Niterói).
\c - postgres
INSERT INTO public.users (id, email, name, role, city_code) VALUES
  ('20000000-0000-0000-0000-000000000001', 'correo4@gmail.com', 'Prueba', 'USUARIO', 3303302),
  ('20000000-0000-0000-0000-000000000002', 'admin@3buk.com', 'Atleta', 'ADMIN', NULL),
  ('20000000-0000-0000-0000-000000000003', 'cristhianbalvin@gmail.com', 'Jesús', 'ADMIN', NULL),
  ('20000000-0000-0000-0000-000000000004', 'sg@buky.test', 'SG', 'USUARIO', 3304904)
ON CONFLICT (id) DO NOTHING;
\i :sqldir/20_sorteios_atleta.sql
\i :sqldir/25_sorteos_v2.sql
\i :sqldir/datos_prueba_sorteios.sql
-- Re-ejecución: no duplica
\i :sqldir/datos_prueba_sorteios.sql

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE j jsonb := public.buky_my_raffles(); v_past jsonb; v_res jsonb; v_cur jsonb;
BEGIN
  -- Paso 25: varios abiertos; el de prueba es el 020
  SELECT o INTO v_cur FROM jsonb_array_elements(j -> 'open') o WHERE o ->> 'id' = '7e570000-0000-4000-8000-000000000020';
  IF jsonb_array_length(v_cur -> 'prizes') <> 9 THEN
    RAISE EXCEPTION 'Niterói debe ver 9 premios (no el de São Gonçalo): %', jsonb_array_length(v_cur -> 'prizes');
  END IF;
  IF (v_cur -> 'prizes' -> 0 ->> 'kind') <> 'physical' THEN RAISE EXCEPTION 'físicos primero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j -> 'upcoming') u WHERE jsonb_array_length(u -> 'prizes') = 4) THEN
    RAISE EXCEPTION 'falta el próximo sorteio con 4 premios';
  END IF;
  SELECT p INTO v_past FROM jsonb_array_elements(j -> 'past') p WHERE p ->> 'name' = '[TESTE] Sorteio semanal 26/10';
  IF (v_past ->> 'my_bukys')::int <> 25 OR (v_past ->> 'my_wins')::int <> 1 OR (v_past ->> 'participants')::int <> 3 THEN
    RAISE EXCEPTION 'pasado incorrecto: %', v_past;
  END IF;
  SELECT r INTO v_res FROM jsonb_array_elements(v_past -> 'results') r WHERE r ->> 'title' = 'Inscrição numa corrida de 5 km';
  IF v_res -> 'cities' <> '["São Gonçalo"]'::jsonb OR (v_res ->> 'winners')::int <> 1 THEN RAISE EXCEPTION 'resultado anónimo: %', v_res; END IF;
  IF v_past::text ~ '20000000-0000-0000-0000-00000000000[23]' OR v_past::text ~ 'Jesús' THEN
    RAISE EXCEPTION 'los resultados no deben exponer a otros atletas';
  END IF;
  SELECT r INTO v_res FROM jsonb_array_elements(v_past -> 'results') r WHERE r ->> 'title' = 'Massagem esportiva';
  IF (v_res ->> 'winners')::int <> 0 THEN RAISE EXCEPTION 'massagem sin ganador'; END IF;
  IF jsonb_array_length(j -> 'my_prizes') <> 1 OR (j -> 'my_prizes' -> 0 ->> 'redeem_code') <> '3BUK-H8RT-2WZN' THEN
    RAISE EXCEPTION 'meus prêmios: %', j -> 'my_prizes';
  END IF;
  IF (SELECT balance FROM public.buky_balances WHERE user_id = '20000000-0000-0000-0000-000000000001') <> 30 THEN
    RAISE EXCEPTION 'saldo de prueba debe ser 30';
  END IF;
END $$;
COMMIT;

-- São Gonçalo ve su premio físico y no los de Niterói
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
DO $$
DECLARE j jsonb := public.buky_my_raffles(); v_cur jsonb;
BEGIN
  SELECT o -> 'prizes' INTO v_cur FROM jsonb_array_elements(j -> 'open') o WHERE o ->> 'id' = '7e570000-0000-4000-8000-000000000020';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_cur) p WHERE p ->> 'title' = 'Garrafa térmica de corrida')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_cur) p WHERE p ->> 'title' = 'Açaí 500 ml') THEN
    RAISE EXCEPTION 'zona de São Gonçalo incorrecta';
  END IF;
END $$;
COMMIT;

-- Sin sesión no devuelve nada
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN IF public.buky_my_raffles() IS NOT NULL THEN RAISE EXCEPTION 'anónimo'; END IF; END $$;
COMMIT;
