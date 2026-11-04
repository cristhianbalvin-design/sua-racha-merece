-- Paso 21 · Rutas del atleta dibujadas como un TRAZO.
-- El atleta marca el recorrido por las calles con los puntos que quiera (pueden estar cerca, para las
-- curvas). Los Bukys se ubican SOLOS a lo largo del trazo, cada `buky_athlete_route_min_point_gap_m`
-- metros (la misma distancia configurada que antes separaba los puntos).
--   · `buky_routes.path` guarda el trazo; `buky_points` siguen siendo los Bukys (el motor no cambia).
--   · Un Buky que caería a menos de 2 radios de otro (trazo que vuelve sobre sí mismo) se omite.
--   · min/max de puntos pasan a contar Bukys; el largo mínimo y el límite de la ciudad se mantienen.
-- Misma firma que antes (nombre, ciudad, jsonb): una app vieja que mande sus puntos también funciona.
-- Va DESPUÉS del 19, porque reemplaza buky_create_athlete_route. Idempotente.
BEGIN;

ALTER TABLE public.buky_routes ADD COLUMN IF NOT EXISTS path jsonb;

UPDATE public.app_settings
SET description = 'Rutas del atleta: distancia entre Bukys a lo largo del trazado (m)'
WHERE key = 'buky_athlete_route_min_point_gap_m';
UPDATE public.app_settings SET description = 'Rutas del atleta: cantidad mínima de Bukys' WHERE key = 'buky_athlete_route_min_points';
UPDATE public.app_settings SET description = 'Rutas del atleta: cantidad máxima de Bukys' WHERE key = 'buky_athlete_route_max_points';

-- p_path: [{"lat": -22.9, "lon": -43.1}, ...] en el orden del recorrido (2 a 400 puntos).
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
  v_min_bukys integer := public.buky_setting_num('buky_athlete_route_min_points', 3);
  v_max_bukys integer := public.buky_setting_num('buky_athlete_route_max_points', 30);
  v_every numeric := greatest(public.buky_setting_num('buky_athlete_route_min_point_gap_m', 200), 50);
  v_min_len numeric := public.buky_setting_num('buky_athlete_route_min_length_m', 1000);
  v_max_active integer := public.buky_setting_num('buky_athlete_route_max_active', 10);
  v_max_city_m numeric := public.buky_setting_num('buky_athlete_route_max_city_km', 60) * 1000;
  v_radius integer := public.buky_setting_num('buky_point_radius_default_m', 50);
  v_tester boolean := public.buky_is_route_tester();
  v_path jsonb := '[]'::jsonb;
  v_bukys jsonb := '[]'::jsonb;
  v_len numeric := 0;
  v_next numeric;
  v_seg numeric;
  v_f numeric;
  v_lat double precision;
  v_lon double precision;
  a_lat double precision;
  a_lon double precision;
  b_lat double precision;
  b_lon double precision;
  v_route_id uuid;
  i integer;
  pi jsonb;
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
  IF v_n < 2 OR v_n > 400 THEN
    RAISE EXCEPTION 'path_points' USING ERRCODE = '22023', DETAIL = 'El trazo necesita entre 2 y 400 puntos';
  END IF;
  IF (SELECT count(*) FROM public.buky_routes WHERE owner_id = v_uid AND active) >= v_max_active THEN
    RAISE EXCEPTION 'too_many_routes' USING ERRCODE = 'P0001';
  END IF;

  -- Validar el trazo
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
    v_path := v_path || jsonb_build_array(jsonb_build_object('lat', round((pi ->> 'lat')::numeric, 6), 'lon', round((pi ->> 'lon')::numeric, 6)));
  END LOOP;

  -- Ubicar los Bukys cada v_every metros a lo largo del trazo
  v_next := v_every;
  FOR i IN 1 .. v_n - 1 LOOP
    a_lat := (v_path -> (i - 1) ->> 'lat')::double precision; a_lon := (v_path -> (i - 1) ->> 'lon')::double precision;
    b_lat := (v_path -> i ->> 'lat')::double precision;       b_lon := (v_path -> i ->> 'lon')::double precision;
    v_seg := public.buky_distance_m(a_lat, a_lon, b_lat, b_lon);
    WHILE v_seg > 0 AND v_next <= v_len + v_seg LOOP
      v_f := (v_next - v_len) / v_seg;
      v_lat := a_lat + v_f * (b_lat - a_lat);
      v_lon := a_lon + v_f * (b_lon - a_lon);
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_bukys) g
                     WHERE public.buky_distance_m((g ->> 'lat')::double precision, (g ->> 'lon')::double precision, v_lat, v_lon) < 2 * v_radius) THEN
        v_bukys := v_bukys || jsonb_build_array(jsonb_build_object('lat', round(v_lat::numeric, 6), 'lon', round(v_lon::numeric, 6)));
      END IF;
      v_next := v_next + v_every;
    END LOOP;
    v_len := v_len + v_seg;
  END LOOP;

  IF v_len < v_min_len THEN
    RAISE EXCEPTION 'route_too_short' USING ERRCODE = '22023',
      DETAIL = format('La ruta mide %s m; el mínimo es %s m', round(v_len), v_min_len);
  END IF;
  IF jsonb_array_length(v_bukys) < v_min_bukys THEN
    RAISE EXCEPTION 'points_count' USING ERRCODE = '22023', DETAIL = format('Mínimo %s Bukys', v_min_bukys);
  END IF;
  IF jsonb_array_length(v_bukys) > v_max_bukys THEN
    RAISE EXCEPTION 'route_too_long' USING ERRCODE = '22023', DETAIL = format('Máximo %s Bukys', v_max_bukys);
  END IF;

  INSERT INTO public.buky_routes (name, city_code, kind, owner_id, length_m, path, created_by)
  VALUES (trim(p_name), p_city_code, 'athlete', v_uid, round(v_len), v_path, v_uid)
  RETURNING id INTO v_route_id;

  INSERT INTO public.buky_points (route_id, seq, label, lat, lon, radius_m)
  SELECT v_route_id, (ord - 1)::smallint, 'Buky ' || ord,
         (p ->> 'lat')::double precision, (p ->> 'lon')::double precision, v_radius
  FROM jsonb_array_elements(v_bukys) WITH ORDINALITY AS t(p, ord);

  RETURN v_route_id;
END;
$$;

COMMIT;
