-- Pruebas del paso 17: periodos, cupones por alcance, envío del saldo, sorteo auditable y cancelación.
-- Atletas: N1 y N2 en Niterói (RJ), R1 en Rio de Janeiro (RJ), S1 en São Paulo (SP), X sin ciudad.
BEGIN;
INSERT INTO public.users (id, email, city_code) VALUES
  ('10000000-0000-0000-0000-000000000001', 'n1@buky.test', 3303302),
  ('10000000-0000-0000-0000-000000000002', 'n2@buky.test', 3303302),
  ('10000000-0000-0000-0000-000000000003', 'r1@buky.test', 3304557),
  ('10000000-0000-0000-0000-000000000004', 's1@buky.test', 3550308),
  ('10000000-0000-0000-0000-000000000005', 'x@buky.test', NULL),
  ('10000000-0000-0000-0000-000000000009', 'admin2@buky.test', NULL);
UPDATE public.users SET role = 'ADMIN' WHERE id = '10000000-0000-0000-0000-000000000009';
SELECT public.apply_buky_movement('10000000-0000-0000-0000-000000000001', 'found', 10);
SELECT public.apply_buky_movement('10000000-0000-0000-0000-000000000002', 'found', 5);
SELECT public.apply_buky_movement('10000000-0000-0000-0000-000000000003', 'found', 3);
SELECT public.apply_buky_movement('10000000-0000-0000-0000-000000000004', 'found', 2);
SELECT public.apply_buky_movement('10000000-0000-0000-0000-000000000005', 'found', 7);

INSERT INTO public.buky_sponsors (id, name, instagram) VALUES
  ('5b000000-0000-0000-0000-000000000001', 'Loja Corre Niterói', 'correniteroi'),
  ('5b000000-0000-0000-0000-000000000002', 'Marca Nacional', NULL);

INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence) VALUES
  ('9e000000-0000-0000-0000-000000000001', 'Sorteio semanal teste', now() - interval '2 hours',
   now() + interval '1 hour', now() + interval '1 hour', 'weekly');

INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, benefit, kind, scope, city_code, state_code,
                                 winners_count, draw_order, repeat_next) VALUES
  ('c0000000-0000-0000-0000-000000000001', '9e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001',
   'Tênis na loja de Icaraí', '1 par de tênis', 'physical', 'city', 3303302, NULL, 1, 1, true),
  ('c0000000-0000-0000-0000-000000000002', '9e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000002',
   'Cupom digital RJ', '30% off', 'digital', 'state', NULL, 33, 2, 2, false),
  ('c0000000-0000-0000-0000-000000000003', '9e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000002',
   'Cupom digital Brasil', '15% off', 'digital', 'national', NULL, NULL, 1, 3, false),
  ('c0000000-0000-0000-0000-000000000004', '9e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000002',
   'Loja física SP', 'Camiseta', 'physical', 'city', 3550308, NULL, 1, 4, false);
INSERT INTO public.buky_coupon_codes (coupon_id, code) VALUES ('c0000000-0000-0000-0000-000000000001', 'NIT-0001');

DO $$
BEGIN
  -- Físico solo por ciudad
  BEGIN
    INSERT INTO public.buky_coupons (period_id, sponsor_id, title, kind, scope)
    VALUES ('9e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000002', 'Físico nacional', 'physical', 'national');
    RAISE EXCEPTION 'debió rechazar cupón físico nacional';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF (SELECT state_code FROM public.buky_coupons WHERE id = 'c0000000-0000-0000-0000-000000000001') <> 33 THEN
    RAISE EXCEPTION 'el cupón por ciudad debe completar su estado';
  END IF;
END $$;

-- El reloj abre el periodo
DO $$
DECLARE r jsonb := public.buky_raffle_tick();
BEGIN
  RAISE NOTICE 'tick 1: %', r;
  IF (SELECT status FROM public.buky_raffle_periods WHERE id = '9e000000-0000-0000-0000-000000000001') <> 'open' THEN
    RAISE EXCEPTION 'el periodo debe abrirse';
  END IF;
  -- Abierto: no se agregan cupones ni se cambian reglas
  BEGIN
    INSERT INTO public.buky_coupons (period_id, sponsor_id, title, kind, scope)
    VALUES ('9e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000002', 'Tarde', 'digital', 'national');
    RAISE EXCEPTION 'debió rechazar cupón con periodo abierto';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'period_not_editable' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.buky_coupons SET winners_count = 5 WHERE id = 'c0000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'debió rechazar cambio de ganadores con periodo abierto';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'period_not_editable' THEN RAISE; END IF;
  END;
  UPDATE public.buky_coupons SET benefit = '35% off' WHERE id = 'c0000000-0000-0000-0000-000000000002';  -- textos sí
END $$;
COMMIT;

\c - authenticator
-- ================= Atletas envían su saldo =================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb; r2 jsonb; n int;
BEGIN
  SELECT count(*) INTO n FROM public.buky_zone_coupons();
  IF n <> 3 THEN RAISE EXCEPTION 'Niterói debe ver 3 cupones (ciudad, estado, nacional), ve %', n; END IF;
  r := public.buky_send_to_raffle('envio-n1-0001');
  r2 := public.buky_send_to_raffle('envio-n1-0001');
  RAISE NOTICE 'envío N1: % / reintento: %', r, r2;
  IF (r ->> 'amount')::int <> 10 OR NOT (r2 ->> 'duplicate')::boolean OR r ->> 'ticket' <> r2 ->> 'ticket' THEN
    RAISE EXCEPTION 'envío o reintento incorrecto';
  END IF;
  IF (SELECT balance FROM public.buky_balances WHERE user_id = auth.uid()) <> 0 THEN
    RAISE EXCEPTION 'el saldo debe quedar en 0';
  END IF;
  BEGIN
    PERFORM public.buky_send_to_raffle('envio-n1-0002');
    RAISE EXCEPTION 'sin saldo no se envía';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'no_bukys' THEN RAISE; END IF; END;
  -- No puede sortear ni mover el reloj
  BEGIN
    PERFORM public.admin_buky_draw_period('9e000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'atleta no debe sortear';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.buky_raffle_tick();
    RAISE EXCEPTION 'atleta no debe ejecutar el reloj';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM 1 FROM public.buky_coupon_codes;
    IF FOUND THEN RAISE EXCEPTION 'atleta no debe ver códigos de canje'; END IF;
  END;
  IF (SELECT (public.buky_my_summary() -> 'open_period' ->> 'my_bukys')::int) <> 10 THEN
    RAISE EXCEPTION 'el resumen debe mostrar 10 Bukys enviados';
  END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT public.buky_send_to_raffle('envio-n2-0001') ->> 'amount' AS n2;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.buky_entries) <> 1 THEN RAISE EXCEPTION 'N2 solo debe ver su envío'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT public.buky_send_to_raffle('envio-r1-0001') ->> 'amount' AS r1;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.buky_zone_coupons();
  IF n <> 2 THEN RAISE EXCEPTION 'São Paulo debe ver 2 cupones (nacional y su ciudad), ve %', n; END IF;
END $$;
SELECT public.buky_send_to_raffle('envio-s1-0001') ->> 'amount' AS s1;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
DO $$ BEGIN
  PERFORM public.buky_send_to_raffle('envio-x-00001');
  RAISE EXCEPTION 'sin ciudad no se participa';
EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'city_required' THEN RAISE; END IF; END $$;
COMMIT;

-- ================= Vence el periodo: el reloj cierra, crea el siguiente y sortea =================
\c - postgres
UPDATE public.buky_raffle_periods SET ends_at = now() - interval '1 minute', draw_at = now() - interval '1 minute'
WHERE id = '9e000000-0000-0000-0000-000000000001';
SELECT public.buky_raffle_tick() AS tick_2;

DO $$
DECLARE r record; v_winners uuid[]; n_null int;
BEGIN
  FOR r IN SELECT k.title, x.rank, x.user_id, x.total_weight, x.winning_number, x.winning_ticket, x.redeem_code, x.candidates
           FROM public.buky_raffle_results x JOIN public.buky_coupons k ON k.id = x.coupon_id
           ORDER BY k.draw_order, x.rank LOOP
    RAISE NOTICE '% #% -> % (n=% de %, ticket %, código %) candidatos=%', r.title, r.rank, r.user_id,
      r.winning_number, r.total_weight, r.winning_ticket, r.redeem_code, r.candidates;
  END LOOP;
  IF (SELECT status FROM public.buky_raffle_periods WHERE id = '9e000000-0000-0000-0000-000000000001') <> 'drawn' THEN
    RAISE EXCEPTION 'el periodo debe quedar sorteado';
  END IF;
  SELECT array_agg(user_id) INTO v_winners FROM public.buky_raffle_results
  WHERE period_id = '9e000000-0000-0000-0000-000000000001' AND user_id IS NOT NULL;
  IF cardinality(v_winners) <> 4 OR (SELECT count(DISTINCT u) FROM unnest(v_winners) u) <> 4 THEN
    RAISE EXCEPTION 'debe haber 4 ganadores distintos (4 participantes, 5 premios): %', v_winners;
  END IF;
  SELECT count(*) INTO n_null FROM public.buky_raffle_results
  WHERE period_id = '9e000000-0000-0000-0000-000000000001' AND user_id IS NULL;
  IF n_null <> 1 THEN RAISE EXCEPTION 'un premio debe quedar sin candidato, hay %', n_null; END IF;
  -- Elegibilidad por alcance
  IF (SELECT user_id FROM public.buky_raffle_results WHERE coupon_id = 'c0000000-0000-0000-0000-000000000001')
     NOT IN ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'el cupón físico de Niterói solo puede ganarlo alguien de Niterói';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_raffle_results WHERE coupon_id = 'c0000000-0000-0000-0000-000000000002'
             AND user_id = '10000000-0000-0000-0000-000000000004') THEN
    RAISE EXCEPTION 'el cupón de RJ no puede ganarlo alguien de SP';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_raffle_results WHERE coupon_id = 'c0000000-0000-0000-0000-000000000004'
             AND user_id IS NOT NULL AND user_id <> '10000000-0000-0000-0000-000000000004') THEN
    RAISE EXCEPTION 'el cupón físico de SP solo puede ganarlo alguien de SP';
  END IF;
  -- Código de canje asignado al ganador del cupón con códigos
  IF (SELECT redeem_code FROM public.buky_raffle_results WHERE coupon_id = 'c0000000-0000-0000-0000-000000000001') <> 'NIT-0001'
     OR NOT (SELECT assigned FROM public.buky_coupon_codes WHERE code = 'NIT-0001') THEN
    RAISE EXCEPTION 'código de canje no asignado';
  END IF;
  -- Auditoría: el hash coincide con la lista y el número cae en el rango
  IF EXISTS (SELECT 1 FROM public.buky_raffle_results
             WHERE candidates_sha256 <> encode(extensions.digest(candidates::text, 'sha256'), 'hex')
                OR (user_id IS NOT NULL AND NOT (winning_number >= 0 AND winning_number < total_weight))) THEN
    RAISE EXCEPTION 'auditoría inconsistente';
  END IF;
  -- Notificaciones a los ganadores
  IF (SELECT count(*) FROM public.notifications WHERE type = 'buky_raffle_won') <> 4 THEN
    RAISE EXCEPTION 'deben enviarse 4 avisos';
  END IF;
  -- Siguiente periodo semanal creado, abierto y con el cupón repetible copiado
  IF (SELECT count(*) FROM public.buky_raffle_periods WHERE status = 'open' AND cadence = 'weekly') <> 1 THEN
    RAISE EXCEPTION 'debe abrirse el siguiente periodo semanal';
  END IF;
  IF (SELECT count(*) FROM public.buky_coupons k JOIN public.buky_raffle_periods p ON p.id = k.period_id
      WHERE p.status = 'open') <> 1 THEN
    RAISE EXCEPTION 'debe copiarse solo el cupón marcado para repetirse';
  END IF;
  -- Sortear de nuevo no cambia nada
  IF NOT (public.buky_draw_period_internal('9e000000-0000-0000-0000-000000000001') ->> 'duplicate')::boolean THEN
    RAISE EXCEPTION 'el sorteo debe ser idempotente';
  END IF;
  -- Resultado inmutable
  BEGIN
    UPDATE public.buky_raffle_results SET user_id = '10000000-0000-0000-0000-000000000005'
    WHERE coupon_id = 'c0000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'el ganador no debe poder cambiarse';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Azar: rango correcto y distribución pareja (20.000 muestras sobre 10 valores)
DO $$
DECLARE v_min int; v_max int; v_lo int; v_hi int;
BEGIN
  SELECT min(c), max(c), min(v), max(v) INTO v_min, v_max, v_lo, v_hi FROM (
    SELECT v, count(*) c FROM (SELECT public.buky_secure_random(10) v FROM generate_series(1, 20000)) s GROUP BY v) t;
  RAISE NOTICE 'azar: valores %..%, frecuencias %..% (esperado ~2000)', v_lo, v_hi, v_min, v_max;
  IF v_lo <> 0 OR v_hi <> 9 OR v_min < 1800 OR v_max > 2200 THEN RAISE EXCEPTION 'distribución anómala'; END IF;
END $$;

-- Ponderación: 4.000 sorteos con la misma función del sorteo real y pesos 10/5/3/2 (de 20)
DO $$
DECLARE
  cand jsonb := '[{"user_id":"a0000000-0000-0000-0000-00000000000a","weight":10},
                  {"user_id":"b0000000-0000-0000-0000-00000000000b","weight":5},
                  {"user_id":"c0000000-0000-0000-0000-00000000000c","weight":3},
                  {"user_id":"d0000000-0000-0000-0000-00000000000d","weight":2}]';
  r record;
BEGIN
  -- Bordes exactos: 0..9 → a, 10..14 → b, 15..17 → c, 18..19 → d
  IF public.buky_weighted_pick(cand, 0) <> 'a0000000-0000-0000-0000-00000000000a'
     OR public.buky_weighted_pick(cand, 9) <> 'a0000000-0000-0000-0000-00000000000a'
     OR public.buky_weighted_pick(cand, 10) <> 'b0000000-0000-0000-0000-00000000000b'
     OR public.buky_weighted_pick(cand, 17) <> 'c0000000-0000-0000-0000-00000000000c'
     OR public.buky_weighted_pick(cand, 19) <> 'd0000000-0000-0000-0000-00000000000d'
     OR public.buky_weighted_pick(cand, 20) IS NOT NULL THEN
    RAISE EXCEPTION 'bordes de la ponderación incorrectos';
  END IF;
  FOR r IN
    SELECT w, count(*) AS c FROM (
      SELECT public.buky_weighted_pick(cand, public.buky_secure_random(20) + 0 * g) AS w FROM generate_series(1, 4000) g) s
    GROUP BY w ORDER BY c DESC
  LOOP
    RAISE NOTICE 'ponderación: % ganó % de 4000', left(r.w::text, 1), r.c;
    IF (left(r.w::text, 1) = 'a' AND r.c NOT BETWEEN 1820 AND 2180)    -- esperado 2000
       OR (left(r.w::text, 1) = 'b' AND r.c NOT BETWEEN 860 AND 1140)  -- esperado 1000
       OR (left(r.w::text, 1) = 'c' AND r.c NOT BETWEEN 490 AND 710)   -- esperado 600
       OR (left(r.w::text, 1) = 'd' AND r.c NOT BETWEEN 310 AND 490) THEN  -- esperado 400
      RAISE EXCEPTION 'ponderación anómala';
    END IF;
  END LOOP;
END $$;

-- ================= Admin: entrega y cancelación con devolución =================
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000009', true);
DO $$
DECLARE v_open uuid; r jsonb;
BEGIN
  UPDATE public.buky_raffle_results SET delivery_status = 'delivered', delivered_at = now(), delivery_note = 'Retirado na loja'
  WHERE coupon_id = 'c0000000-0000-0000-0000-000000000001';
  IF NOT FOUND THEN RAISE EXCEPTION 'el admin debe poder registrar la entrega'; END IF;
  BEGIN
    UPDATE public.buky_raffle_results SET winning_number = 0 WHERE coupon_id = 'c0000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'el admin no debe poder alterar el sorteo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- X completa su ciudad y envía al periodo nuevo; el admin lo cancela y X recupera sus Bukys
  SELECT id INTO v_open FROM public.buky_raffle_periods WHERE status = 'open';
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
  UPDATE public.users SET city_code = 3303302 WHERE id = auth.uid();
  r := public.buky_send_to_raffle('envio-x-00002');
  IF (r ->> 'period_id')::uuid <> v_open OR (r ->> 'amount')::int <> 7 THEN RAISE EXCEPTION 'envío de X: %', r; END IF;
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000009', true);
  r := public.admin_buky_cancel_period(v_open, 'Patrocinador desistiu');
  IF (r ->> 'bukys_refunded')::int <> 7 THEN RAISE EXCEPTION 'cancelación: %', r; END IF;
  IF (SELECT balance FROM public.buky_balances WHERE user_id = '10000000-0000-0000-0000-000000000005') <> 7 THEN
    RAISE EXCEPTION 'X debe recuperar sus 7 Bukys';
  END IF;
END $$;
COMMIT;

-- ================= El ganador ve su premio en la Bolsa =================
\c - postgres
SELECT user_id AS ganador_niteroi FROM public.buky_raffle_results WHERE coupon_id = 'c0000000-0000-0000-0000-000000000001' \gset
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'ganador_niteroi', true);
DO $$
DECLARE s jsonb := public.buky_my_summary();
BEGIN
  RAISE NOTICE 'premios del ganador de Niterói: %', s -> 'wins';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'wins') w WHERE w ->> 'redeem_code' = 'NIT-0001') THEN
    RAISE EXCEPTION 'el ganador debe ver su código';
  END IF;
  IF (SELECT count(*) FROM public.buky_raffle_results) <> 1 THEN
    RAISE EXCEPTION 'un atleta solo ve sus propios resultados';
  END IF;
END $$;
ROLLBACK;
