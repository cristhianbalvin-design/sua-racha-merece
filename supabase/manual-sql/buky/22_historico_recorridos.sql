-- Paso 22 · Historial: cada atleta puede LEER el recorrido GPS de sus propios entrenamientos.
-- Los archivos están en el bucket privado buky-tracks como "<user_id>/<session_id>.json.gz" y solo
-- los escribe la Edge Function. Aquí se permite leer únicamente la carpeta propia (y al admin todo).
-- Nadie más puede listar ni bajar recorridos ajenos. Idempotente.
BEGIN;

DROP POLICY IF EXISTS buky_tracks_read_own ON storage.objects;
CREATE POLICY buky_tracks_read_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buky-tracks'
         AND (split_part(name, '/', 1) = (SELECT auth.uid())::text OR (SELECT public.is_admin())));

COMMIT;
