-- Paso 25: varios sorteos, envío por ubicación con reglamento, % de mayor a menor, ganador + suplente,
-- mínimo de participantes, unión de sorteos y plazo de canje con paso al suplente.
\c - postgres
\i :sqldir/19_testadores_rutas.sql
\i :sqldir/24_recoleccion_bicicleta.sql
\i :sqldir/25_sorteos_v2.sql
BEGIN;
-- 6 atletas (3 de Niterói, 3 de Rio) y un admin
INSERT INTO public.users (id, email, role, city_code)
SELECT ('25000000-0000-0000-0000-00000000000' || i)::uuid, 't25_' || i || '@buky.test', 'USUARIO',
       CASE WHEN i <= 3 THEN 3303302 ELSE 3304557 END
FROM generate_series(1, 6) i
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, role) VALUES ('25000000-0000-0000-0000-0000000000ad', 't25_admin@buky.test', 'ADMIN')
ON CONFLICT (id) DO NOTHING;
SELECT public.apply_buky_movement(('25000000-0000-0000-0000-00000000000' || i)::uuid, 'found', 20)
FROM generate_series(1, 6) i;
INSERT INTO public.buky_sponsors (id, name) VALUES ('25000000-0000-0000-0000-0000000000b1', 'SB Fisioterapia')
ON CONFLICT (id) DO NOTHING;
-- Sorteo de Niterói (mínimo 2) y de Rio (mínimo 5), ambos programados
INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence, city_codes, min_participants, redeem_days) VALUES
  ('25000000-0000-0000-0000-0000000000e1', 'Niterói semanal', now() - interval '1 day', now() + interval '1 day', now() + interval '1 day', 'weekly', '{3303302}', 2, 15),
  ('25000000-0000-0000-0000-0000000000e2', 'Rio quinzenal', now() - interval '1 day', now() + interval '1 day', now() + interval '1 day', 'biweekly', '{3304557}', 5, 15)
ON CONFLICT (id) DO NOTHING;
UPDATE public.buky_raffle_periods SET status = 'scheduled' WHERE id IN ('25000000-0000-0000-0000-0000000000e1', '25000000-0000-0000-0000-0000000000e2');
-- Niterói: 3 cupones 25% y 1 de 100% (cargados en otro orden); Rio: 1 de 50%
INSERT INTO public.buky_coupons (period_id, sponsor_id, title, kind, scope, discount_pct, winners_count, draw_order) VALUES
  ('25000000-0000-0000-0000-0000000000e1', '25000000-0000-0000-0000-0000000000b1', 'Sessão 25%', 'physical', 'raffle', 25, 1, 1),
  ('25000000-0000-0000-0000-0000000000e1', '25000000-0000-0000-0000-0000000000b1', 'Sessão 100%', 'physical', 'raffle', 100, 1, 2),
  ('25000000-0000-0000-0000-0000000000e2', '25000000-0000-0000-0000-0000000000b1', 'Sessão 50%', 'digital', 'raffle', 50, 1, 1);
INSERT INTO public.buky_coupon_codes (coupon_id, code)
SELECT id, 'COD-' || discount_pct || '-' || g FROM public.buky_coupons, generate_series(1, 3) g
WHERE period_id = '25000000-0000-0000-0000-0000000000e1';
COMMIT;

-- El reloj abre los DOS a la vez
DO $$
DECLARE r jsonb;
BEGIN
  r := public.buky_raffle_tick();
  IF (SELECT count(*) FROM public.buky_raffle_periods WHERE id::text LIKE '25000000%' AND status = 'open') <> 2 THEN
    RAISE EXCEPTION 'deben quedar 2 sorteos abiertos: %', r;
  END IF;
END $$;

\c - authenticator
-- Atleta 1 en Niterói
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb; v_ok boolean;
BEGIN
  r := public.buky_my_raffles(-22.8833, -43.1036);
  IF r -> 'here' ->> 'name' <> 'Niterói' THEN RAISE EXCEPTION 'ciudad actual %', r -> 'here'; END IF;
  SELECT (o ->> 'available_here')::boolean INTO v_ok FROM jsonb_array_elements(r -> 'open') o WHERE o ->> 'id' = '25000000-0000-0000-0000-0000000000e1';
  IF NOT v_ok THEN RAISE EXCEPTION 'Niterói debe estar disponible'; END IF;
  SELECT (o ->> 'available_here')::boolean INTO v_ok FROM jsonb_array_elements(r -> 'open') o WHERE o ->> 'id' = '25000000-0000-0000-0000-0000000000e2';
  IF v_ok THEN RAISE EXCEPTION 'Rio no debe estar disponible desde Niterói'; END IF;
  IF (SELECT o -> 'prizes' -> 0 ->> 'discount_pct' FROM jsonb_array_elements(r -> 'open') o WHERE o ->> 'id' = '25000000-0000-0000-0000-0000000000e1') <> '100' THEN
    RAISE EXCEPTION 'premios deben ir de mayor a menor %%';
  END IF;
  -- Sin ubicación, fuera de la zona, sin aceptar el reglamento, más que el saldo: no
  BEGIN PERFORM public.buky_send_to_raffle_v2('25000000-0000-0000-0000-0000000000e1', 5, NULL, NULL, 1, 'k25-a-000');
    RAISE EXCEPTION 'debió pedir ubicación'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'location_required' THEN RAISE; END IF; END;
  BEGIN PERFORM public.buky_send_to_raffle_v2('25000000-0000-0000-0000-0000000000e2', 5, -22.8833, -43.1036, 1, 'k25-a-001');
    RAISE EXCEPTION 'debió rechazar fuera de zona'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'outside_area' THEN RAISE; END IF; END;
  BEGIN PERFORM public.buky_send_to_raffle_v2('25000000-0000-0000-0000-0000000000e1', 5, -22.8833, -43.1036, 0, 'k25-a-002');
    RAISE EXCEPTION 'debió exigir reglamento'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'rules_not_accepted' THEN RAISE; END IF; END;
  BEGIN PERFORM public.buky_send_to_raffle_v2('25000000-0000-0000-0000-0000000000e1', 99, -22.8833, -43.1036, 1, 'k25-a-003');
    RAISE EXCEPTION 'debió rechazar monto'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.buky_send_to_raffle('k25-a-004');
    RAISE EXCEPTION 'la versión vieja debe pedir actualizar'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'app_update_required' THEN RAISE; END IF; END;
  -- Envía 10 de 20 y repite la misma clave (idempotente)
  r := public.buky_send_to_raffle_v2('25000000-0000-0000-0000-0000000000e1', 10, -22.8833, -43.1036, 1, 'k25-a-ok');
  IF (r ->> 'balance')::int <> 10 THEN RAISE EXCEPTION 'saldo %', r; END IF;
  r := public.buky_send_to_raffle_v2('25000000-0000-0000-0000-0000000000e1', 10, -22.8833, -43.1036, 1, 'k25-a-ok');
  IF NOT (r ->> 'duplicate')::boolean THEN RAISE EXCEPTION 'debía ser duplicado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_rule_acceptances WHERE user_id = auth.uid() AND version = 1) THEN
    RAISE EXCEPTION 'aceptación no registrada';
  END IF;
END $$;
COMMIT;

\c - postgres
-- Los demás envían: 2 y 3 en Niterói, 4..6 en Rio
DO $$
DECLARE i int;
BEGIN
  FOR i IN 2 .. 6 LOOP
    PERFORM set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-00000000000' || i, true);
    PERFORM public.buky_send_to_raffle_v2(
      CASE WHEN i <= 3 THEN '25000000-0000-0000-0000-0000000000e1'::uuid ELSE '25000000-0000-0000-0000-0000000000e2'::uuid END,
      5, CASE WHEN i <= 3 THEN -22.8833 ELSE -22.9068 END, CASE WHEN i <= 3 THEN -43.1036 ELSE -43.1729 END, 1, 'k25-xx-' || i);
  END LOOP;
  -- El admin cambia el reglamento: versión 2
  UPDATE public.buky_raffle_periods SET rules_text = 'Regulamento oficial' WHERE id = '25000000-0000-0000-0000-0000000000e2';
  IF (SELECT rules_version FROM public.buky_raffle_periods WHERE id = '25000000-0000-0000-0000-0000000000e2') <> 2 THEN
    RAISE EXCEPTION 'el reglamento nuevo debe subir la versión';
  END IF;
  -- Se cierran ambos y llega la hora del sorteo
  UPDATE public.buky_raffle_periods SET starts_at = now() - interval '3 days', ends_at = now() - interval '2 hours', draw_at = now() - interval '1 hour'
  WHERE id IN ('25000000-0000-0000-0000-0000000000e1', '25000000-0000-0000-0000-0000000000e2');
END $$;

DO $$
DECLARE r jsonb; v_w record; v_roles int; v_order text[];
BEGIN
  r := public.buky_raffle_tick();
  -- Niterói (3 ≥ 2) se sortea; Rio (3 < 5) queda para el admin, con aviso
  IF (SELECT status FROM public.buky_raffle_periods WHERE id = '25000000-0000-0000-0000-0000000000e1') <> 'drawn' THEN
    RAISE EXCEPTION 'Niterói debía sortearse: %', r;
  END IF;
  IF NOT (SELECT needs_review FROM public.buky_raffle_periods WHERE id = '25000000-0000-0000-0000-0000000000e2') THEN
    RAISE EXCEPTION 'Rio debía quedar en revisión';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = '25000000-0000-0000-0000-0000000000ad' AND type = 'buky_raffle_review') THEN
    RAISE EXCEPTION 'el admin debía ser avisado';
  END IF;
  -- Ganadores en orden de %: primero el de 100%
  SELECT array_agg(k.discount_pct::text || ':' || x.role ORDER BY x.drawn_at, x.role DESC) INTO v_order
  FROM public.buky_raffle_results x JOIN public.buky_coupons k ON k.id = x.coupon_id
  WHERE x.period_id = '25000000-0000-0000-0000-0000000000e1';
  IF v_order[1] <> '100:winner' THEN RAISE EXCEPTION 'orden %', v_order; END IF;
  -- 3 participantes, 2 cupones: 100% ganador+suplente, 25% solo ganador (nadie repite papel)
  SELECT count(*) INTO v_roles FROM public.buky_raffle_results WHERE period_id = '25000000-0000-0000-0000-0000000000e1' AND user_id IS NOT NULL;
  IF v_roles <> 3 THEN RAISE EXCEPTION 'esperaba 3 papeles (2 ganadores + 1 suplente), hay %', v_roles; END IF;
  IF (SELECT count(DISTINCT user_id) FROM public.buky_raffle_results WHERE period_id = '25000000-0000-0000-0000-0000000000e1' AND user_id IS NOT NULL) <> 3 THEN
    RAISE EXCEPTION 'una persona con dos papeles';
  END IF;
  SELECT * INTO v_w FROM public.buky_raffle_results WHERE period_id = '25000000-0000-0000-0000-0000000000e1' AND role = 'winner' ORDER BY drawn_at LIMIT 1;
  IF v_w.redeem_code IS NULL OR v_w.redeem_deadline < now() + interval '14 days' THEN RAISE EXCEPTION 'código o plazo del ganador'; END IF;
  -- Siguiente de la serie creado con las mismas ciudades y el mismo mínimo
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE cadence = 'weekly' AND city_codes = '{3303302}' AND min_participants = 2 AND status IN ('scheduled', 'open')) THEN
    RAISE EXCEPTION 'faltó el siguiente sorteo de la serie Niterói';
  END IF;
END $$;

-- Ganador del 100% no canjea: vence y pasa al suplente con plazo nuevo y código
DO $$
DECLARE v_sub record;
BEGIN
  UPDATE public.buky_raffle_results SET redeem_deadline = now() - interval '1 minute'
  WHERE period_id = '25000000-0000-0000-0000-0000000000e1' AND role = 'winner'
    AND coupon_id = (SELECT id FROM public.buky_coupons WHERE title = 'Sessão 100%' AND period_id = '25000000-0000-0000-0000-0000000000e1');
  PERFORM public.buky_raffle_tick();
  SELECT * INTO v_sub FROM public.buky_raffle_results
  WHERE role = 'substitute' AND coupon_id = (SELECT id FROM public.buky_coupons WHERE title = 'Sessão 100%' AND period_id = '25000000-0000-0000-0000-0000000000e1');
  IF v_sub.delivery_status <> 'notified' OR v_sub.redeem_code IS NULL OR v_sub.redeem_deadline < now() + interval '14 days' THEN
    RAISE EXCEPTION 'el suplente debía activarse: %', row_to_json(v_sub);
  END IF;
  -- El suplente tampoco canjea: queda vencido y el admin lo lleva a otro sorteo programado
  UPDATE public.buky_raffle_results SET redeem_deadline = now() - interval '1 minute' WHERE id = v_sub.id;
  PERFORM public.buky_raffle_tick();
  INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence, city_codes)
  VALUES ('25000000-0000-0000-0000-0000000000e9', 'Niterói nova campanha', now() + interval '1 day', now() + interval '8 days', now() + interval '8 days', 'none', '{3303302}');
  PERFORM public.admin_buky_republish_prize(v_sub.id, '25000000-0000-0000-0000-0000000000e9');
  IF (SELECT count(*) FROM public.buky_coupons k JOIN public.buky_raffle_periods p ON p.id = k.period_id
      WHERE p.status = 'scheduled' AND p.city_codes = '{3303302}' AND k.title = 'Sessão 100%') <> 1 THEN
    RAISE EXCEPTION 'premio no republicado';
  END IF;
END $$;

-- Rio sin mínimo: el admin lo une con Niterói-siguiente? No: lo une a un sorteo nuevo programado de RJ y sortea
DO $$
DECLARE v_target uuid := gen_random_uuid(); r jsonb;
BEGIN
  INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence, city_codes, min_participants)
  VALUES (v_target, 'Região RJ', now() - interval '3 days', now() - interval '2 hours', now() - interval '1 hour', 'none', '{3303302}', 2);
  UPDATE public.buky_raffle_periods SET status = 'closed' WHERE id = v_target;
  r := public.admin_buky_merge_period('25000000-0000-0000-0000-0000000000e2', v_target);
  IF (r ->> 'participants')::int <> 3 THEN RAISE EXCEPTION 'participantes unidos %', r; END IF;
  IF (SELECT city_codes FROM public.buky_raffle_periods WHERE id = v_target) <> '{3303302,3304557}' THEN
    RAISE EXCEPTION 'las ciudades deben unirse';
  END IF;
  PERFORM public.buky_raffle_tick();
  IF (SELECT status FROM public.buky_raffle_periods WHERE id = v_target) <> 'drawn' THEN RAISE EXCEPTION 'el sorteo unido debía sortearse'; END IF;
  -- El premio de 50% del sorteo de Rio salió en el sorteo unido, entre los participantes de Rio
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_results x JOIN public.buky_coupons k ON k.id = x.coupon_id
                 WHERE x.period_id = v_target AND k.title = 'Sessão 50%' AND x.role = 'winner'
                   AND x.user_id IN ('25000000-0000-0000-0000-000000000004', '25000000-0000-0000-0000-000000000005', '25000000-0000-0000-0000-000000000006')) THEN
    RAISE EXCEPTION 'el premio de Rio debía sortearse en el unido';
  END IF;
END $$;

-- El atleta ve sus premios con papel y plazo
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.buky_my_raffles();
  IF jsonb_typeof(r -> 'past') <> 'array' OR jsonb_array_length(r -> 'past') < 1 THEN RAISE EXCEPTION 'faltan resultados %', r -> 'past'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'my_prizes') p WHERE p ->> 'role' IS NULL) THEN RAISE EXCEPTION 'falta el papel'; END IF;
END $$;
COMMIT;
