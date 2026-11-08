-- Paso 26 · Ronda 3 de respuestas (8/11/2026) y datos para Início.
--   · Tope de 12 Bukys por día y por atleta, sumando todas las rutas (buky_daily_cap_total).
--   · Bicicleta: el bloqueo del resto del día empieza con el PRIMER corte (buky_bike_stops_to_block = 1).
--     Se aplica una sola vez: si el admin lo cambia después, re-ejecutar este paso no lo pisa.
--   · Solo la app instalada inicia entrenamientos (p_client.platform = 'native'); la web no recolecta.
--   · Início: ganadores de patrocinio (carrusel) y ranking de la ciudad (top 3 por Bukys recogidos
--     corriendo, histórico), mostrando solo nombre corto, foto y total.
-- Va después del 25. Idempotente.
BEGIN;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('buky_daily_cap_total', '12', 'Bukys máximos por atleta y por día, sumando todas las rutas')
ON CONFLICT (key) DO NOTHING;

-- Una sola vez: bloqueo desde el primer corte por bicicleta
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'buky_round3_applied') THEN
    UPDATE public.app_settings SET value = '1' WHERE key = 'buky_bike_stops_to_block';
    INSERT INTO public.app_settings (key, value, description)
    VALUES ('buky_round3_applied', 'true', 'Marca interna: ajustes de la ronda 3 aplicados (no editar)');
  END IF;
END $$;

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
  v_day_cap integer := public.buky_setting_num('buky_daily_cap_total', 12);
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

-- Nombre corto para listas públicas: "Jesús E."
CREATE OR REPLACE FUNCTION public.buky_short_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_name IS NULL OR btrim(p_name) = '' THEN 'Atleta'
    WHEN array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) = 1 THEN initcap(lower(btrim(p_name)))
    ELSE initcap(lower(split_part(btrim(p_name), ' ', 1))) || ' '
         || upper(left((regexp_split_to_array(btrim(p_name), '\s+'))[2], 1)) || '.'
  END
$$;

-- Ranking de la ciudad: top 3 por Bukys recogidos corriendo (histórico) + mi posición.
CREATE OR REPLACE FUNCTION public.buky_city_ranking(p_city_code integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH city AS (
    SELECT coalesce(p_city_code, (SELECT u.city_code FROM public.users u WHERE u.id = auth.uid())) AS code
  ), ranked AS (
    SELECT u.id, u.name, u.avatar_url, b.found_total,
           rank() OVER (ORDER BY b.found_total DESC) AS pos
    FROM public.buky_balances b
    JOIN public.users u ON u.id = b.user_id
    JOIN city ON u.city_code = city.code
    WHERE b.found_total > 0
  )
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'city', (SELECT c.name FROM public.br_cities c JOIN city ON c.code = city.code),
    'top', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'pos', r.pos, 'name', public.buky_short_name(r.name), 'avatar_url', r.avatar_url,
              'bukys', r.found_total, 'me', r.id = auth.uid()) ORDER BY r.pos, r.found_total DESC)
            FROM (SELECT * FROM ranked ORDER BY pos LIMIT 3) r), '[]'::jsonb),
    'me', (SELECT jsonb_build_object('pos', r.pos, 'bukys', r.found_total) FROM ranked r WHERE r.id = auth.uid()),
    'total', (SELECT count(*) FROM ranked)
  ) END
$$;

-- Ganadores de patrocinio para el carrusel de Início (lo público de la participación).
CREATE OR REPLACE FUNCTION public.buky_sponsorship_winners(p_limit integer DEFAULT 12)
RETURNS TABLE (name text, avatar_url text, media jsonb, campaign text, prize text, city text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.buky_short_name(u.name), u.avatar_url,
         CASE WHEN p.photo_url ~ '^\s*\{' THEN (p.photo_url::jsonb) -> 'media'
              WHEN p.photo_url IS NOT NULL THEN jsonb_build_array(p.photo_url) ELSE '[]'::jsonb END,
         btrim(c.name), c.prize, coalesce(c.city, u.city), p.created_at
  FROM public.participations p
  JOIN public.campaigns c ON c.id = p.campaign_id
  JOIN public.users u ON u.id = p.user_id
  WHERE p.status = 'Ganhador' AND auth.uid() IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 12), 1), 30)
$$;

REVOKE ALL ON FUNCTION public.buky_city_ranking(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_sponsorship_winners(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_city_ranking(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_sponsorship_winners(integer) TO authenticated;

COMMIT;
