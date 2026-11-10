-- Verifica que el script de prueba en producción de la Entrega C corre (dos veces: es idempotente).
\c - postgres
-- Otras pruebas re-aplican pasos anteriores (17/25 redefinen el trigger write-once): vuelve al estado del paso 28.
\i :sqldir/28_patrocinadores_avisos.sql
INSERT INTO public.users (id, email, name, role) VALUES
  ('a9c5b97e-aeba-41f6-9d93-3a47244b76dc', 'admin-prueba@buky.test', 'Admin', 'ADMIN')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.buky_sponsors (id, name) VALUES ('7e570000-0000-4000-8000-000000000001', '3BUK')
ON CONFLICT (id) DO NOTHING;
\i :sqldir/prueba_entrega_c.sql
\i :sqldir/prueba_entrega_c.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notification_outbox WHERE payload ->> 'result_id' = '7e570000-0000-4000-8000-0000000000c2') <> 2 THEN
    RAISE EXCEPTION 'el aviso del premio de prueba debe encolar e-mail y push una sola vez';
  END IF;
END $$;
-- Premio de prueba para un atleta por e-mail (dos veces: no duplica)
INSERT INTO public.users (id, email, name, role) VALUES
  ('74b18062-cae4-4034-b89e-a442cfa80b8e', 'Atleta-Prueba@buky.test', 'Atleta', 'USUARIO')
ON CONFLICT (id) DO NOTHING;
\set email 'atleta-prueba@buky.test'
\i :sqldir/prueba_premio_atleta.sql
\i :sqldir/prueba_premio_atleta.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.buky_raffle_results WHERE user_id = '74b18062-cae4-4034-b89e-a442cfa80b8e' AND redeem_token IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'premio de prueba del atleta';
  END IF;
END $$;
