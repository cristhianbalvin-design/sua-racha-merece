-- Paso 22: cada atleta lee solo sus recorridos.
\c - postgres
\i :sqldir/22_historico_recorridos.sql
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('buky-tracks', 'aaaaaaaa-0000-0000-0000-000000000001/s1.json.gz'),
  ('buky-tracks', 'bbbbbbbb-0000-0000-0000-000000000002/s2.json.gz'),
  ('otro-bucket', 'aaaaaaaa-0000-0000-0000-000000000001/x.png');

\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'buky-tracks') <> 1
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = 'aaaaaaaa-0000-0000-0000-000000000001/s1.json.gz') THEN
    RAISE EXCEPTION 'el atleta debe ver solo su recorrido';
  END IF;
END $$;
COMMIT;
