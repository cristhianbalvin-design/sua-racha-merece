-- ============================================================
-- 3BUK · Fase 1 · PASO 11 — Endurecimiento previo al lanzamiento
--
-- Qué corrige (todo verificado antes contra el esquema y el código):
--
--  A. EMBEDDINGS FACIALES (dato biométrico, LGPD): hoy anon y authenticated pueden
--     leer event_photos.embedding vía la API pública. Se quita el SELECT de esa
--     columna. No rompe nada: match-face usa la service role; el front siempre
--     selecciona columnas explícitas (nunca '*'); las políticas RLS de filas
--     (solo published / admin / dueño) no cambian.
--
--  B. BUCKETS avatars y evidences: hoy CUALQUIER persona sin sesión puede subir y
--     SOBRESCRIBIR archivos. Pasa a: solo usuarios con sesión, solo archivos cuyo
--     nombre empieza por su propio user id (así los nombra el front:
--     "<userId>-<timestamp>.<ext>"); el admin además puede subir la carpeta
--     "photographers/" (foto del fotógrafo). Las URLs públicas siguen funcionando.
--
--  C. LISTADO de buckets: se quitan las políticas SELECT de avatars, evidences y
--     event-photos. Las imágenes se siguen viendo por su URL pública, pero ya nadie
--     puede LISTAR el bucket (hoy se pueden enumerar fotos en moderación/rechazadas
--     y evidencias de usuarios). El front no usa list() ni download().
--
--  D. Funciones trigger notify_* SECURITY DEFINER: se les quita EXECUTE a anon y
--     authenticated (hoy se pueden invocar por /rest/v1/rpc). Los triggers siguen
--     funcionando (EXECUTE solo se comprueba al crear el trigger).
--
--  E. search_path fijo en 7 funciones (aviso del linter). check_and_register_download
--     ya lo fija el Paso 7. Solo usan objetos de public (vector vive en public).
--
-- NO incluye (decisión pendiente, no se toca): vista public_winners (SECURITY
-- DEFINER, probablemente intencional para el listado público de ganadores),
-- extensión vector en public (moverla rompería firmas de funciones) y la
-- protección contra contraseñas filtradas (se activa en el Dashboard de Auth).
--
-- Reversión rápida:
--   A: GRANT SELECT ON public.event_photos TO anon, authenticated;
--   B/C: recrear las políticas antiguas (nombres en este script).
-- Antes de correr: haber aplicado el script 10 (pasos 7 y 9).
-- ============================================================

BEGIN;

-- ---------- A. embedding fuera del alcance de anon/authenticated ----------
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_photos' AND column_name <> 'embedding';

  EXECUTE 'REVOKE SELECT ON public.event_photos FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.event_photos TO anon, authenticated', cols);
END $$;
-- Nota: si en el futuro se agrega una columna a event_photos, hay que concederle
-- SELECT explícito (GRANT SELECT (nueva_columna) ON public.event_photos TO anon, authenticated).

-- ---------- B. subida a avatars / evidences solo con sesión y a nombre propio ----------
DROP POLICY IF EXISTS "Any user can upload" ON storage.objects;
DROP POLICY IF EXISTS "Any user can update" ON storage.objects;

CREATE POLICY "Users upload own avatars and evidences"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars', 'evidences')
    AND (
      name LIKE (SELECT auth.uid())::text || '-%'
      OR (bucket_id = 'avatars' AND name LIKE 'photographers/%' AND (SELECT public.is_admin()))
    )
  );

CREATE POLICY "Users update own avatars and evidences"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars', 'evidences')
    AND (name LIKE (SELECT auth.uid())::text || '-%' OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    bucket_id IN ('avatars', 'evidences')
    AND (name LIKE (SELECT auth.uid())::text || '-%' OR (SELECT public.is_admin()))
  );

-- ---------- C. sin listado de buckets (las URLs públicas siguen sirviendo) ----------
DROP POLICY IF EXISTS "Public avatars access" ON storage.objects;
DROP POLICY IF EXISTS "Public event-photos access" ON storage.objects;

-- ---------- D. funciones trigger no invocables por la API ----------
REVOKE EXECUTE ON FUNCTION public.notify_new_campaign() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_participation_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_campaign_status() FROM PUBLIC, anon, authenticated;

-- ---------- E. search_path fijo ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'notify_new_campaign', 'notify_participation_status', 'notify_campaign_status',
        'match_event_photos', 'to_title_case_pt_br', 'set_sport_profiles_updated_at',
        'close_expired_campaigns'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- Verificación (una fila; todo debe salir como se indica):
-- ============================================================
SELECT
  has_column_privilege('anon', 'public.event_photos', 'embedding', 'SELECT')          AS anon_lee_embedding_debe_ser_false,
  has_column_privilege('authenticated', 'public.event_photos', 'embedding', 'SELECT') AS auth_lee_embedding_debe_ser_false,
  has_column_privilege('anon', 'public.event_photos', 'image_url', 'SELECT')          AS anon_lee_image_url_debe_ser_true,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('Any user can upload', 'Any user can update', 'Public avatars access', 'Public event-photos access')) AS politicas_viejas_debe_ser_0,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('notify_new_campaign','notify_participation_status','notify_campaign_status',
       'match_event_photos','to_title_case_pt_br','set_sport_profiles_updated_at','close_expired_campaigns')
       AND p.proconfig IS NOT NULL) AS funciones_con_search_path_debe_ser_7;
