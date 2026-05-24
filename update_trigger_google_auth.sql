-- ================================================================
-- Migración: Soporte para Google OAuth 2.0 y validación de términos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- 1. Asegurar campo auth_provider en public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

-- 2. Modificar trigger handle_new_user para diferenciar email de OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  accepted BOOLEAN;
  provider_name TEXT;
BEGIN
  -- Obtener proveedor de autenticación
  provider_name := COALESCE(new.raw_app_meta_data->>'provider', 'email');
  
  -- Extraer metadatos
  accepted := (new.raw_user_meta_data->>'accepted_terms')::boolean;
  
  -- Si el registro es directo por email, validamos que haya aceptado términos
  IF provider_name = 'email' THEN
    IF accepted IS NOT TRUE THEN
      RAISE EXCEPTION 'Você deve aceitar os Termos e Condições para criar uma conta.';
    END IF;
  ELSE
    -- Para registros OAuth (Google), inicializar en false y obligar aceptación en el frontend
    accepted := false;
  END IF;

  INSERT INTO public.users (id, email, name, role, accepted_terms, accepted_terms_at, auth_provider)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'Corredor'), 
    COALESCE(new.raw_user_meta_data->>'role', 'USUARIO'),
    accepted,
    CASE WHEN accepted THEN NOW() ELSE NULL END,
    provider_name
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
