-- ============================================================
-- 3BUK · Fase 1 · Paso 8 — Corrección de handle_new_user para invitar fotógrafos
--
-- Problema: invite-photographer crea la cuenta con
-- auth.admin.createUser({ app_metadata: { invited_photographer: true } }).
-- El trigger AFTER INSERT en auth.users se ejecuta ANTES de que GoTrue
-- aplique app_metadata, así que no ve la marca y lanza
-- "Você deve aceitar os Termos e Condições para criar uma conta."
-- (visto en los logs de Postgres y Auth a las 23:39:49Z).
--
-- Solución: además de la marca (se conserva), el trigger deja pasar el alta
-- cuando YA existe una fila en public.photographers con ese mismo email y sin
-- cuenta vinculada. Esa fila solo la crea un ADMIN, así que no es falsificable
-- desde el registro público. No se marca accepted_terms como aceptado: el
-- fotógrafo no aceptó los términos de atleta; acepta los suyos en el portal.
--
-- Todo lo demás de la función queda IDÉNTICO a la versión actual.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  accepted boolean;
  provider_name text;
BEGIN
  provider_name := COALESCE(
    NEW.raw_app_meta_data ->> 'provider',
    'email'
  );

  accepted := COALESCE(
    (NEW.raw_user_meta_data ->> 'accepted_terms')::boolean,
    false
  );

  IF provider_name = 'email'
     AND accepted IS NOT TRUE
     AND COALESCE(NEW.raw_app_meta_data ->> 'invited_photographer', 'false') <> 'true'
     AND NOT EXISTS (
       SELECT 1
       FROM public.photographers ph
       WHERE lower(ph.email) = lower(NEW.email)
         AND ph.auth_user_id IS NULL
     )
  THEN
    RAISE EXCEPTION
      'Você deve aceitar os Termos e Condições para criar uma conta.';
  END IF;

  IF provider_name <> 'email' THEN
    accepted := false;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    accepted_terms,
    accepted_terms_at,
    auth_provider
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'Corredor'),
    'USUARIO',
    accepted,
    CASE WHEN accepted THEN now() ELSE NULL END,
    provider_name
  );

  RETURN NEW;
END;
$function$;
