-- Habilitación del entrenamiento libre por ciudad. Re-ejecutable.
BEGIN;
ALTER TABLE public.br_cities ADD COLUMN IF NOT EXISTS buky_free_enabled boolean NOT NULL DEFAULT false;
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
  IF p_mode = 'free' AND NOT public.buky_is_route_tester() AND NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.br_cities c ON c.code = u.city_code
    WHERE u.id = v_uid AND c.buky_free_enabled
  ) THEN
    RAISE EXCEPTION 'free_not_enabled' USING ERRCODE = 'P0001';
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
    'free_enabled', public.buky_is_route_tester() OR EXISTS (SELECT 1 FROM public.users u JOIN public.br_cities c ON c.code = u.city_code WHERE u.id = auth.uid() AND c.buky_free_enabled),
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

CREATE OR REPLACE FUNCTION public.buky_admin_set_free_enabled(p_city_code integer, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'invalid_value' USING ERRCODE = '22023'; END IF;
  UPDATE public.br_cities SET buky_free_enabled = p_enabled WHERE code = p_city_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'city_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.buky_start_session(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_start_session(uuid, uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.buky_admin_set_free_enabled(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_admin_set_free_enabled(integer, boolean) TO authenticated;
COMMIT;
