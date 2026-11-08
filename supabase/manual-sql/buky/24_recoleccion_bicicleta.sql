-- Paso 24 · Reglas de recolección, límite de tiempo y bicicleta (decisiones del cliente, 8/11/2026).
--   · Máximo 2 Bukys por punto, por atleta y por día (todas las rutas). Para el 2.º hay que salir del
--     radio (lo hace el motor), dejar pasar al menos 3 min desde el 1.º y volver a entrar.
--     El día se reinicia a las 00:00 hora de Brasil (buky_timezone).
--   · Cada entrenamiento guarda la ciudad donde empezó (start_city_code).
--   · Entrenamiento de 1 hora como máximo: la app lo cierra sola y el servidor ignora lo que pase después.
--   · Bicicleta: un aviso cuando la velocidad supera 25 km/h durante 30 s seguidos SIN pasos del
--     podómetro (sin podómetro, p. ej. en la web: solo velocidad durante 60 s). Al 3.º aviso la app
--     corta el entrenamiento; los Bukys legítimos de antes se conservan. Un 2.º corte en el mismo día
--     bloquea entrenar hasta el día siguiente (propuesta enviada al cliente; configurable).
--   · Ya no se anula el entrenamiento entero por "vehículo": cada pasada rápida se rechaza sola.
--   · Contadores históricos para la Fase 1: patrocinio con 200 Bukys y foto gratis con 300,
--     contando SOLO los recogidos corriendo (found_total), nunca los regalados.
-- Va después del 23. Idempotente.
BEGIN;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('buky_point_max_per_day', '2', 'Bukys máximos por punto, por atleta y por día'),
  ('buky_point_min_gap_min', '3', 'Minutos mínimos entre dos Bukys del mismo punto'),
  ('buky_session_max_min', '60', 'Duración máxima de un entrenamiento (min); al cumplirse se cierra solo'),
  ('buky_bike_speed_kmh', '25', 'Bicicleta: velocidad a partir de la cual se cuenta un aviso (km/h)'),
  ('buky_bike_window_s', '30', 'Bicicleta: segundos seguidos por encima de la velocidad y sin pasos para un aviso'),
  ('buky_bike_window_nosteps_s', '60', 'Bicicleta sin podómetro (web o permiso negado): segundos seguidos por encima de la velocidad para un aviso'),
  ('buky_bike_warnings_to_stop', '3', 'Bicicleta: avisos que cortan el entrenamiento'),
  ('buky_bike_stops_to_block', '2', 'Bicicleta: cortes en el mismo día que bloquean entrenar hasta el día siguiente (1 = bloquear desde el primero)'),
  ('buky_sponsorship_min_found', '200', 'Bukys recogidos corriendo (históricos) para participar del patrocinio'),
  ('buky_free_photo_min_found', '300', 'Bukys recogidos corriendo (históricos) para la foto gratis Freemium'),
  ('buky_city_match_km', '40', 'Distancia máxima (km) al centro de una ciudad para ubicar una posición en ella')
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings
SET description = 'Ya no anula el entrenamiento (paso 24); ver buky_bike_*'
WHERE key = 'buky_vehicle_window_s';

ALTER TABLE public.buky_sessions ADD COLUMN IF NOT EXISTS start_city_code integer REFERENCES public.br_cities(code);
ALTER TABLE public.buky_sessions ADD COLUMN IF NOT EXISTS stop_reason text;
ALTER TABLE public.buky_sessions ADD COLUMN IF NOT EXISTS bike_warnings smallint NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.buky_sessions ADD CONSTRAINT buky_sessions_stop_reason
    CHECK (stop_reason IS NULL OR stop_reason IN ('user', 'time_limit', 'bike'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS buky_passes_user_point_idx ON public.buky_passes (user_id, point_id, local_day) WHERE awarded;

-- Ciudad (municipio) cuyo centro está más cerca de una posición, dentro de buky_city_match_km.
CREATE OR REPLACE FUNCTION public.buky_city_at(p_lat double precision, p_lon double precision)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT c.code
  FROM public.br_cities c
  WHERE p_lat IS NOT NULL AND p_lon IS NOT NULL
    AND c.lat BETWEEN p_lat - 0.6 AND p_lat + 0.6
    AND c.lon BETWEEN p_lon - 0.6 AND p_lon + 0.6
    AND public.buky_distance_m(p_lat, p_lon, c.lat, c.lon) <= public.buky_setting_num('buky_city_match_km', 40) * 1000
  ORDER BY public.buky_distance_m(p_lat, p_lon, c.lat, c.lon)
  LIMIT 1
$$;

-- Cortes por bicicleta del atleta en un día local.
CREATE OR REPLACE FUNCTION public.buky_bike_stops_on(p_user_id uuid, p_day date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT count(*)::integer FROM public.buky_sessions
  WHERE user_id = p_user_id AND stop_reason = 'bike'
    AND (started_at AT TIME ZONE public.buky_tz())::date = p_day
$$;

-- Inicio del entrenamiento: igual que el paso 16, más el bloqueo por bicicleta.
CREATE OR REPLACE FUNCTION public.buky_start_session(p_session_id uuid, p_route_id uuid, p_client jsonb DEFAULT NULL)
RETURNS public.buky_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.buky_sessions%ROWTYPE;
  v_route public.buky_routes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.buky_sessions WHERE id = p_session_id;
  IF FOUND THEN
    IF v_session.user_id <> v_uid THEN
      RAISE EXCEPTION 'session_conflict' USING ERRCODE = '42501';
    END IF;
    RETURN v_session;  -- reintento del mismo inicio
  END IF;

  IF public.buky_bike_stops_on(v_uid, (now() AT TIME ZONE public.buky_tz())::date)
     >= public.buky_setting_num('buky_bike_stops_to_block', 2) THEN
    RAISE EXCEPTION 'blocked_today' USING ERRCODE = 'P0001',
      DETAIL = 'Entrenamientos cortados por bicicleta hoy; se libera a las 00:00';
  END IF;

  SELECT * INTO v_route FROM public.buky_routes WHERE id = p_route_id;
  IF NOT FOUND OR NOT v_route.active
     OR (v_route.kind = 'athlete' AND v_route.owner_id <> v_uid) THEN
    RAISE EXCEPTION 'route_not_available' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.buky_sessions SET status = 'abandoned'
  WHERE user_id = v_uid AND status = 'running';

  INSERT INTO public.buky_sessions (id, user_id, route_id, client)
  VALUES (p_session_id, v_uid, p_route_id, p_client)
  RETURNING * INTO v_session;
  RETURN v_session;
END;
$$;

-- Cierre del entrenamiento (paso 16) con las reglas nuevas por punto y los datos de bicicleta.
-- p_stats suma: start_lat, start_lon, stop_reason ('user' | 'time_limit' | 'bike'), bike_warnings.
CREATE OR REPLACE FUNCTION public.buky_finalize_session(
  p_session_id uuid, p_user_id uuid, p_status text, p_reason text,
  p_stats jsonb, p_passes jsonb, p_track_path text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session public.buky_sessions%ROWTYPE;
  v_route public.buky_routes%ROWTYPE;
  v_tz text := public.buky_tz();
  v_cap integer := public.buky_setting_num('buky_athlete_route_daily_cap', 10);
  v_per_point integer := public.buky_setting_num('buky_point_max_per_day', 2);
  v_gap interval := make_interval(secs => public.buky_setting_num('buky_point_min_gap_min', 3) * 60);
  v_p jsonb;
  v_point uuid;
  v_at timestamptz;
  v_point_ok boolean;
  v_day date;
  v_valid boolean;
  v_award boolean;
  v_reason text;
  v_prev_n integer;
  v_prev_last timestamptz;
  v_awarded integer := 0;
  v_valid_n integer := 0;
  v_rejected integer := 0;
  v_balance integer;
  v_stop text := nullif(p_stats ->> 'stop_reason', '');
BEGIN
  IF NOT (session_user IN ('postgres', 'supabase_admin') OR coalesce(auth.jwt() ->> 'role', '') = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('valid', 'invalid') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  IF v_stop IS NOT NULL AND v_stop NOT IN ('user', 'time_limit', 'bike') THEN
    v_stop := NULL;
  END IF;

  SELECT * INTO v_session FROM public.buky_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status IN ('valid', 'invalid') THEN
    RETURN jsonb_build_object('status', v_session.status, 'bukys', v_session.bukys_awarded,
                              'duplicate', true, 'reason', v_session.invalid_reason,
                              'stop_reason', v_session.stop_reason);
  END IF;
  SELECT * INTO v_route FROM public.buky_routes WHERE id = v_session.route_id;

  -- Bloquea el saldo del atleta: dos cierres simultáneos no superan los topes diarios.
  INSERT INTO public.buky_balances (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.buky_balances WHERE user_id = p_user_id FOR UPDATE;

  FOR v_p IN SELECT value FROM jsonb_array_elements(coalesce(p_passes, '[]'::jsonb))
             ORDER BY (value ->> 'passed_at')::timestamptz LOOP
    v_point := (v_p ->> 'point_id')::uuid;
    v_at := (v_p ->> 'passed_at')::timestamptz;
    SELECT EXISTS (SELECT 1 FROM public.buky_points WHERE id = v_point AND route_id = v_route.id) INTO v_point_ok;
    IF NOT v_point_ok THEN
      CONTINUE;  -- punto ajeno a la ruta: se ignora
    END IF;
    v_day := (v_at AT TIME ZONE v_tz)::date;
    v_valid := p_status = 'valid' AND coalesce((v_p ->> 'valid')::boolean, false);
    v_reason := CASE WHEN p_status = 'invalid' THEN coalesce(p_reason, 'session_invalid')
                     ELSE nullif(v_p ->> 'reject_reason', '') END;
    v_award := v_valid;

    IF v_award THEN
      SELECT count(*), max(passed_at) INTO v_prev_n, v_prev_last
      FROM public.buky_passes
      WHERE user_id = p_user_id AND point_id = v_point AND local_day = v_day AND awarded;
      IF v_prev_n >= v_per_point THEN
        v_award := false; v_reason := 'point_daily_limit';
      ELSIF v_prev_last IS NOT NULL AND v_at < v_prev_last + v_gap THEN
        v_award := false; v_reason := 'point_too_soon';
      ELSIF v_route.kind = 'athlete' AND (SELECT count(*) FROM public.buky_passes
             WHERE user_id = p_user_id AND local_day = v_day AND awarded AND route_kind = 'athlete') >= v_cap THEN
        v_award := false; v_reason := 'daily_cap';
      END IF;
    END IF;

    INSERT INTO public.buky_passes (session_id, user_id, route_id, route_kind, point_id, passed_at, local_day,
                                    distance_m, accuracy_m, speed_kmh, valid, awarded, reject_reason)
    VALUES (p_session_id, p_user_id, v_route.id, v_route.kind, v_point, v_at, v_day,
            (v_p ->> 'distance_m')::numeric, (v_p ->> 'accuracy_m')::numeric, (v_p ->> 'speed_kmh')::numeric,
            v_valid, v_award, CASE WHEN v_award THEN NULL ELSE v_reason END);

    IF v_award THEN v_awarded := v_awarded + 1; END IF;
    IF v_valid THEN v_valid_n := v_valid_n + 1; ELSE v_rejected := v_rejected + 1; END IF;
  END LOOP;

  IF v_awarded > 0 THEN
    v_balance := (public.apply_buky_movement(p_user_id, 'found', v_awarded, 'session', p_session_id::text,
                                             'session:' || p_session_id, v_route.name) ->> 'balance')::integer;
  END IF;

  UPDATE public.buky_sessions SET
    status = p_status,
    invalid_reason = CASE WHEN p_status = 'invalid' THEN coalesce(p_reason, 'session_invalid') END,
    ended_at = coalesce((p_stats ->> 'ended_at')::timestamptz, now()),
    distance_m = (p_stats ->> 'distance_m')::numeric,
    duration_s = (p_stats ->> 'duration_s')::numeric,
    max_speed_kmh = (p_stats ->> 'max_speed_kmh')::numeric,
    avg_speed_kmh = (p_stats ->> 'avg_speed_kmh')::numeric,
    passes_valid = v_valid_n,
    passes_rejected = v_rejected,
    bukys_awarded = v_awarded,
    track_path = p_track_path,
    start_city_code = public.buky_city_at((p_stats ->> 'start_lat')::double precision, (p_stats ->> 'start_lon')::double precision),
    stop_reason = v_stop,
    bike_warnings = least(greatest(coalesce((p_stats ->> 'bike_warnings')::integer, 0), 0), 100),
    finalized_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', p_status, 'bukys', v_awarded, 'passes_valid', v_valid_n,
                            'passes_rejected', v_rejected, 'reason', p_reason, 'duplicate', false,
                            'stop_reason', v_stop,
                            'balance', coalesce(v_balance,
                              (SELECT balance FROM public.buky_balances WHERE user_id = p_user_id)));
END;
$$;

-- Estado del atleta para la app: progreso histórico (Fase 1) y reglas del entrenamiento.
CREATE OR REPLACE FUNCTION public.buky_my_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'found_total', coalesce((SELECT found_total FROM public.buky_balances WHERE user_id = auth.uid()), 0),
    'gift_total', coalesce((SELECT gift_total FROM public.buky_balances WHERE user_id = auth.uid()), 0),
    'sponsorship_min', public.buky_setting_num('buky_sponsorship_min_found', 200),
    'free_photo_min', public.buky_setting_num('buky_free_photo_min_found', 300),
    'tester', public.buky_is_route_tester(),
    'bike_stops_today', public.buky_bike_stops_on(auth.uid(), (now() AT TIME ZONE public.buky_tz())::date),
    'blocked_today', public.buky_bike_stops_on(auth.uid(), (now() AT TIME ZONE public.buky_tz())::date)
                     >= public.buky_setting_num('buky_bike_stops_to_block', 2),
    'rules', jsonb_build_object(
      'session_max_min', public.buky_setting_num('buky_session_max_min', 60),
      'point_max_per_day', public.buky_setting_num('buky_point_max_per_day', 2),
      'point_min_gap_min', public.buky_setting_num('buky_point_min_gap_min', 3),
      'bike_speed_kmh', public.buky_setting_num('buky_bike_speed_kmh', 25),
      'bike_window_s', public.buky_setting_num('buky_bike_window_s', 30),
      'bike_window_nosteps_s', public.buky_setting_num('buky_bike_window_nosteps_s', 60),
      'bike_warnings_to_stop', public.buky_setting_num('buky_bike_warnings_to_stop', 3),
      'bike_stops_to_block', public.buky_setting_num('buky_bike_stops_to_block', 2))
  ) END
$$;

REVOKE ALL ON FUNCTION public.buky_city_at(double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_bike_stops_on(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_my_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_city_at(double precision, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buky_my_status() TO authenticated;

COMMIT;
