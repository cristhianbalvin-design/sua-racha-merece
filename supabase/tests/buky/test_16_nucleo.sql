-- Pruebas del paso 16: rutas, entrenamientos, cierre con topes y libro de Bukys.
-- Usuarios: A = atleta, B = otro atleta, D = admin.
BEGIN;
INSERT INTO public.users (id, email, role, city_code) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@buky.test', 'USUARIO', 3303302),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@buky.test', 'USUARIO', 3303302),
  ('dddddddd-0000-0000-0000-000000000004', 'd@buky.test', 'ADMIN', 3303302);

-- Ruta oficial en Niterói con 3 puntos (la crea el admin; aquí como postgres).
INSERT INTO public.buky_routes (id, name, city_code, kind, length_m)
VALUES ('0f000000-0000-0000-0000-000000000001', 'Orla de Icaraí', 3303302, 'official', 2000);
INSERT INTO public.buky_points (id, route_id, seq, label, lat, lon) VALUES
  ('0f000000-0000-0000-0000-0000000000a1', '0f000000-0000-0000-0000-000000000001', 0, 'P1', -22.9050, -43.1100),
  ('0f000000-0000-0000-0000-0000000000a2', '0f000000-0000-0000-0000-000000000001', 1, 'P2', -22.9100, -43.1100),
  ('0f000000-0000-0000-0000-0000000000a3', '0f000000-0000-0000-0000-000000000001', 2, 'P3', -22.9150, -43.1100);
COMMIT;

\c - authenticator
-- ================= Atleta A =================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001"}', true);

DO $$
DECLARE v_route uuid; v_n int;
BEGIN
  -- Ve la ruta oficial y sus puntos
  IF (SELECT count(*) FROM public.buky_points WHERE route_id = '0f000000-0000-0000-0000-000000000001') <> 3 THEN
    RAISE EXCEPTION 'el atleta debe ver los puntos de la ruta oficial';
  END IF;
  -- No puede crear rutas oficiales directamente
  BEGIN
    INSERT INTO public.buky_routes (name, city_code) VALUES ('Trampa', 3303302);
    RAISE EXCEPTION 'debió rechazar ruta oficial creada por atleta';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- No puede escribir en el libro ni en saldos
  BEGIN
    INSERT INTO public.buky_ledger (user_id, kind, amount, balance_after)
    VALUES (auth.uid(), 'gift', 1000, 1000);
    RAISE EXCEPTION 'debió rechazar escritura directa en el libro';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.apply_buky_movement(auth.uid(), 'gift', 1000);
    RAISE EXCEPTION 'apply_buky_movement no debe ser accesible';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- No puede cerrar su propio entrenamiento (solo la Edge Function)
  BEGIN
    PERFORM public.buky_finalize_session(gen_random_uuid(), auth.uid(), 'valid', NULL, '{}', '[]');
    RAISE EXCEPTION 'buky_finalize_session no debe ser accesible';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- No puede regalarse Bukys
  BEGIN
    PERFORM public.admin_buky_gift(auth.uid(), 10, 'yo mismo');
    RAISE EXCEPTION 'regalo de no-admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Rutas del atleta: validaciones
  BEGIN
    PERFORM public.buky_create_athlete_route('Corta', 3303302,
      '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.9030,"lon":-43.1200},{"lat":-22.9060,"lon":-43.1200}]');
    RAISE EXCEPTION 'debió rechazar ruta corta';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'route_too_short' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.buky_create_athlete_route('Pegados', 3303302,
      '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.9010,"lon":-43.1200},{"lat":-22.9200,"lon":-43.1200}]');
    RAISE EXCEPTION 'debió rechazar puntos a menos de 200 m';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'points_too_close' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.buky_create_athlete_route('Dos puntos', 3303302,
      '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.9200,"lon":-43.1200}]');
    RAISE EXCEPTION 'debió rechazar menos de 3 puntos';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'points_count' THEN RAISE; END IF;
  END;
  BEGIN  -- un punto en São Paulo, lejos de Niterói
    PERFORM public.buky_create_athlete_route('Lejos', 3303302,
      '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.9200,"lon":-43.1200},{"lat":-23.5500,"lon":-46.6300}]');
    RAISE EXCEPTION 'debió rechazar punto fuera de la ciudad';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'point_outside_city' THEN RAISE; END IF;
  END;

  -- Ruta válida: 4 puntos separados ~555 m (≈1,67 km)
  v_route := public.buky_create_athlete_route('Minha volta', 3303302,
    '[{"lat":-22.9000,"lon":-43.1200,"label":"Início"},{"lat":-22.9050,"lon":-43.1200},{"lat":-22.9100,"lon":-43.1200},{"lat":-22.9150,"lon":-43.1200}]');
  SELECT count(*) INTO v_n FROM public.buky_points WHERE route_id = v_route;
  IF v_n <> 4 THEN RAISE EXCEPTION 'la ruta del atleta debe tener 4 puntos'; END IF;
  IF (SELECT length_m FROM public.buky_routes WHERE id = v_route) NOT BETWEEN 1600 AND 1720 THEN
    RAISE EXCEPTION 'largo mal calculado: %', (SELECT length_m FROM public.buky_routes WHERE id = v_route);
  END IF;
  PERFORM set_config('buky.test_route', v_route::text, false);
END $$;

-- Iniciar entrenamientos: idempotente y uno solo en curso
SELECT (public.buky_start_session('5e000000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001')).status;
SELECT (public.buky_start_session('5e000000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001')).status;
SELECT public.buky_heartbeat('5e000000-0000-0000-0000-000000000001', 2, '0f000000-0000-0000-0000-0000000000a2');
DO $$
BEGIN
  IF (SELECT live_passes FROM public.buky_sessions WHERE id = '5e000000-0000-0000-0000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'heartbeat no actualizó';
  END IF;
  PERFORM public.buky_start_session('5e000000-0000-0000-0000-000000000002', '0f000000-0000-0000-0000-000000000001');
  IF (SELECT status FROM public.buky_sessions WHERE id = '5e000000-0000-0000-0000-000000000001') <> 'abandoned' THEN
    RAISE EXCEPTION 'el entrenamiento anterior debe quedar abandonado';
  END IF;
  -- Sesión en ruta del atleta (para la prueba de topes)
  PERFORM public.buky_start_session('5e000000-0000-0000-0000-000000000003', current_setting('buky.test_route')::uuid);
END $$;
COMMIT;

-- ================= Atleta B: no ve nada de A =================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.buky_routes WHERE kind = 'athlete') THEN
    RAISE EXCEPTION 'B no debe ver rutas de A';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_points p JOIN public.buky_routes r ON r.id = p.route_id WHERE r.kind = 'athlete')
     OR (SELECT count(*) FROM public.buky_points) <> 3 THEN
    RAISE EXCEPTION 'B no debe ver puntos de rutas de A';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_sessions) THEN RAISE EXCEPTION 'B no debe ver sesiones de A'; END IF;
  BEGIN  -- B no puede secuestrar el id de sesión de A
    PERFORM public.buky_start_session('5e000000-0000-0000-0000-000000000002', '0f000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'debió rechazar id de sesión ajeno';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN  -- ni entrenar en la ruta privada de A
    PERFORM public.buky_start_session(gen_random_uuid(), (SELECT id FROM public.buky_routes WHERE name = 'Minha volta'));
    RAISE EXCEPTION 'debió rechazar ruta ajena';
  EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
ROLLBACK;

-- ================= Edge Function (service_role) cierra entrenamientos =================
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE r jsonb; v_route uuid;
BEGIN
  -- Ruta oficial: 3 pasadas válidas + 1 rechazada (caminando)
  r := public.buky_finalize_session('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
    'valid', NULL,
    '{"ended_at":"2026-11-03T10:30:00Z","distance_m":2100,"duration_s":900,"max_speed_kmh":14.2,"avg_speed_kmh":10.1}',
    '[{"point_id":"0f000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-03T10:10:00Z","distance_m":12,"accuracy_m":6,"speed_kmh":10,"valid":true},
      {"point_id":"0f000000-0000-0000-0000-0000000000a2","passed_at":"2026-11-03T10:15:00Z","distance_m":20,"accuracy_m":8,"speed_kmh":11,"valid":true},
      {"point_id":"0f000000-0000-0000-0000-0000000000a3","passed_at":"2026-11-03T10:20:00Z","distance_m":9,"accuracy_m":5,"speed_kmh":12,"valid":true},
      {"point_id":"0f000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-03T10:28:00Z","distance_m":15,"accuracy_m":7,"speed_kmh":4,"valid":false,"reject_reason":"too_slow"}]',
    'aaaaaaaa-0000-0000-0000-000000000001/5e000000-0000-0000-0000-000000000002.json.gz');
  RAISE NOTICE 'cierre oficial: %', r;
  IF (r ->> 'bukys')::int <> 3 OR (r ->> 'balance')::int <> 3 THEN RAISE EXCEPTION 'esperaba 3 Bukys: %', r; END IF;

  -- Reintento del cierre: no duplica
  r := public.buky_finalize_session('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
    'valid', NULL, '{}', '[{"point_id":"0f000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-03T10:10:00Z","valid":true}]');
  IF NOT (r ->> 'duplicate')::boolean THEN RAISE EXCEPTION 'el reintento debe ser idempotente'; END IF;
  IF (SELECT balance FROM public.buky_balances WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 3 THEN
    RAISE EXCEPTION 'el reintento duplicó Bukys';
  END IF;

  -- Ruta del atleta: 2 vueltas (8 pasadas) el mismo día → solo 4 (1 por punto por día)
  SELECT id INTO v_route FROM public.buky_routes WHERE name = 'Minha volta';
  r := public.buky_finalize_session('5e000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
    'valid', NULL, '{"ended_at":"2026-11-03T12:00:00Z","distance_m":3400}',
    (SELECT jsonb_agg(jsonb_build_object('point_id', p.id,
             'passed_at', ('2026-11-03T11:00:00Z'::timestamptz + make_interval(mins => lap * 20 + p.seq * 3)),
             'valid', true, 'speed_kmh', 11) ORDER BY lap, p.seq)
     FROM public.buky_points p, generate_series(0, 1) lap WHERE p.route_id = v_route));
  RAISE NOTICE 'cierre ruta atleta: %', r;
  IF (r ->> 'bukys')::int <> 4 THEN RAISE EXCEPTION 'esperaba 4 Bukys (1 por punto por día): %', r; END IF;
  IF (SELECT count(*) FROM public.buky_passes WHERE session_id = '5e000000-0000-0000-0000-000000000003'
      AND reject_reason = 'point_once_per_day') <> 4 THEN
    RAISE EXCEPTION 'las 4 pasadas repetidas deben marcarse point_once_per_day';
  END IF;
  -- Un solo movimiento consolidado por entrenamiento
  IF (SELECT count(*) FROM public.buky_ledger WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND kind = 'found') <> 2 THEN
    RAISE EXCEPTION 'debe haber 1 movimiento por entrenamiento';
  END IF;
END $$;

-- Tope diario: 3 sesiones más en otras rutas del atleta el mismo día (con 4 puntos cada una) → tope de 10
DO $$
DECLARE i int; v_route uuid; v_sess uuid; r jsonb; v_total int := 0;
BEGIN
  FOR i IN 1..2 LOOP
    v_route := gen_random_uuid();
    INSERT INTO public.buky_routes (id, name, city_code, kind, owner_id, length_m)
    VALUES (v_route, 'Extra ' || i, 3303302, 'athlete', 'aaaaaaaa-0000-0000-0000-000000000001', 1700);
    INSERT INTO public.buky_points (route_id, seq, lat, lon)
    SELECT v_route, s, -22.95 - i * 0.02 - s * 0.005, -43.10 FROM generate_series(0, 3) s;
    v_sess := gen_random_uuid();
    INSERT INTO public.buky_sessions (id, user_id, route_id) VALUES (v_sess, 'aaaaaaaa-0000-0000-0000-000000000001', v_route);
    r := public.buky_finalize_session(v_sess, 'aaaaaaaa-0000-0000-0000-000000000001', 'valid', NULL, '{}',
      (SELECT jsonb_agg(jsonb_build_object('point_id', id, 'passed_at', '2026-11-03T14:00:00Z'::timestamptz + make_interval(mins => i * 30 + seq), 'valid', true))
       FROM public.buky_points WHERE route_id = v_route));
    v_total := v_total + (r ->> 'bukys')::int;
  END LOOP;
  -- ya tenía 4 en rutas propias hoy: 4 + 4 + 2 = 10
  IF v_total <> 6 THEN RAISE EXCEPTION 'tope diario: esperaba 6 Bukys más, obtuvo %', v_total; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buky_passes WHERE reject_reason = 'daily_cap') THEN
    RAISE EXCEPTION 'faltan pasadas marcadas daily_cap';
  END IF;

  -- Al día siguiente (hora de Brasil) se renueva: 02:30Z del 4/11 todavía es 3/11 en São Paulo
  v_sess := gen_random_uuid();
  SELECT id INTO v_route FROM public.buky_routes WHERE name = 'Extra 1';
  INSERT INTO public.buky_sessions (id, user_id, route_id) VALUES (v_sess, 'aaaaaaaa-0000-0000-0000-000000000001', v_route);
  r := public.buky_finalize_session(v_sess, 'aaaaaaaa-0000-0000-0000-000000000001', 'valid', NULL, '{}',
    (SELECT jsonb_agg(jsonb_build_object('point_id', id, 'passed_at',
       CASE WHEN seq < 2 THEN '2026-11-04T02:30:00Z' ELSE '2026-11-04T03:30:00Z' END, 'valid', true))
     FROM public.buky_points WHERE route_id = v_route));
  IF (r ->> 'bukys')::int <> 2 THEN RAISE EXCEPTION 'zona horaria: esperaba 2 (solo los del día 4 en Brasil), obtuvo %', r; END IF;

  -- Entrenamiento inválido (vehículo): 0 Bukys, pasadas registradas como no válidas
  v_sess := gen_random_uuid();
  INSERT INTO public.buky_sessions (id, user_id, route_id) VALUES (v_sess, 'aaaaaaaa-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001');
  r := public.buky_finalize_session(v_sess, 'aaaaaaaa-0000-0000-0000-000000000001', 'invalid', 'vehicle', '{}',
    '[{"point_id":"0f000000-0000-0000-0000-0000000000a1","passed_at":"2026-11-03T16:00:00Z","valid":true}]');
  IF (r ->> 'bukys')::int <> 0 OR (SELECT reject_reason FROM public.buky_passes WHERE session_id = v_sess) <> 'vehicle' THEN
    RAISE EXCEPTION 'sesión inválida no debe dar Bukys: %', r;
  END IF;
END $$;
COMMIT;

-- ================= Admin =================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
DO $$
DECLARE r jsonb; v_before int;
BEGIN
  SELECT balance INTO v_before FROM public.buky_balances WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  RAISE NOTICE 'saldo de A antes del admin: %', v_before;  -- 3 + 4 + 6 + 2 = 15
  IF v_before <> 15 THEN RAISE EXCEPTION 'saldo esperado 15, es %', v_before; END IF;
  r := public.admin_buky_gift('aaaaaaaa-0000-0000-0000-000000000001', 5, 'Prêmio de boas-vindas');
  IF (r ->> 'balance')::int <> 20 THEN RAISE EXCEPTION 'regalo: %', r; END IF;
  r := public.admin_buky_invalidate_session('5e000000-0000-0000-0000-000000000002', 'GPS sospechoso');
  RAISE NOTICE 'anulación: %', r;
  IF (r ->> 'bukys_removed')::int <> 3 THEN RAISE EXCEPTION 'anulación: %', r; END IF;
  r := public.admin_buky_invalidate_session('5e000000-0000-0000-0000-000000000002', 'GPS sospechoso');
  IF (r ->> 'changed')::boolean THEN RAISE EXCEPTION 'la anulación debe ser idempotente'; END IF;
  -- El libro es inmutable incluso para el admin
  BEGIN
    UPDATE public.buky_ledger SET amount = 999;
    RAISE EXCEPTION 'el libro no debe poder modificarse';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
COMMIT;

-- ================= Resumen de A =================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
SELECT public.buky_my_summary() AS resumen_a;
DO $$
DECLARE s jsonb := public.buky_my_summary();
BEGIN
  IF (s ->> 'balance')::int <> 17 OR (s ->> 'found_total')::int <> 15 OR (s ->> 'gift_total')::int <> 5 THEN
    RAISE EXCEPTION 'resumen incorrecto: %', s;
  END IF;
  -- Coherencia: saldo = suma del libro
  IF (SELECT sum(amount) FROM public.buky_ledger WHERE user_id = auth.uid()) <> (s ->> 'balance')::int THEN
    RAISE EXCEPTION 'saldo y libro no cuadran';
  END IF;
END $$;
ROLLBACK;

-- ================= Anónimo: sin acceso =================
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.buky_routes;
    RAISE EXCEPTION 'anon no debe leer rutas';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.buky_start_session(gen_random_uuid(), '0f000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'anon no debe iniciar sesiones';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
