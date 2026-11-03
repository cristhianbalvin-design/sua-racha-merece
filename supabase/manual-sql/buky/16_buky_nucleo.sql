-- ============================================================
-- 3BUK · Buky · PASO 16 — Núcleo: rutas, puntos, entrenamientos, pasadas y Bukys
-- Correr en el SQL Editor de Supabase DESPUÉS del paso 15. Es idempotente.
--
-- Reglas de negocio (decisiones del cliente, 3 de noviembre de 2026):
--   · Rutas oficiales: las crea el admin por ciudad. Rutas del atleta: las crea el atleta, con
--     límites (distancia mínima entre puntos, largo mínimo, tope diario de Bukys y 1 pasada por
--     punto por día).
--   · El teléfono cuenta pasadas en vivo, pero los Bukys los acredita SOLO el servidor al cerrar
--     el entrenamiento (Edge Function buky-close-session → buky_finalize_session).
--   · Caminar no cuenta: velocidad mínima y máxima configurables (valores por confirmar).
--   · Movimientos en 3 totales: encontrados, regalados y enviados (buky_balances).
-- Parámetros editables sin desplegar: tabla app_settings, claves buky_*.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Parámetros
-- ------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description) VALUES
  ('buky_timezone', '"America/Sao_Paulo"', 'Zona horaria para "por día" y periodos de Buky'),
  ('buky_point_radius_default_m', '50', 'Radio por defecto de un punto (m)'),
  ('buky_speed_min_kmh', '6', 'Velocidad mínima para que una pasada cuente (km/h). Caminar no cuenta. POR CONFIRMAR'),
  ('buky_speed_max_kmh', '25', 'Velocidad máxima para que una pasada cuente (km/h). POR CONFIRMAR'),
  ('buky_vehicle_window_s', '60', 'Segundos seguidos por encima de la máxima que anulan el entrenamiento (vehículo)'),
  ('buky_speed_window_s', '30', 'Ventana (s) para medir la velocidad del atleta al llegar a un punto'),
  ('buky_max_accuracy_m', '25', 'Precisión GPS máxima para usar una lectura (m)'),
  ('buky_athlete_route_min_point_gap_m', '200', 'Rutas del atleta: distancia mínima entre puntos (m)'),
  ('buky_athlete_route_min_length_m', '1000', 'Rutas del atleta: largo mínimo de la ruta (m)'),
  ('buky_athlete_route_min_points', '3', 'Rutas del atleta: cantidad mínima de puntos'),
  ('buky_athlete_route_max_points', '30', 'Rutas del atleta: cantidad máxima de puntos'),
  ('buky_athlete_route_max_active', '10', 'Rutas del atleta: rutas activas por atleta'),
  ('buky_athlete_route_daily_cap', '10', 'Rutas del atleta: tope diario de Bukys por atleta'),
  ('buky_athlete_route_max_city_km', '60', 'Rutas del atleta: distancia máxima de cada punto al centro de su ciudad (km)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.buky_setting_num(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce((SELECT (value #>> '{}')::numeric FROM public.app_settings WHERE key = p_key), p_default)
$$;

CREATE OR REPLACE FUNCTION public.buky_tz()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce((SELECT value #>> '{}' FROM public.app_settings WHERE key = 'buky_timezone'), 'America/Sao_Paulo')
$$;

-- Distancia en metros entre dos coordenadas (Haversine), igual que el motor de la app.
CREATE OR REPLACE FUNCTION public.buky_distance_m(lat1 double precision, lon1 double precision,
                                                  lat2 double precision, lon2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO ''
AS $$
  SELECT 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))))
$$;

-- ------------------------------------------------------------
-- Rutas y puntos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 80),
  city_code integer NOT NULL REFERENCES public.br_cities(code),
  kind text NOT NULL DEFAULT 'official' CHECK (kind IN ('official', 'athlete')),
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  length_m integer,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buky_routes_owner_kind CHECK ((kind = 'athlete') = (owner_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS buky_routes_city_idx ON public.buky_routes (city_code) WHERE active;
CREATE INDEX IF NOT EXISTS buky_routes_owner_idx ON public.buky_routes (owner_id);

CREATE TABLE IF NOT EXISTS public.buky_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.buky_routes(id) ON DELETE CASCADE,
  seq smallint NOT NULL,
  label text,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  radius_m smallint NOT NULL DEFAULT 50 CHECK (radius_m BETWEEN 20 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, seq)
);

-- ------------------------------------------------------------
-- Entrenamientos (sesiones) y pasadas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_sessions (
  id uuid PRIMARY KEY,                      -- lo genera el teléfono: reintentos idempotentes
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.buky_routes(id),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'abandoned', 'valid', 'invalid')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  live_passes integer NOT NULL DEFAULT 0,
  last_point_id uuid,
  invalid_reason text,
  distance_m integer,
  duration_s integer,
  max_speed_kmh numeric(5,1),
  avg_speed_kmh numeric(5,1),
  passes_valid integer NOT NULL DEFAULT 0,
  passes_rejected integer NOT NULL DEFAULT 0,
  bukys_awarded integer NOT NULL DEFAULT 0,
  track_path text,
  client jsonb,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buky_sessions_user_idx ON public.buky_sessions (user_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS buky_sessions_one_running ON public.buky_sessions (user_id) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS public.buky_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.buky_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.buky_routes(id),
  route_kind text NOT NULL,
  point_id uuid NOT NULL REFERENCES public.buky_points(id),
  passed_at timestamptz NOT NULL,
  local_day date NOT NULL,                 -- día en la zona horaria de Buky, para los topes diarios
  distance_m numeric(6,1),
  accuracy_m numeric(6,1),
  speed_kmh numeric(5,1),
  valid boolean NOT NULL,                  -- cumple las reglas de GPS y velocidad
  awarded boolean NOT NULL DEFAULT false,  -- además dio 1 Buky (puede no darlo por los topes)
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buky_passes_session_idx ON public.buky_passes (session_id);
CREATE INDEX IF NOT EXISTS buky_passes_user_day_idx ON public.buky_passes (user_id, local_day) WHERE awarded;

-- ------------------------------------------------------------
-- Libro contable de Bukys (inmutable) y saldos consolidados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('found', 'gift', 'sent', 'adjust')),
  amount integer NOT NULL CHECK (amount <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  ref_type text,
  ref_id text,
  note text,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buky_ledger_sign CHECK (
    (kind IN ('found', 'gift') AND amount > 0) OR (kind = 'sent' AND amount < 0) OR kind = 'adjust')
);
CREATE INDEX IF NOT EXISTS buky_ledger_user_idx ON public.buky_ledger (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS buky_ledger_idem ON public.buky_ledger (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.buky_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  found_total integer NOT NULL DEFAULT 0,
  gift_total integer NOT NULL DEFAULT 0,
  sent_total integer NOT NULL DEFAULT 0,
  adjust_total integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.buky_ledger_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RAISE EXCEPTION 'buky_ledger es inmutable' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS buky_ledger_immutable ON public.buky_ledger;
CREATE TRIGGER buky_ledger_immutable BEFORE UPDATE OR DELETE ON public.buky_ledger
  FOR EACH ROW EXECUTE FUNCTION public.buky_ledger_block_mutation();

-- Único punto de entrada para mover Bukys. Interna: no la llaman los clientes directamente.
CREATE OR REPLACE FUNCTION public.apply_buky_movement(
  p_user_id uuid, p_kind text, p_amount integer,
  p_ref_type text DEFAULT NULL, p_ref_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_balance integer;
  v_new integer;
  v_existing bigint;
  v_id bigint;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 100000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.buky_balances (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.buky_balances WHERE user_id = p_user_id FOR UPDATE;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.buky_ledger
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('balance', v_balance, 'duplicate', true, 'ledger_id', v_existing);
    END IF;
  END IF;

  v_new := v_balance + p_amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient_bukys' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.buky_balances SET
    balance = v_new,
    found_total = found_total + CASE WHEN p_kind = 'found' THEN p_amount ELSE 0 END,
    gift_total = gift_total + CASE WHEN p_kind = 'gift' THEN p_amount ELSE 0 END,
    sent_total = sent_total + CASE WHEN p_kind = 'sent' THEN -p_amount ELSE 0 END,
    adjust_total = adjust_total + CASE WHEN p_kind = 'adjust' THEN p_amount ELSE 0 END,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.buky_ledger (user_id, kind, amount, balance_after, ref_type, ref_id, note, idempotency_key, created_by)
  VALUES (p_user_id, p_kind, p_amount, v_new, p_ref_type, p_ref_id, p_note, p_idempotency_key, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('balance', v_new, 'duplicate', false, 'ledger_id', v_id);
END;
$$;

-- ------------------------------------------------------------
-- RLS: lectura según dueño o admin; escritura de rutas oficiales solo admin.
-- Sesiones, pasadas y movimientos se escriben solo por funciones.
-- ------------------------------------------------------------
ALTER TABLE public.buky_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buky_routes_select ON public.buky_routes;
CREATE POLICY buky_routes_select ON public.buky_routes FOR SELECT TO authenticated
  USING ((kind = 'official' AND active) OR owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_routes_admin_write ON public.buky_routes;
CREATE POLICY buky_routes_admin_write ON public.buky_routes FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_points_select ON public.buky_points;
CREATE POLICY buky_points_select ON public.buky_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.buky_routes r WHERE r.id = route_id));  -- hereda la RLS de la ruta
DROP POLICY IF EXISTS buky_points_admin_write ON public.buky_points;
CREATE POLICY buky_points_admin_write ON public.buky_points FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_sessions_select ON public.buky_sessions;
CREATE POLICY buky_sessions_select ON public.buky_sessions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_passes_select ON public.buky_passes;
CREATE POLICY buky_passes_select ON public.buky_passes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_ledger_select ON public.buky_ledger;
CREATE POLICY buky_ledger_select ON public.buky_ledger FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_balances_select ON public.buky_balances;
CREATE POLICY buky_balances_select ON public.buky_balances FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- Sin acceso anónimo; sin escritura directa en tablas que solo mueven las funciones.
REVOKE ALL ON public.buky_routes, public.buky_points, public.buky_sessions, public.buky_passes,
              public.buky_ledger, public.buky_balances FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.buky_sessions, public.buky_passes,
              public.buky_ledger, public.buky_balances FROM authenticated;

-- ------------------------------------------------------------
-- Funciones para la app del atleta
-- ------------------------------------------------------------

-- Inicia un entrenamiento. Si había otro "en curso", queda abandonado (se puede cerrar igual).
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

-- Latido durante el entrenamiento: alimenta el panel "En vivo" (sin guardar la posición).
CREATE OR REPLACE FUNCTION public.buky_heartbeat(p_session_id uuid, p_live_passes integer, p_last_point_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.buky_sessions
  SET last_seen_at = now(),
      live_passes = greatest(0, least(coalesce(p_live_passes, 0), 1000)),
      last_point_id = coalesce(p_last_point_id, last_point_id)
  WHERE id = p_session_id AND user_id = auth.uid() AND status = 'running'
$$;

-- Ruta propia del atleta, con los límites antiabuso (opción C).
-- p_points: [{"lat": -22.9, "lon": -43.1, "label": "Praia"}, ...] en el orden del recorrido.
CREATE OR REPLACE FUNCTION public.buky_create_athlete_route(p_name text, p_city_code integer, p_points jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_city public.br_cities%ROWTYPE;
  v_n integer;
  v_min_points integer := public.buky_setting_num('buky_athlete_route_min_points', 3);
  v_max_points integer := public.buky_setting_num('buky_athlete_route_max_points', 30);
  v_min_gap numeric := public.buky_setting_num('buky_athlete_route_min_point_gap_m', 200);
  v_min_len numeric := public.buky_setting_num('buky_athlete_route_min_length_m', 1000);
  v_max_active integer := public.buky_setting_num('buky_athlete_route_max_active', 10);
  v_max_city_m numeric := public.buky_setting_num('buky_athlete_route_max_city_km', 60) * 1000;
  v_radius integer := public.buky_setting_num('buky_point_radius_default_m', 50);
  v_len numeric := 0;
  v_route_id uuid;
  i integer;
  j integer;
  pi jsonb;
  pj jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_city FROM public.br_cities WHERE code = p_city_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF jsonb_typeof(p_points) <> 'array' THEN
    RAISE EXCEPTION 'points_invalid' USING ERRCODE = '22023';
  END IF;
  v_n := jsonb_array_length(p_points);
  IF v_n < v_min_points OR v_n > v_max_points THEN
    RAISE EXCEPTION 'points_count' USING ERRCODE = '22023',
      DETAIL = format('Entre %s y %s puntos', v_min_points, v_max_points);
  END IF;
  IF (SELECT count(*) FROM public.buky_routes WHERE owner_id = v_uid AND active) >= v_max_active THEN
    RAISE EXCEPTION 'too_many_routes' USING ERRCODE = 'P0001';
  END IF;

  FOR i IN 0 .. v_n - 1 LOOP
    pi := p_points -> i;
    IF NOT (pi ? 'lat' AND pi ? 'lon')
       OR (pi ->> 'lat')::double precision NOT BETWEEN -90 AND 90
       OR (pi ->> 'lon')::double precision NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'point_invalid' USING ERRCODE = '22023', DETAIL = format('Punto %s', i + 1);
    END IF;
    IF public.buky_distance_m(v_city.lat, v_city.lon, (pi ->> 'lat')::double precision, (pi ->> 'lon')::double precision) > v_max_city_m THEN
      RAISE EXCEPTION 'point_outside_city' USING ERRCODE = '22023', DETAIL = format('Punto %s', i + 1);
    END IF;
    FOR j IN 0 .. i - 1 LOOP
      pj := p_points -> j;
      IF public.buky_distance_m((pi ->> 'lat')::double precision, (pi ->> 'lon')::double precision,
                                (pj ->> 'lat')::double precision, (pj ->> 'lon')::double precision) < v_min_gap THEN
        RAISE EXCEPTION 'points_too_close' USING ERRCODE = '22023',
          DETAIL = format('Los puntos %s y %s están a menos de %s m', j + 1, i + 1, v_min_gap);
      END IF;
    END LOOP;
    IF i > 0 THEN
      pj := p_points -> (i - 1);
      v_len := v_len + public.buky_distance_m((pj ->> 'lat')::double precision, (pj ->> 'lon')::double precision,
                                              (pi ->> 'lat')::double precision, (pi ->> 'lon')::double precision);
    END IF;
  END LOOP;
  IF v_len < v_min_len THEN
    RAISE EXCEPTION 'route_too_short' USING ERRCODE = '22023',
      DETAIL = format('La ruta mide %s m; el mínimo es %s m', round(v_len), v_min_len);
  END IF;

  INSERT INTO public.buky_routes (name, city_code, kind, owner_id, length_m, created_by)
  VALUES (trim(p_name), p_city_code, 'athlete', v_uid, round(v_len), v_uid)
  RETURNING id INTO v_route_id;

  INSERT INTO public.buky_points (route_id, seq, label, lat, lon, radius_m)
  SELECT v_route_id, (ord - 1)::smallint, nullif(trim(p ->> 'label'), ''),
         (p ->> 'lat')::double precision, (p ->> 'lon')::double precision, v_radius
  FROM jsonb_array_elements(p_points) WITH ORDINALITY AS t(p, ord);

  RETURN v_route_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_set_my_route_active(p_route_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_active AND (SELECT count(*) FROM public.buky_routes WHERE owner_id = auth.uid() AND active)
       >= public.buky_setting_num('buky_athlete_route_max_active', 10) THEN
    RAISE EXCEPTION 'too_many_routes' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.buky_routes SET active = p_active, updated_at = now()
  WHERE id = p_route_id AND owner_id = auth.uid() AND kind = 'athlete';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'route_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Resumen para Bolsa y Perfil (el paso 17 lo amplía con sorteos y tickets).
CREATE OR REPLACE FUNCTION public.buky_my_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'balance', coalesce(b.balance, 0),
    'found_total', coalesce(b.found_total, 0),
    'gift_total', coalesce(b.gift_total, 0),
    'sent_total', coalesce(b.sent_total, 0),
    'passes_valid_total', (SELECT count(*) FROM public.buky_passes p WHERE p.user_id = auth.uid() AND p.awarded),
    'sessions_total', (SELECT count(*) FROM public.buky_sessions s WHERE s.user_id = auth.uid() AND s.status = 'valid'),
    'last_session', (
      SELECT jsonb_build_object('id', s.id, 'status', s.status, 'ended_at', s.ended_at,
                                'bukys', s.bukys_awarded, 'passes', s.passes_valid,
                                'route', r.name, 'city', c.name, 'invalid_reason', s.invalid_reason)
      FROM public.buky_sessions s
      JOIN public.buky_routes r ON r.id = s.route_id
      JOIN public.br_cities c ON c.code = r.city_code
      WHERE s.user_id = auth.uid() AND s.status IN ('valid', 'invalid')
      ORDER BY s.ended_at DESC NULLS LAST LIMIT 1)
  )
  FROM (SELECT 1) one
  LEFT JOIN public.buky_balances b ON b.user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- Cierre del entrenamiento: SOLO la Edge Function buky-close-session (service_role).
-- La función recalcula las pasadas sobre el recorrido completo y envía:
--   p_status  'valid' | 'invalid'     p_reason  motivo si es inválido (p. ej. 'vehicle')
--   p_stats   {"ended_at","distance_m","duration_s","max_speed_kmh","avg_speed_kmh"}
--   p_passes  [{"point_id","passed_at","distance_m","accuracy_m","speed_kmh","valid","reject_reason"}]
-- Aquí se aplican los topes de rutas del atleta y se acreditan los Bukys en UN movimiento.
-- ------------------------------------------------------------
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
  v_p jsonb;
  v_point_ok boolean;
  v_day date;
  v_valid boolean;
  v_award boolean;
  v_reason text;
  v_awarded integer := 0;
  v_valid_n integer := 0;
  v_rejected integer := 0;
  v_balance integer;
BEGIN
  IF NOT (session_user IN ('postgres', 'supabase_admin') OR coalesce(auth.jwt() ->> 'role', '') = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('valid', 'invalid') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.buky_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status IN ('valid', 'invalid') THEN
    RETURN jsonb_build_object('status', v_session.status, 'bukys', v_session.bukys_awarded,
                              'duplicate', true, 'reason', v_session.invalid_reason);
  END IF;
  SELECT * INTO v_route FROM public.buky_routes WHERE id = v_session.route_id;

  -- Bloquea el saldo del atleta: dos cierres simultáneos no superan los topes diarios.
  INSERT INTO public.buky_balances (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.buky_balances WHERE user_id = p_user_id FOR UPDATE;

  FOR v_p IN SELECT value FROM jsonb_array_elements(coalesce(p_passes, '[]'::jsonb))
             ORDER BY (value ->> 'passed_at')::timestamptz LOOP
    SELECT EXISTS (SELECT 1 FROM public.buky_points WHERE id = (v_p ->> 'point_id')::uuid AND route_id = v_route.id)
      INTO v_point_ok;
    IF NOT v_point_ok THEN
      CONTINUE;  -- punto ajeno a la ruta: se ignora
    END IF;
    v_day := ((v_p ->> 'passed_at')::timestamptz AT TIME ZONE v_tz)::date;
    v_valid := p_status = 'valid' AND coalesce((v_p ->> 'valid')::boolean, false);
    v_reason := CASE WHEN p_status = 'invalid' THEN coalesce(p_reason, 'session_invalid')
                     ELSE nullif(v_p ->> 'reject_reason', '') END;
    v_award := v_valid;

    IF v_award AND v_route.kind = 'athlete' THEN
      IF EXISTS (SELECT 1 FROM public.buky_passes
                 WHERE user_id = p_user_id AND point_id = (v_p ->> 'point_id')::uuid
                   AND local_day = v_day AND awarded) THEN
        v_award := false; v_reason := 'point_once_per_day';
      ELSIF (SELECT count(*) FROM public.buky_passes
             WHERE user_id = p_user_id AND local_day = v_day AND awarded AND route_kind = 'athlete') >= v_cap THEN
        v_award := false; v_reason := 'daily_cap';
      END IF;
    END IF;

    INSERT INTO public.buky_passes (session_id, user_id, route_id, route_kind, point_id, passed_at, local_day,
                                    distance_m, accuracy_m, speed_kmh, valid, awarded, reject_reason)
    VALUES (p_session_id, p_user_id, v_route.id, v_route.kind, (v_p ->> 'point_id')::uuid,
            (v_p ->> 'passed_at')::timestamptz, v_day,
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
    finalized_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', p_status, 'bukys', v_awarded, 'passes_valid', v_valid_n,
                            'passes_rejected', v_rejected, 'reason', p_reason, 'duplicate', false,
                            'balance', coalesce(v_balance,
                              (SELECT balance FROM public.buky_balances WHERE user_id = p_user_id)));
END;
$$;

-- ------------------------------------------------------------
-- Funciones del admin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_buky_gift(p_user_id uuid, p_amount integer, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = '22023';
  END IF;
  RETURN public.apply_buky_movement(p_user_id, 'gift', p_amount, 'admin', auth.uid()::text, NULL, trim(p_note));
END;
$$;

-- Anula un entrenamiento ya cerrado y descuenta sus Bukys (hasta el saldo disponible:
-- lo que ya se envió a un sorteo no se recupera).
CREATE OR REPLACE FUNCTION public.admin_buky_invalidate_session(p_session_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session public.buky_sessions%ROWTYPE;
  v_balance integer;
  v_take integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_session FROM public.buky_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status <> 'valid' THEN
    RETURN jsonb_build_object('changed', false, 'status', v_session.status);
  END IF;

  INSERT INTO public.buky_balances (user_id) VALUES (v_session.user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.buky_balances WHERE user_id = v_session.user_id FOR UPDATE;
  v_take := least(v_balance, v_session.bukys_awarded);
  IF v_take > 0 THEN
    PERFORM public.apply_buky_movement(v_session.user_id, 'adjust', -v_take, 'session_invalidated',
                                       p_session_id::text, 'invalidate:' || p_session_id, trim(p_reason));
  END IF;

  UPDATE public.buky_passes SET awarded = false, reject_reason = 'admin_invalidated'
  WHERE session_id = p_session_id AND awarded;
  UPDATE public.buky_sessions SET status = 'invalid', invalid_reason = 'admin: ' || trim(p_reason)
  WHERE id = p_session_id;

  RETURN jsonb_build_object('changed', true, 'bukys_removed', v_take,
                            'bukys_not_recovered', v_session.bukys_awarded - v_take);
END;
$$;

-- Bloquea UPDATE/DELETE sobre pasadas salvo desde funciones (dueño postgres).
-- (authenticated ya no tiene privilegios de escritura; esto es solo defensa adicional).

-- ------------------------------------------------------------
-- Bucket privado para los recorridos completos (los escribe solo la Edge Function)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('buky-tracks', 'buky-tracks', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ------------------------------------------------------------
-- Permisos de ejecución
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buky_setting_num(text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_tz() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_buky_movement(uuid, text, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_finalize_session(uuid, uuid, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_start_session(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_heartbeat(uuid, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_create_athlete_route(text, integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_set_my_route_active(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_my_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_gift(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_invalidate_session(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.buky_setting_num(text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buky_tz() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_buky_movement(uuid, text, integer, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.buky_finalize_session(uuid, uuid, text, text, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.buky_start_session(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_heartbeat(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_create_athlete_route(text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_set_my_route_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_my_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buky_gift(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buky_invalidate_session(uuid, text) TO authenticated;

COMMIT;
