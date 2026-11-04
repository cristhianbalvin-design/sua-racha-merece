-- ============================================================
-- 3BUK · Buky · DATOS DE PRUEBA DE SORTEIOS (realistas, con imágenes) — después de los pasos 15–20
-- y de datos_prueba_niteroi.sql. Idempotente: volver a correrlo no duplica nada.
--
-- Qué carga (todo con ids 7e570000-…; los periodos llevan "[TESTE]" en el nombre):
--   · 8 patrocinadores ficticios con logo (public/buky-teste/*.svg) y fotos de Unsplash (licencia libre).
--   · Sorteio atual "[TESTE] Sorteio de teste": 10 premios (físicos en Niterói, digitales de RJ y de
--     Brasil y uno físico de São Gonçalo que un atleta de Niterói NO debe ver), con códigos de canje.
--   · Próximo: "[TESTE] Próximo sorteio" (16/11 → 23/11) con 4 premios.
--   · Pasado ya sorteado: "[TESTE] Sorteio semanal 26/10" con 3 participantes (la cuenta de prueba
--     "Prueba" y las 2 cuentas admin de 3BUK), 3 ganadores y un premio sin ganador.
--   · La cuenta "Prueba" (correo4@gmail.com) recibe 30 Bukys de regalo para probar el envío.
--
-- OJO: participaciones, resultados y movimientos de Bukys son inmutables por diseño (auditoría):
-- los del periodo pasado de prueba quedan registrados aunque se limpie el resto.
-- ============================================================
BEGIN;

-- ---------- Patrocinadores ficticios
INSERT INTO public.buky_sponsors (id, name, logo_url, city_code, active) VALUES
  ('7e570000-0000-4000-8000-000000000101', 'Passada Running Store', 'https://www.3buk.com/buky-teste/passada.svg', 3303302, true),
  ('7e570000-0000-4000-8000-000000000102', 'Açaí do Calçadão', 'https://www.3buk.com/buky-teste/calcadao.svg', 3303302, true),
  ('7e570000-0000-4000-8000-000000000103', 'Core Studio Pilates', 'https://www.3buk.com/buky-teste/core.svg', 3303302, true),
  ('7e570000-0000-4000-8000-000000000104', 'Fôlego Suplementos', 'https://www.3buk.com/buky-teste/folego.svg', NULL, true),
  ('7e570000-0000-4000-8000-000000000105', 'Pulso Relógios Esportivos', 'https://www.3buk.com/buky-teste/pulso.svg', NULL, true),
  ('7e570000-0000-4000-8000-000000000106', 'Movimento Fisio & Massagem', 'https://www.3buk.com/buky-teste/movimento.svg', 3303302, true),
  ('7e570000-0000-4000-8000-000000000107', 'Coco Gelado', 'https://www.3buk.com/buky-teste/cocogelado.svg', 3303302, true),
  ('7e570000-0000-4000-8000-000000000108', 'Corre RJ Eventos', 'https://www.3buk.com/buky-teste/correrj.svg', NULL, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url, active = true;
UPDATE public.buky_sponsors SET name = '3BUK', instagram = '3buk', website = 'https://www.3buk.com'
WHERE id = '7e570000-0000-4000-8000-000000000001';

-- ---------- Sorteio atual: se reabre como "programado" solo dentro de esta transacción para poder
-- cargar premios (las reglas lo impiden con el periodo abierto). Solo si nadie envió Bukys aún.
DO $$
DECLARE
  v_p uuid := '7e570000-0000-4000-8000-000000000020';
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.buky_raffle_periods WHERE id = v_p;
  IF v_status IS NULL THEN
    RAISE NOTICE 'No existe el sorteio de teste: corre antes datos_prueba_niteroi.sql';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_entries WHERE period_id = v_p) THEN
    RAISE NOTICE 'El sorteio de teste ya tiene envíos: no se cambian sus premios';
    RETURN;
  END IF;
  UPDATE public.buky_raffle_periods SET status = 'scheduled' WHERE id = v_p AND status = 'open';

  UPDATE public.buky_coupons SET
    sponsor_id = '7e570000-0000-4000-8000-000000000101', title = 'Tênis de corrida', benefit = '30% OFF',
    description = 'Desconto em qualquer tênis de corrida da loja.',
    image_url = 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=70&auto=format&fit=crop',
    winners_count = 2, valid_until = DATE '2026-12-15',
    redeem_instructions = 'Apresente o código no caixa da loja (Rua Moreira César, Icaraí). Válido para um par.'
  WHERE id = '7e570000-0000-4000-8000-000000000021';
  UPDATE public.buky_coupons SET
    title = 'Plano de treino de 5 km', benefit = 'GRÁTIS',
    description = 'Plano de 8 semanas para correr seus primeiros 5 km, com treinos no app.',
    image_url = 'https://images.unsplash.com/photo-1590333748338-d629e4564ad9?w=800&q=70&auto=format&fit=crop',
    valid_until = DATE '2026-12-31',
    redeem_instructions = 'Use o código em 3buk.com/planos. O plano fica liberado na hora.'
  WHERE id = '7e570000-0000-4000-8000-000000000022';

  INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, description, benefit, image_url, kind, scope,
                                   city_code, state_code, winners_count, draw_order, redeem_instructions, valid_until) VALUES
    ('7e570000-0000-4000-8000-000000000023', v_p, '7e570000-0000-4000-8000-000000000102', 'Açaí 500 ml',
     'Açaí com 2 complementos à sua escolha.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1771371000586-33abd2ce9e23?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3303302, NULL, 5, 30, 'Mostre o código no quiosque em frente ao Posto 5 de Icaraí.', DATE '2026-12-15'),
    ('7e570000-0000-4000-8000-000000000024', v_p, '7e570000-0000-4000-8000-000000000103', '1 mês de pilates',
     'Plano mensal com 2 aulas por semana em aparelhos.', '50% OFF',
     'https://images.unsplash.com/photo-1747239069226-55382c570116?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3303302, NULL, 1, 40, 'Agende pelo WhatsApp do studio e informe o código.', DATE '2026-12-31'),
    ('7e570000-0000-4000-8000-000000000025', v_p, '7e570000-0000-4000-8000-000000000106', 'Massagem esportiva',
     'Sessão de 50 minutos de massagem para recuperação muscular.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1712638932314-e2b185ca0930?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3303302, NULL, 2, 50, 'Agende pelo telefone da clínica e apresente o código no dia.', DATE '2026-12-31'),
    ('7e570000-0000-4000-8000-000000000026', v_p, '7e570000-0000-4000-8000-000000000107', 'Água de coco no calçadão',
     'Um coco gelado depois do treino.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1620752420341-4cd7642568dd?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3303302, NULL, 10, 60, 'Válido nos carrinhos da orla de Icaraí, das 7h às 18h.', DATE '2026-11-30'),
    ('7e570000-0000-4000-8000-000000000027', v_p, '7e570000-0000-4000-8000-000000000104', 'Whey protein 900 g',
     'Desconto no whey de qualquer sabor da loja online.', '25% OFF',
     'https://images.unsplash.com/photo-1704650311190-7eeb9c4f6e11?w=800&q=70&auto=format&fit=crop',
     'digital', 'national', NULL, NULL, 3, 70, 'Use o código no carrinho da loja online. Frete por conta do comprador.', DATE '2026-12-31'),
    ('7e570000-0000-4000-8000-000000000028', v_p, '7e570000-0000-4000-8000-000000000105', 'Relógio GPS de corrida',
     'Desconto em qualquer modelo com GPS e frequência cardíaca.', '15% OFF',
     'https://images.unsplash.com/photo-1773399452188-a42e29543bf2?w=800&q=70&auto=format&fit=crop',
     'digital', 'national', NULL, NULL, 1, 80, 'Use o código no site da loja. Não acumula com outras promoções.', DATE '2026-12-31'),
    ('7e570000-0000-4000-8000-000000000029', v_p, '7e570000-0000-4000-8000-000000000108', 'Inscrição numa corrida de 10 km',
     'Inscrição para uma etapa do circuito de corridas do Rio de Janeiro.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1759674861540-afed9f86f94a?w=800&q=70&auto=format&fit=crop',
     'digital', 'state', NULL, 33, 2, 90, 'Use o código na página de inscrição do evento.', DATE '2027-01-31'),
    ('7e570000-0000-4000-8000-000000000030', v_p, '7e570000-0000-4000-8000-000000000101', 'Garrafa térmica de corrida',
     'Garrafa de 500 ml para o treino.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1649345867132-e8bd35bedf76?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3304904, NULL, 3, 100, 'Retire na loja de São Gonçalo com o código.', DATE '2026-12-15')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.buky_raffle_periods SET status = 'open'
  WHERE id = v_p AND status = 'scheduled' AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE status = 'open');
END $$;

-- ---------- Próximo sorteio
INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence)
VALUES ('7e570000-0000-4000-8000-000000000040', '[TESTE] Próximo sorteio',
        TIMESTAMPTZ '2026-11-16 03:00+00', TIMESTAMPTZ '2026-11-23 03:00+00', TIMESTAMPTZ '2026-11-23 04:00+00', 'none')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, description, benefit, image_url, kind, scope,
                                 city_code, state_code, winners_count, draw_order, redeem_instructions, valid_until)
SELECT * FROM (VALUES
  ('7e570000-0000-4000-8000-000000000041'::uuid, '7e570000-0000-4000-8000-000000000040'::uuid, '7e570000-0000-4000-8000-000000000101'::uuid,
   'Meia de compressão', 'Par de meias de compressão para corrida.', '20% OFF',
   'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=70&auto=format&fit=crop',
   'physical', 'city', 3303302, NULL::smallint, 3::smallint, 10::smallint, 'Apresente o código no caixa da loja.', DATE '2026-12-31'),
  ('7e570000-0000-4000-8000-000000000042', '7e570000-0000-4000-8000-000000000040', '7e570000-0000-4000-8000-000000000102',
   'Combo açaí + granola', 'Açaí de 500 ml com granola e banana.', 'GRÁTIS',
   'https://images.unsplash.com/photo-1709139068234-f83a548f3bec?w=800&q=70&auto=format&fit=crop',
   'physical', 'city', 3303302, NULL, 5, 20, 'Mostre o código no quiosque.', DATE '2026-12-31'),
  ('7e570000-0000-4000-8000-000000000043', '7e570000-0000-4000-8000-000000000040', '7e570000-0000-4000-8000-000000000104',
   'Frete grátis + 20% OFF', 'Na loja online, em qualquer produto.', '20% OFF',
   'https://images.unsplash.com/photo-1558017487-06bf9f82613a?w=800&q=70&auto=format&fit=crop',
   'digital', 'national', NULL, NULL, 10, 30, 'Use o código no carrinho da loja online.', DATE '2027-01-31'),
  ('7e570000-0000-4000-8000-000000000044', '7e570000-0000-4000-8000-000000000040', '7e570000-0000-4000-8000-000000000105',
   'Pulseira cardíaca', 'Sensor de frequência cardíaca para o treino.', '20% OFF',
   'https://images.unsplash.com/photo-1434494745656-1aea7daa8f6f?w=800&q=70&auto=format&fit=crop',
   'digital', 'national', NULL, NULL, 2, 40, 'Use o código no site da loja.', DATE '2027-01-31')
) AS v(id, period_id, sponsor_id, title, description, benefit, image_url, kind, scope, city_code, state_code, winners_count, draw_order, redeem_instructions, valid_until)
WHERE (SELECT status FROM public.buky_raffle_periods WHERE id = '7e570000-0000-4000-8000-000000000040') = 'scheduled'
ON CONFLICT (id) DO NOTHING;

-- ---------- Códigos de canje únicos (uno por ganador) para los premios de prueba que no tengan
INSERT INTO public.buky_coupon_codes (coupon_id, code)
SELECT k.id, upper(left(regexp_replace(s.name, '[^A-Za-z]', '', 'g'), 4)) || '-' ||
             upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4)) || '-' ||
             upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4))
FROM public.buky_coupons k
JOIN public.buky_sponsors s ON s.id = k.sponsor_id
CROSS JOIN LATERAL generate_series(1, k.winners_count) g
WHERE k.id::text LIKE '7e570000-%'
  AND NOT EXISTS (SELECT 1 FROM public.buky_coupon_codes c WHERE c.coupon_id = k.id);

-- ---------- Sorteio pasado, ya sorteado (una sola vez: es inmutable)
DO $$
DECLARE
  v_p uuid := '7e570000-0000-4000-8000-000000000060';
  v_prueba uuid := (SELECT id FROM public.users WHERE email = 'correo4@gmail.com');
  v_adm uuid := (SELECT id FROM public.users WHERE email = 'admin@3buk.com');
  v_jes uuid := (SELECT id FROM public.users WHERE email = 'cristhianbalvin@gmail.com');
  v_move jsonb;
  v_cands jsonb;
  v_total bigint;
  v_n bigint;
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE id = v_p) THEN
    RAISE NOTICE 'El sorteio pasado de prueba ya existe';
    RETURN;
  END IF;
  INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence)
  VALUES (v_p, '[TESTE] Sorteio semanal 26/10', TIMESTAMPTZ '2026-10-26 03:00+00', TIMESTAMPTZ '2026-11-02 03:00+00',
          TIMESTAMPTZ '2026-11-02 04:00+00', 'none');
  INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, description, benefit, image_url, kind, scope,
                                   city_code, state_code, winners_count, draw_order, redeem_instructions, valid_until) VALUES
    ('7e570000-0000-4000-8000-000000000061', v_p, '7e570000-0000-4000-8000-000000000101', 'Tênis de corrida',
     'Desconto em qualquer tênis de corrida da loja.', '20% OFF',
     'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3303302, NULL, 1, 10, 'Apresente o código no caixa da loja.', DATE '2026-11-30'),
    ('7e570000-0000-4000-8000-000000000062', v_p, '7e570000-0000-4000-8000-000000000001', 'Plano de treino de 10 km',
     'Plano de 10 semanas para baixar seu tempo nos 10 km.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1760315972424-1637530daead?w=800&q=70&auto=format&fit=crop',
     'digital', 'national', NULL, NULL, 1, 20, 'Use o código em 3buk.com/planos. O plano fica liberado na hora.', DATE '2026-12-31'),
    ('7e570000-0000-4000-8000-000000000063', v_p, '7e570000-0000-4000-8000-000000000108', 'Inscrição numa corrida de 5 km',
     'Inscrição para uma etapa do circuito de corridas do Rio de Janeiro.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1758683658297-d7c2512dcb0a?w=800&q=70&auto=format&fit=crop',
     'digital', 'state', NULL, 33, 1, 30, 'Use o código na página de inscrição do evento.', DATE '2026-12-31'),
    ('7e570000-0000-4000-8000-000000000064', v_p, '7e570000-0000-4000-8000-000000000106', 'Massagem esportiva',
     'Sessão de 50 minutos de massagem para recuperação muscular.', 'GRÁTIS',
     'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=800&q=70&auto=format&fit=crop',
     'physical', 'city', 3303302, NULL, 1, 40, 'Agende pelo telefone da clínica.', DATE '2026-11-30');
  UPDATE public.buky_raffle_periods SET status = 'drawn', drawn_at = TIMESTAMPTZ '2026-11-02 04:00+00' WHERE id = v_p;

  -- Participaciones: "Prueba" con movimiento real de Bukys (regalo y envío); las cuentas admin solo como participantes
  IF v_prueba IS NOT NULL THEN
    PERFORM public.apply_buky_movement(v_prueba, 'gift', 25, 'teste', NULL, 'teste:sorteio-26-10:gift', '[TESTE] Bukys para o sorteio de teste');
    v_move := public.apply_buky_movement(v_prueba, 'sent', -25, 'raffle_period', v_p::text, 'teste:sorteio-26-10:sent', '[TESTE] Sorteio semanal 26/10');
    INSERT INTO public.buky_entries (period_id, user_id, amount, city_code, state_code, ticket_code, ledger_id, created_at)
    VALUES (v_p, v_prueba, 25, 3303302, 33, 'BK-7E57A001', (v_move ->> 'ledger_id')::bigint, TIMESTAMPTZ '2026-10-30 22:10+00');
  END IF;
  IF v_adm IS NOT NULL THEN
    INSERT INTO public.buky_entries (period_id, user_id, amount, city_code, state_code, ticket_code, created_at)
    VALUES (v_p, v_adm, 31, 3303302, 33, 'BK-7E57A002', TIMESTAMPTZ '2026-10-31 11:40+00');
  END IF;
  IF v_jes IS NOT NULL THEN
    INSERT INTO public.buky_entries (period_id, user_id, amount, city_code, state_code, ticket_code, created_at)
    VALUES (v_p, v_jes, 18, 3304904, 33, 'BK-7E57A003', TIMESTAMPTZ '2026-11-01 09:05+00');
  END IF;

  -- Resultados en orden de sorteo; el número sorteado cae dentro del tramo del ganador
  FOR r IN SELECT * FROM (VALUES
      ('7e570000-0000-4000-8000-000000000061'::uuid, v_adm, 'PASS-7K4M-Q9XA', 'delivered'),
      ('7e570000-0000-4000-8000-000000000062'::uuid, v_prueba, '3BUK-H8RT-2WZN', 'notified'),
      ('7e570000-0000-4000-8000-000000000063'::uuid, v_jes, 'CORR-5DFE-M3KP', 'notified'),
      ('7e570000-0000-4000-8000-000000000064'::uuid, NULL::uuid, NULL, 'unclaimed')) AS t(coupon_id, winner, code, delivery)
  LOOP
    SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'weight', weight) ORDER BY user_id), '[]'::jsonb),
           coalesce(sum(weight), 0)
      INTO v_cands, v_total
    FROM (SELECT e.user_id, sum(e.amount)::bigint AS weight
          FROM public.buky_entries e JOIN public.buky_coupons k ON k.id = r.coupon_id
          WHERE e.period_id = v_p
            AND (k.scope = 'national' OR (k.scope = 'state' AND e.state_code = k.state_code)
                 OR (k.scope = 'city' AND e.city_code = k.city_code))
            AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_results x WHERE x.period_id = v_p AND x.user_id = e.user_id)
          GROUP BY e.user_id) c;
    v_n := NULL;
    IF r.winner IS NOT NULL AND v_cands @> jsonb_build_array(jsonb_build_object('user_id', r.winner)) THEN
      SELECT coalesce(sum((c ->> 'weight')::bigint), 0) INTO v_n
      FROM jsonb_array_elements(v_cands) c WHERE (c ->> 'user_id') < r.winner::text;
    ELSE
      r.winner := NULL; r.code := NULL; r.delivery := 'unclaimed';
    END IF;
    INSERT INTO public.buky_raffle_results (period_id, coupon_id, rank, user_id, winning_ticket, redeem_code, total_weight,
                                            winning_number, candidates, candidates_sha256, drawn_at, delivery_status)
    VALUES (v_p, r.coupon_id, 1, r.winner,
            (SELECT ticket_code FROM public.buky_entries WHERE period_id = v_p AND user_id = r.winner LIMIT 1),
            r.code, v_total, v_n, v_cands, encode(extensions.digest(v_cands::text, 'sha256'), 'hex'),
            TIMESTAMPTZ '2026-11-02 04:00+00', r.delivery);
  END LOOP;
END $$;

-- ---------- Bukys de regalo para que "Prueba" pruebe el envío al sorteio atual
DO $$
DECLARE v_prueba uuid := (SELECT id FROM public.users WHERE email = 'correo4@gmail.com');
BEGIN
  IF v_prueba IS NOT NULL THEN
    PERFORM public.apply_buky_movement(v_prueba, 'gift', 30, 'teste', NULL, 'teste:sorteios:presente', '[TESTE] Bukys para testar o sorteio');
  END IF;
END $$;

COMMIT;

-- Verificación
SELECT
  (SELECT count(*) FROM public.buky_coupons WHERE period_id = '7e570000-0000-4000-8000-000000000020') AS premios_atual_10,
  (SELECT count(*) FROM public.buky_coupons WHERE period_id = '7e570000-0000-4000-8000-000000000040') AS premios_proximo_4,
  (SELECT count(*) FROM public.buky_raffle_results WHERE period_id = '7e570000-0000-4000-8000-000000000060') AS resultados_passado_4,
  (SELECT status FROM public.buky_raffle_periods WHERE id = '7e570000-0000-4000-8000-000000000020') AS atual_open;
