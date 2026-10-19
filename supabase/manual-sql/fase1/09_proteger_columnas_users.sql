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
