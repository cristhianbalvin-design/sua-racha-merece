-- Paso 21: la ruta del atleta es un trazo y los Bukys se ubican solos cada N metros.
\c - postgres
\i :sqldir/19_testadores_rutas.sql
\i :sqldir/21_rutas_por_trazo.sql
BEGIN;
INSERT INTO public.users (id, email, role, city_code) VALUES
  ('21000000-0000-0000-0000-000000000001', 't21@buky.test', 'USUARIO', 3303302)
ON CONFLICT (id) DO NOTHING;
COMMIT;

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE v_route uuid; v_n int; v_len int; v_first record; v_path jsonb;
BEGIN
  -- Recta de ~1.112 m hacia el sur con un vértice intermedio pegado (curva): Bukys cada 200 m → 5
  v_route := public.buky_create_athlete_route('Reta com curva', 3303302,
    '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.90005,"lon":-43.1200},{"lat":-22.9100,"lon":-43.1200}]');
  SELECT count(*), max(r.length_m) INTO v_n, v_len FROM public.buky_points p JOIN public.buky_routes r ON r.id = p.route_id WHERE route_id = v_route;
  IF v_n <> 5 THEN RAISE EXCEPTION 'esperaba 5 Bukys, hay %', v_n; END IF;
  IF v_len NOT BETWEEN 1100 AND 1125 THEN RAISE EXCEPTION 'largo %', v_len; END IF;
  SELECT * INTO v_first FROM public.buky_points WHERE route_id = v_route ORDER BY seq LIMIT 1;
  IF abs(public.buky_distance_m(-22.9, -43.12, v_first.lat, v_first.lon) - 200) > 2 THEN
    RAISE EXCEPTION 'el primer Buky debe estar a 200 m del inicio';
  END IF;
  SELECT path INTO v_path FROM public.buky_routes WHERE id = v_route;
  IF jsonb_array_length(v_path) <> 3 THEN RAISE EXCEPTION 'debe guardar el trazo'; END IF;

  -- Ida y vuelta por la misma calle: los Bukys de la vuelta caen sobre los de la ida y se omiten
  v_route := public.buky_create_athlete_route('Ida e volta', 3303302,
    '[{"lat":-22.9000,"lon":-43.1300},{"lat":-22.9060,"lon":-43.1300},{"lat":-22.9000,"lon":-43.1300}]');
  SELECT count(*) INTO v_n FROM public.buky_points WHERE route_id = v_route;
  IF v_n <> 3 THEN RAISE EXCEPTION 'ida y vuelta: esperaba 3 Bukys, hay %', v_n; END IF;

  BEGIN  -- muy corta
    PERFORM public.buky_create_athlete_route('Curta', 3303302, '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.9030,"lon":-43.1200}]');
    RAISE EXCEPTION 'debió rechazar ruta corta';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'route_too_short' THEN RAISE; END IF;
  END;
  BEGIN  -- demasiado larga: > 30 Bukys
    PERFORM public.buky_create_athlete_route('Longa', 3303302, '[{"lat":-22.9000,"lon":-43.1200},{"lat":-22.9700,"lon":-43.1200}]');
    RAISE EXCEPTION 'debió rechazar ruta larga';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'route_too_long' THEN RAISE; END IF;
  END;
  BEGIN  -- fuera de la ciudad
    PERFORM public.buky_create_athlete_route('Lima', 3303302, '[{"lat":-11.9800,"lon":-76.7700},{"lat":-11.9950,"lon":-76.7700}]');
    RAISE EXCEPTION 'debió rechazar fuera de la ciudad';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'point_outside_city' THEN RAISE; END IF;
  END;
  BEGIN  -- un solo punto
    PERFORM public.buky_create_athlete_route('Um', 3303302, '[{"lat":-22.9000,"lon":-43.1200}]');
    RAISE EXCEPTION 'debió rechazar un punto';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'path_points' THEN RAISE; END IF;
  END;
END $$;
COMMIT;
