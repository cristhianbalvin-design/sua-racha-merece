-- ============================================================
-- 3BUK · Fase 1 · Pasos 7 y 9 en un solo script
-- Pegar TODO en el SQL Editor de Supabase y ejecutar una vez.
-- El resultado final debe mostrar true / true / true.
-- ============================================================

-- ============================================================
-- 3BUK · Fase 1/2 · Biblioteca de descargas del atleta
-- PASO 7 — Revisado contra el esquema real (tablas, columnas, tipos y función actual). Correr en el SQL Editor.
--
-- Por qué existe:
--   check_and_register_download hoy NO registra nada: solo devuelve allowed=true
--   si el usuario tiene alguna participación distinta de 'Não concluído'. Sin
--   registro no hay biblioteca, ni "3 fotos gratis cada 3 meses", ni bonos por
--   descargas de fotógrafos (Fase 3).
--
-- Qué cambia:
--   1. photo_downloads: una fila por (usuario, foto) con primera y última
--      descarga y contador. Volver a bajar una foto ya registrada NO crea otra
--      fila (clave única): sirve para "baixar de novo não gasta créditos" y,
--      más adelante, la cuota se cuenta por fotos DISTINTAS usando
--      first_downloaded_at.
--   2. check_and_register_download: la regla de acceso es IDÉNTICA a la actual
--      (participación distinta de 'Não concluído'). Solo se agrega, cuando el
--      acceso está permitido: validar que la foto exista y esté publicada, y
--      registrar la descarga. Se fija search_path (hoy la función es
--      SECURITY DEFINER sin search_path: el linter de Supabase la marca).
--      El retorno sigue siendo jsonb con "allowed"; si la foto no existe o no
--      está publicada devuelve allowed=false y un campo extra "reason".
--   3. get_my_downloads: lista paginada de la biblioteca del usuario en sesión,
--      solo fotos hoy publicadas y sin la columna embedding.
--
-- Qué NO cambia:
--   * No se descuentan créditos ni se aplica cuota todavía (es el entregable C,
--     Fase 2). Esto solo deja el registro listo.
--   * users.download_count sigue sin tocarse.
--
-- Pendiente de front (no es SQL): FaceSearchSection descarga directamente tras
-- participar en una campaña (flujo PhotoCampaignModal) sin volver a llamar al
-- RPC; esas descargas no quedarían registradas hasta que el front llame a
-- check_and_register_download también en ese camino.
--
-- Privilegios: en este proyecto pg_default_acl otorga EXECUTE/ACL directo a
-- anon, authenticated y service_role; se revoca explícitamente de anon.
-- ============================================================

BEGIN;

-- ---------- 1. Registro de descargas ----------
CREATE TABLE IF NOT EXISTS public.photo_downloads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_photo_id uuid NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
  first_downloaded_at timestamptz NOT NULL DEFAULT now(),
  last_downloaded_at timestamptz NOT NULL DEFAULT now(),
  download_count integer NOT NULL DEFAULT 1 CHECK (download_count >= 1),
  CONSTRAINT uq_photo_downloads_user_photo UNIQUE (user_id, event_photo_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_downloads_user_last
  ON public.photo_downloads (user_id, last_downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_downloads_photo
  ON public.photo_downloads (event_photo_id);

ALTER TABLE public.photo_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photo_downloads_select_own" ON public.photo_downloads;
CREATE POLICY "photo_downloads_select_own"
  ON public.photo_downloads
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "photo_downloads_select_admin" ON public.photo_downloads;
CREATE POLICY "photo_downloads_select_admin"
  ON public.photo_downloads
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- Sin políticas de escritura: solo las funciones SECURITY DEFINER escriben.
REVOKE ALL ON public.photo_downloads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.photo_downloads TO authenticated;
GRANT ALL ON public.photo_downloads TO service_role;

-- ---------- 2. Misma regla de acceso + registro ----------
CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_has_participation boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  -- Regla vigente, sin cambios: cualquier participación distinta de 'Não concluído'.
  SELECT EXISTS (
    SELECT 1 FROM public.participations
    WHERE user_id = v_user_id AND status <> 'Não concluído'
  ) INTO v_has_participation;

  IF NOT v_has_participation THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  -- La foto debe existir y estar publicada.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_photos
    WHERE id = p_event_photo_id AND status = 'published'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'photo_not_available');
  END IF;

  INSERT INTO public.photo_downloads (user_id, event_photo_id)
  VALUES (v_user_id, p_event_photo_id)
  ON CONFLICT (user_id, event_photo_id) DO UPDATE
    SET last_downloaded_at = now(),
        download_count = public.photo_downloads.download_count + 1;

  RETURN jsonb_build_object('allowed', true);
END;
$function$;

-- CREATE OR REPLACE conserva los permisos existentes (authenticated sí; anon
-- no ejecuta: la función ya devuelve allowed=false sin sesión). Se deja explícito:
REVOKE ALL ON FUNCTION public.check_and_register_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_register_download(uuid) TO authenticated, service_role;

-- ---------- 3. Biblioteca del usuario ----------
CREATE OR REPLACE FUNCTION public.get_my_downloads(
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  event_photo_id uuid,
  image_url text,
  event_date date,
  city text,
  sport_name text,
  region_name text,
  first_downloaded_at timestamptz,
  last_downloaded_at timestamptz,
  download_count integer,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.event_photo_id,
    ep.image_url,
    ep.event_date,
    ep.city,
    s.name,
    r.name,
    d.first_downloaded_at,
    d.last_downloaded_at,
    d.download_count,
    COUNT(*) OVER () AS total_count
  FROM public.photo_downloads d
  JOIN public.event_photos ep ON ep.id = d.event_photo_id AND ep.status = 'published'
  LEFT JOIN public.sports s ON s.id = ep.sport_id
  LEFT JOIN public.regions r ON r.id = ep.region_id
  WHERE d.user_id = auth.uid()
  ORDER BY d.last_downloaded_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.get_my_downloads(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_downloads(integer, integer) TO authenticated;

COMMIT;

-- ============================================================
-- Verificación posterior (pegar resultados):
--
-- 1) Permisos (esperado: anon_exec false en ambas; authenticated_exec true):
-- SELECT p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('check_and_register_download', 'get_my_downloads');
--
-- 2) La tabla no admite escritura de usuarios (esperado: solo SELECT a authenticated):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND table_name = 'photo_downloads'
-- ORDER BY grantee, privilege_type;
--
-- 3) search_path fijado en la función (esperado: {search_path=public}):
-- SELECT proconfig FROM pg_proc
-- WHERE proname = 'check_and_register_download' AND pronamespace = 'public'::regnamespace;
--
-- 4) PRUEBA OBLIGATORIA en la app con un atleta que tenga participación válida:
--    descargar una foto → debe aparecer 1 fila en photo_downloads; descargarla
--    de nuevo → sigue 1 fila con download_count = 2. Un atleta SIN participación
--    válida debe seguir recibiendo allowed=false y no dejar fila.
-- ============================================================


-- ============================================================
-- 3BUK · Fase 1 · Seguridad
-- PASO 9 — Proteger más columnas de public.users contra edición por el propio usuario
--
-- Contexto: la política "Users can update own profile" deja a cada usuario actualizar
-- su fila sin restringir columnas; el trigger protect_user_sensitive_columns ya
-- restaura role, plan, user_status, download_count, premium_since y premium_until
-- para quien no es admin. Faltaban campaigns_won, campaigns_participated y email.
--
-- Comprobado antes de escribirlo:
--   * Ninguna función de public toca campaigns_won / campaigns_participated.
--   * El front nunca escribe esas columnas ni email en public.users.
--   * auth.users solo tiene un trigger AFTER INSERT (no hay sincronización de email).
--
-- Efecto: para usuarios no admin, esos 3 campos se restauran al valor anterior
-- (sin error, igual que las columnas ya protegidas). Admin, postgres y service_role
-- siguen pudiendo cambiarlos.
-- Es idempotente (CREATE OR REPLACE). El trigger ya existe, no se toca.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_user_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user::text IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  NEW.plan := OLD.plan;
  NEW.user_status := OLD.user_status;
  NEW.download_count := OLD.download_count;
  NEW.premium_since := OLD.premium_since;
  NEW.premium_until := OLD.premium_until;
  NEW.campaigns_won := OLD.campaigns_won;
  NEW.campaigns_participated := OLD.campaigns_participated;
  NEW.email := OLD.email;

  RETURN NEW;
END;
$function$;

-- Verificación (debe devolver true en las tres columnas nuevas):
SELECT
  position('NEW.campaigns_won := OLD.campaigns_won' IN pg_get_functiondef('public.protect_user_sensitive_columns'::regproc)) > 0 AS protege_campaigns_won,
  position('NEW.campaigns_participated := OLD.campaigns_participated' IN pg_get_functiondef('public.protect_user_sensitive_columns'::regproc)) > 0 AS protege_campaigns_participated,
  position('NEW.email := OLD.email' IN pg_get_functiondef('public.protect_user_sensitive_columns'::regproc)) > 0 AS protege_email;
