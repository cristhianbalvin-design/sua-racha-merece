-- Entrega F. Aplicar después del paso 30; re-ejecutable.
BEGIN;
INSERT INTO public.app_settings (key, value, description) VALUES
 ('buky_daily_cap_premium', '21', 'Bukys diarios Premium'),
 ('buky_daily_sessions_freemium', '3', 'Entrenamientos diarios Freemium'),
 ('buky_daily_sessions_premium', '2', 'Entrenamientos diarios Premium'),
 ('wallet_topup_min_cents', '1000', 'Recarga mínima en centavos'),
 ('wallet_topup_max_cents', '20000', 'Recarga máxima en centavos')
ON CONFLICT (key) DO NOTHING;

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
    (SELECT count(*) FROM public.buky_sessions WHERE user_id = v_uid
      AND (started_at AT TIME ZONE public.buky_tz())::date = (now() AT TIME ZONE public.buky_tz())::date)
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
      ELSIF (SELECT count(*) FROM public.buky_passes
             WHERE user_id = p_user_id AND local_day = v_day AND awarded) >= v_day_cap THEN
        v_award := false; v_reason := 'daily_total_cap';
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
    'sessions_today', (SELECT count(*) FROM public.buky_sessions WHERE user_id = auth.uid() AND (started_at AT TIME ZONE public.buky_tz())::date = (now() AT TIME ZONE public.buky_tz())::date),
    'sessions_max', CASE WHEN public.user_is_premium(auth.uid()) THEN public.buky_setting_num('buky_daily_sessions_premium', 2) ELSE public.buky_setting_num('buky_daily_sessions_freemium', 3) END,
    'bukys_today', (SELECT count(*) FROM public.buky_passes WHERE user_id = auth.uid() AND awarded AND local_day = (now() AT TIME ZONE public.buky_tz())::date),
    'bukys_max', CASE WHEN public.user_is_premium(auth.uid()) THEN public.buky_setting_num('buky_daily_cap_premium', 21) ELSE public.buky_setting_num('buky_daily_cap_total', 12) END,
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

CREATE TABLE IF NOT EXISTS public.photo_face_matches (
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 photo_id uuid NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
 similarity double precision NOT NULL, matched_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, photo_id)
);
ALTER TABLE public.photo_face_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_face_matches FROM anon, authenticated;
GRANT SELECT ON public.photo_face_matches TO authenticated;
GRANT ALL ON public.photo_face_matches TO service_role;
DROP POLICY IF EXISTS photo_face_matches_read ON public.photo_face_matches;
CREATE POLICY photo_face_matches_read ON public.photo_face_matches FOR SELECT TO authenticated
 USING (user_id = auth.uid() OR public.is_admin());
CREATE TABLE IF NOT EXISTS public.user_private (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 cpf text NOT NULL, cpf_set_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_private FROM anon, authenticated;
GRANT SELECT ON public.user_private TO authenticated;
DROP POLICY IF EXISTS user_private_read ON public.user_private;
CREATE POLICY user_private_read ON public.user_private FOR SELECT TO authenticated
 USING (user_id = auth.uid() OR public.is_admin());
ALTER TABLE public.photo_downloads ADD COLUMN IF NOT EXISTS cpf text;

CREATE OR REPLACE FUNCTION public.buky_valid_cpf(p_cpf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE d text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'); s integer; v integer; i integer;
BEGIN
 IF length(d) <> 11 OR d ~ '^([0-9])\1{10}$' THEN RETURN false; END IF;
 FOR v IN 1..2 LOOP
   s := 0;
   FOR i IN 1..(8 + v) LOOP s := s + substr(d, i, 1)::integer * (10 + v - i); END LOOP;
   IF (CASE WHEN (s * 10) % 11 = 10 THEN 0 ELSE (s * 10) % 11 END) <> substr(d, 9 + v, 1)::integer THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.set_my_cpf(p_cpf text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF NOT public.buky_valid_cpf(p_cpf) THEN RAISE EXCEPTION 'invalid_cpf'; END IF;
 INSERT INTO public.user_private(user_id, cpf, cpf_set_at)
 VALUES (auth.uid(), regexp_replace(p_cpf, '[^0-9]', '', 'g'), now())
 ON CONFLICT (user_id) DO UPDATE SET cpf = excluded.cpf, cpf_set_at = excluded.cpf_set_at;
END $$;
CREATE OR REPLACE FUNCTION public.get_my_cpf_masked()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT '***.***.*' || substr(cpf, 8, 2) || '-' || substr(cpf, 10, 2)
 FROM public.user_private WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.set_my_cpf(text), public.get_my_cpf_masked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_cpf(text), public.get_my_cpf_masked() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid, p_confirm_purchase boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status jsonb;
  v_charge text;
  v_price integer := 0;
  v_cpf text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 12));

  IF NOT EXISTS (SELECT 1 FROM public.event_photos WHERE id = p_event_photo_id AND status = 'published') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'photo_not_available');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.photo_face_matches WHERE user_id = v_user_id AND photo_id = p_event_photo_id) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_recognized');
  END IF;
  SELECT cpf INTO v_cpf FROM public.user_private WHERE user_id = v_user_id;
  IF v_cpf IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cpf_required');
  END IF;

  IF EXISTS (SELECT 1 FROM public.photo_downloads WHERE user_id = v_user_id AND event_photo_id = p_event_photo_id) THEN
    v_charge := 'again';  -- volver a bajar es gratis
  ELSIF public.is_admin() THEN
    v_charge := 'admin';
  ELSE
    v_status := public.get_my_download_status();
    IF (v_status ->> 'free_remaining')::integer > 0 THEN
      v_charge := 'free';
    ELSE
      v_price := (v_status ->> 'price_cents')::integer;
      IF NOT coalesce(p_confirm_purchase, false) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'purchase_required', 'price_cents', v_price, 'status', v_status);
      END IF;
      BEGIN
        PERFORM public.apply_wallet_movement(v_user_id, -v_price, 'photo_purchase', 'event_photo', p_event_photo_id::text,
                                             'photo:' || p_event_photo_id::text, NULL);
      EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'insufficient_balance' THEN RAISE; END IF;
        RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_balance', 'price_cents', v_price, 'status', v_status);
      END;
      v_charge := 'paid';
    END IF;
  END IF;

  IF v_charge = 'again' THEN
    UPDATE public.photo_downloads SET last_downloaded_at = now(), download_count = download_count + 1, cpf = v_cpf
    WHERE user_id = v_user_id AND event_photo_id = p_event_photo_id;
  ELSE
    INSERT INTO public.photo_downloads (user_id, event_photo_id, charge, amount_cents, cpf)
    VALUES (v_user_id, p_event_photo_id, v_charge, v_price, v_cpf);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'charged', CASE v_charge WHEN 'paid' THEN 'wallet' WHEN 'free' THEN 'free' ELSE 'none' END,
                            'price_cents', v_price, 'status', public.get_my_download_status());
END;
$$;
CREATE OR REPLACE FUNCTION public.buky_nickname_valid(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT p_name IS NULL OR p_name ~ '^[A-Za-z0-9_.]{3,20}$';
$$;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS buky_nickname_check;
ALTER TABLE public.users ADD CONSTRAINT buky_nickname_check CHECK (public.buky_nickname_valid(nickname));

-- El ranking usa únicamente las pasadas premiadas durante el mes local.
CREATE OR REPLACE FUNCTION public.buky_monthly_ranking(p_city_code integer, p_national boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 WITH bounds AS (
   SELECT date_trunc('month', now() AT TIME ZONE public.buky_tz())::date AS first_day
 ), totals AS (
   SELECT p.user_id, count(*) AS bukys FROM public.buky_passes p CROSS JOIN bounds b
   WHERE p.awarded AND p.local_day >= b.first_day AND p.local_day < (b.first_day + interval '1 month')::date
   GROUP BY p.user_id
 ), ranked AS (
   SELECT u.id, u.name, u.nickname, u.avatar_url, t.bukys,
     rank() OVER (ORDER BY t.bukys DESC) AS pos
   FROM totals t JOIN public.users u ON u.id = t.user_id
   WHERE p_national OR u.city_code = p_city_code
 )
 SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
   'period', to_char((SELECT first_day FROM bounds), 'YYYY-MM'),
   'city', CASE WHEN p_national THEN NULL ELSE (SELECT name FROM public.br_cities WHERE code = p_city_code) END,
   'top', coalesce((SELECT jsonb_agg(jsonb_build_object('pos', r.pos, 'initials', public.buky_initials(r.name),
     'nickname', r.nickname, 'avatar_url', r.avatar_url, 'bukys', r.bukys, 'me', r.id = auth.uid()) ORDER BY r.pos, r.id)
     FROM (SELECT * FROM ranked ORDER BY pos, id LIMIT 3) r), '[]'::jsonb),
   'me', (SELECT jsonb_build_object('pos', pos, 'bukys', bukys) FROM ranked WHERE id = auth.uid()),
   'total', (SELECT count(*) FROM ranked)) END;
$$;
CREATE OR REPLACE FUNCTION public.buky_city_ranking(p_city_code integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT public.buky_monthly_ranking(coalesce(p_city_code, (SELECT city_code FROM public.users WHERE id = auth.uid())), false);
$$;
CREATE OR REPLACE FUNCTION public.buky_national_ranking()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT public.buky_monthly_ranking(NULL, true);
$$;
REVOKE ALL ON FUNCTION public.buky_monthly_ranking(integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_national_ranking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_national_ranking() TO authenticated;

COMMIT;
