-- Paso 19 · Testadores de rutas.
-- Un testador (o un admin) puede crear rutas propias en cualquier lugar, sin el límite de distancia al
-- centro de su ciudad. Sirve para probar Buky fuera de Brasil (p. ej. desde Perú) sin abrir esa
-- regla a todos los atletas. El resto de las reglas (puntos, distancias, largo, tope diario) se mantiene.
-- Idempotente. Para revertir: DELETE FROM public.buky_route_testers; (y volver a correr el paso 16).
BEGIN;

CREATE TABLE IF NOT EXISTS public.buky_route_testers (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  note text,
  added_by uuid DEFAULT auth.uid(),
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.buky_route_testers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buky_route_testers FROM anon;
GRANT SELECT, INSERT, DELETE ON public.buky_route_testers TO authenticated;

DROP POLICY IF EXISTS buky_route_testers_select ON public.buky_route_testers;
CREATE POLICY buky_route_testers_select ON public.buky_route_testers FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_route_testers_admin_insert ON public.buky_route_testers;
CREATE POLICY buky_route_testers_admin_insert ON public.buky_route_testers FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_route_testers_admin_delete ON public.buky_route_testers;
CREATE POLICY buky_route_testers_admin_delete ON public.buky_route_testers FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- ¿El usuario actual puede crear rutas fuera de su ciudad?
CREATE OR REPLACE FUNCTION public.buky_is_route_tester()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.buky_route_testers WHERE user_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.buky_is_route_tester() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_is_route_tester() TO authenticated;

-- Misma función del paso 16, con la excepción del testador en la regla de la ciudad.
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
  v_tester boolean := public.buky_is_route_tester();
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
    IF NOT v_tester
       AND public.buky_distance_m(v_city.lat, v_city.lon, (pi ->> 'lat')::double precision, (pi ->> 'lon')::double precision) > v_max_city_m THEN
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

COMMIT;
