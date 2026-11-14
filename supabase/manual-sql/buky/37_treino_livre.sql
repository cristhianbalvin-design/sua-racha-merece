-- Entrenamiento libre y cupo diario por sesiones con Bukys. Re-ejecutable.
BEGIN;
INSERT INTO public.app_settings (key, value, description) VALUES
 ('buky_free_km_per_buky', '1.5', 'Km de recorrido válido por Buky no treino livre')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.buky_sessions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'route';
ALTER TABLE public.buky_sessions ADD COLUMN IF NOT EXISTS route_polyline text;
ALTER TABLE public.buky_sessions ADD COLUMN IF NOT EXISTS free_km_per_buky numeric(4,2);
ALTER TABLE public.buky_sessions ALTER COLUMN route_id DROP NOT NULL;
ALTER TABLE public.buky_passes ALTER COLUMN route_id DROP NOT NULL;
ALTER TABLE public.buky_passes ALTER COLUMN point_id DROP NOT NULL;
ALTER TABLE public.buky_passes ADD COLUMN IF NOT EXISTS km_mark numeric(6,2);
ALTER TABLE public.buky_sessions DROP CONSTRAINT IF EXISTS buky_sessions_mode_check;
ALTER TABLE public.buky_sessions ADD CONSTRAINT buky_sessions_mode_check CHECK (mode IN ('route', 'free'));
ALTER TABLE public.buky_sessions DROP CONSTRAINT IF EXISTS buky_sessions_mode_route_check;
ALTER TABLE public.buky_sessions ADD CONSTRAINT buky_sessions_mode_route_check CHECK ((mode = 'route') = (route_id IS NOT NULL));
ALTER TABLE public.buky_passes DROP CONSTRAINT IF EXISTS buky_passes_free_mark_check;
ALTER TABLE public.buky_passes ADD CONSTRAINT buky_passes_free_mark_check CHECK ((route_kind = 'free') = (point_id IS NULL AND km_mark IS NOT NULL));
CREATE OR REPLACE FUNCTION public.buky_free_km_per_buky() RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT CASE WHEN n BETWEEN 0.5 AND 10 THEN n ELSE 1.5 END FROM (SELECT public.buky_setting_num('buky_free_km_per_buky', 1.5) n) s
$$;
CREATE OR REPLACE FUNCTION public.buky_sessions_counted_today(p_uid uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT count(*) FROM public.buky_sessions WHERE user_id = p_uid AND status = 'valid' AND bukys_awarded > 0
 AND (started_at AT TIME ZONE public.buky_tz())::date = (now() AT TIME ZONE public.buky_tz())::date
$$;
DROP FUNCTION IF EXISTS public.buky_start_session(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.buky_finalize_session(uuid, uuid, text, text, jsonb, jsonb, text);
CREATE OR REPLACE FUNCTION public.buky_start_session(p_session_id uuid, p_route_id uuid, p_client jsonb DEFAULT NULL, p_mode text DEFAULT 'route')
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

  -- Serializa los inicios del mismo atleta antes de contar las sesiones.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 31));
  SELECT * INTO v_session FROM public.buky_sessions WHERE id = p_session_id;
  IF FOUND THEN
    IF v_session.user_id <> v_uid THEN
      RAISE EXCEPTION 'session_conflict' USING ERRCODE = '42501';
    END IF;
    RETURN v_session;
  END IF;
  IF NOT public.buky_is_route_tester() AND
    public.buky_sessions_counted_today(v_uid)
      >= (CASE WHEN public.user_is_premium(v_uid)
        THEN public.buky_setting_num('buky_daily_sessions_premium', 2)
        ELSE public.buky_setting_num('buky_daily_sessions_freemium', 3) END) THEN
    RAISE EXCEPTION 'daily_sessions_limit' USING ERRCODE = 'P0001';
  END IF;

  -- Ronda 3: solo la app instalada recolecta (la web no inicia entrenamientos). Los testadores pueden
  -- probar desde el navegador.
  IF coalesce(p_client ->> 'platform', '') <> 'native' AND NOT public.buky_is_route_tester() THEN
    RAISE EXCEPTION 'app_required' USING ERRCODE = 'P0001',
      DETAIL = 'Para coletar Bukys use o app instalado';
  END IF;

  IF public.buky_bike_stops_on(v_uid, (now() AT TIME ZONE public.buky_tz())::date)
     >= public.buky_setting_num('buky_bike_stops_to_block', 2) THEN
    RAISE EXCEPTION 'blocked_today' USING ERRCODE = 'P0001',
      DETAIL = 'Entrenamientos cortados por bicicleta hoy; se libera a las 00:00';
  END IF;

  IF p_mode NOT IN ('route', 'free') OR p_mode IS NULL OR (p_mode = 'free') <> (p_route_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_mode_or_route' USING ERRCODE = '22023';
  END IF;
  IF p_mode = 'route' THEN
    SELECT * INTO v_route FROM public.buky_routes WHERE id = p_route_id;
    IF NOT FOUND OR NOT v_route.active OR (v_route.kind = 'athlete' AND v_route.owner_id <> v_uid) THEN
      RAISE EXCEPTION 'route_not_available' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.buky_sessions SET status = 'abandoned'
  WHERE user_id = v_uid AND status = 'running';

  INSERT INTO public.buky_sessions (id, user_id, route_id, client, mode)
  VALUES (p_session_id, v_uid, p_route_id, p_client, p_mode)
  RETURNING * INTO v_session;
  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_finalize_session(
  p_session_id uuid, p_user_id uuid, p_status text, p_reason text,
  p_stats jsonb, p_passes jsonb, p_track_path text DEFAULT NULL, p_polyline text DEFAULT NULL)
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
  v_day_cap integer := CASE WHEN public.user_is_premium(p_user_id) THEN public.buky_setting_num('buky_daily_cap_premium', 21) ELSE public.buky_setting_num('buky_daily_cap_total', 12) END;
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
  v_sessions_full boolean;
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 31));
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

  v_sessions_full := NOT EXISTS (SELECT 1 FROM public.buky_route_testers WHERE user_id = p_user_id)
    AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'ADMIN')
    AND public.buky_sessions_counted_today(p_user_id) >= CASE WHEN public.user_is_premium(p_user_id)
      THEN public.buky_setting_num('buky_daily_sessions_premium', 1)
      ELSE public.buky_setting_num('buky_daily_sessions_freemium', 1) END;

  FOR v_p IN SELECT value FROM jsonb_array_elements(coalesce(p_passes, '[]'::jsonb))
             ORDER BY (value ->> 'passed_at')::timestamptz LOOP
    v_point := (v_p ->> 'point_id')::uuid;
    v_at := (v_p ->> 'passed_at')::timestamptz;
    SELECT EXISTS (SELECT 1 FROM public.buky_points WHERE id = v_point AND route_id = v_route.id) INTO v_point_ok;
    IF v_session.mode = 'route' AND NOT v_point_ok THEN
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
      IF v_sessions_full THEN
        v_award := false; v_reason := 'daily_sessions_limit';
      ELSIF v_session.mode = 'route' AND v_prev_n >= v_per_point THEN
        v_award := false; v_reason := 'point_daily_limit';
      ELSIF v_session.mode = 'route' AND v_prev_last IS NOT NULL AND v_at < v_prev_last + v_gap THEN
        v_award := false; v_reason := 'point_too_soon';
      ELSIF (SELECT count(*) FROM public.buky_passes
             WHERE user_id = p_user_id AND local_day = v_day AND awarded) >= v_day_cap THEN
        v_award := false; v_reason := 'daily_total_cap';
      ELSIF v_route.kind = 'athlete' AND (SELECT count(*) FROM public.buky_passes
             WHERE user_id = p_user_id AND local_day = v_day AND awarded AND route_kind = 'athlete') >= v_cap THEN
        v_award := false; v_reason := 'daily_cap';
      END IF;
    END IF;

    INSERT INTO public.buky_passes (session_id, user_id, route_id, route_kind, point_id, passed_at, local_day,
                                    distance_m, accuracy_m, speed_kmh, valid, awarded, reject_reason, km_mark)
    VALUES (p_session_id, p_user_id, v_route.id, CASE WHEN v_session.mode = 'free' THEN 'free' ELSE v_route.kind END, v_point, v_at, v_day,
            (v_p ->> 'distance_m')::numeric, (v_p ->> 'accuracy_m')::numeric, (v_p ->> 'speed_kmh')::numeric,
            v_valid, v_award, CASE WHEN v_award THEN NULL ELSE v_reason END, (v_p ->> 'km_mark')::numeric);

    IF v_award THEN v_awarded := v_awarded + 1; END IF;
    IF v_valid THEN v_valid_n := v_valid_n + 1; ELSE v_rejected := v_rejected + 1; END IF;
  END LOOP;

  IF v_awarded > 0 THEN
    v_balance := (public.apply_buky_movement(p_user_id, 'found', v_awarded, 'session', p_session_id::text,
                                             'session:' || p_session_id, CASE WHEN v_session.mode = 'free' THEN 'Treino livre' ELSE v_route.name END) ->> 'balance')::integer;
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
    route_polyline = p_polyline,
    free_km_per_buky = CASE WHEN v_session.mode = 'free' THEN CASE WHEN (p_stats ->> 'free_km_per_buky')::numeric BETWEEN 0.5 AND 10 THEN (p_stats ->> 'free_km_per_buky')::numeric ELSE public.buky_free_km_per_buky() END ELSE NULL END,
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
    'plan', CASE WHEN public.user_is_premium(auth.uid()) THEN 'premium' ELSE 'freemium' END,
    'sessions_today', public.buky_sessions_counted_today(auth.uid()),
    'sessions_max', CASE WHEN public.user_is_premium(auth.uid()) THEN public.buky_setting_num('buky_daily_sessions_premium', 2) ELSE public.buky_setting_num('buky_daily_sessions_freemium', 3) END,
    'bukys_today', (SELECT count(*) FROM public.buky_passes WHERE user_id = auth.uid() AND awarded AND local_day = (now() AT TIME ZONE public.buky_tz())::date),
    'bukys_max', CASE WHEN public.user_is_premium(auth.uid()) THEN public.buky_setting_num('buky_daily_cap_premium', 21) ELSE public.buky_setting_num('buky_daily_cap_total', 12) END,
    'bike_stops_today', public.buky_bike_stops_on(auth.uid(), (now() AT TIME ZONE public.buky_tz())::date),
    'blocked_today', public.buky_bike_stops_on(auth.uid(), (now() AT TIME ZONE public.buky_tz())::date)
                     >= public.buky_setting_num('buky_bike_stops_to_block', 2),
    'rules', jsonb_build_object(
      'free_km_per_buky', public.buky_free_km_per_buky(),
      'speed_min_kmh', public.buky_setting_num('buky_speed_min_kmh', 6),
      'speed_max_kmh', public.buky_setting_num('buky_speed_max_kmh', 25),
      'speed_window_s', public.buky_setting_num('buky_speed_window_s', 30),
      'vehicle_window_s', public.buky_setting_num('buky_vehicle_window_s', 60),
      'max_accuracy_m', public.buky_setting_num('buky_max_accuracy_m', 25),
      'mock_max_ratio', public.buky_setting_num('buky_mock_max_ratio', 0.05),
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

REVOKE ALL ON FUNCTION public.buky_sessions_counted_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_free_km_per_buky() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_start_session(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_start_session(uuid, uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.buky_finalize_session(uuid, uuid, text, text, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buky_finalize_session(uuid, uuid, text, text, jsonb, jsonb, text, text) TO service_role;
COMMIT;
