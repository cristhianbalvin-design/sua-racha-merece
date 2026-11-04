-- Paso 18: corrige tipeos, aplica coincidencias seguras, respalda y se puede revertir.
BEGIN;
INSERT INTO public.users (id, email, city, country) VALUES
  ('18000000-0000-0000-0000-000000000001', 'a18@x.com', 'Niterói, rj', 'Río de Janeiro'),
  ('18000000-0000-0000-0000-000000000002', 'b18@x.com', 'Niteori ', 'Río de Janeiro'),
  ('18000000-0000-0000-0000-000000000003', 'c18@x.com', 'Assis chateaunbriand', 'Paraná'),
  ('18000000-0000-0000-0000-000000000004', 'd18@x.com', 'Sg', 'Río de Janeiro'),
  ('18000000-0000-0000-0000-000000000005', 'e18@x.com', 'Toledo', 'Paraná');
COMMIT;
\i :sqldir/18_normalizar_ciudades_usuarios.sql
DO $$
BEGIN
  IF (SELECT city || '/' || country FROM public.users WHERE id = '18000000-0000-0000-0000-000000000001') <> 'Niterói/Rio de Janeiro'
     OR (SELECT city_code FROM public.users WHERE id = '18000000-0000-0000-0000-000000000002') <> 3303302
     OR (SELECT city FROM public.users WHERE id = '18000000-0000-0000-0000-000000000003') <> 'Assis Chateaubriand'
     OR (SELECT city FROM public.users WHERE id = '18000000-0000-0000-0000-000000000005') <> 'Toledo'
     OR (SELECT state_code FROM public.users WHERE id = '18000000-0000-0000-0000-000000000005') <> 41 THEN
    RAISE EXCEPTION 'normalización incorrecta';
  END IF;
  IF (SELECT city_code FROM public.users WHERE id = '18000000-0000-0000-0000-000000000004') IS NOT NULL THEN
    RAISE EXCEPTION '"Sg" no debe adivinarse';
  END IF;
  IF (SELECT city FROM public.buky_city_backup WHERE user_id = '18000000-0000-0000-0000-000000000001') <> 'Niterói, rj' THEN
    RAISE EXCEPTION 'falta el respaldo';
  END IF;
END $$;
-- Revertir según el comentario del paso 18
UPDATE public.users u SET city = b.city, country = b.country, city_code = NULL, state_code = NULL
FROM public.buky_city_backup b WHERE b.user_id = u.id AND u.id::text LIKE '18000000%';
DO $$ BEGIN
  IF (SELECT city || '/' || country FROM public.users WHERE id = '18000000-0000-0000-0000-000000000001') <> 'Niterói, rj/Río de Janeiro' THEN
    RAISE EXCEPTION 'la reversión no restauró el valor original';
  END IF;
END $$;
