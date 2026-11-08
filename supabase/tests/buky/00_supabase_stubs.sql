-- Simulación mínima de Supabase para probar los SQL de Buky en un Postgres local.
-- NO se ejecuta en producción.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO CURRENT_USER;
-- Como en Supabase, la API entra con el usuario 'authenticator' y cambia de rol (SET ROLE).
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;

CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto SCHEMA extensions;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;

-- Privilegios por defecto como en Supabase: todo concedido, la seguridad la da RLS.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Tablas existentes de 3BUK que los SQL de Buky usan (columnas reales de producción).
CREATE TABLE public.users (
  id uuid PRIMARY KEY, role text DEFAULT 'USUARIO', name text, email text, city text, country text,
  sport text, avatar_url text, plan text DEFAULT 'Freemium', user_status text DEFAULT 'Ativo',
  campaigns_participated int DEFAULT 0, campaigns_won int DEFAULT 0, created_at timestamptz DEFAULT now(),
  phone text, gender text, birth_date date, accepted_terms boolean, accepted_terms_at timestamptz,
  auth_provider text, download_count int DEFAULT 0, premium_since timestamptz, premium_until timestamptz
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'ADMIN') $$;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Admins can view all profiles" ON public.users FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

-- Campañas de patrocinio de 3BUK (solo lo que usa el paso 26)
CREATE TABLE public.campaigns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, prize text, city text,
  status text, is_hidden boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.participations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, campaign_id uuid,
  status text, photo_url text, created_at timestamptz DEFAULT now());
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

-- Pagos, fotos y descargas de 3BUK (solo lo que usa el paso 27)
CREATE TABLE public.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, provider text, provider_payment_id text,
  preference_id text, product text, amount_cents integer CHECK (amount_cents > 0), currency text DEFAULT 'BRL', status text,
  created_at timestamptz DEFAULT now(), approved_at timestamptz, premium_applied_at timestamptz, premium_revoked_at timestamptz);
CREATE TABLE public.event_photos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text DEFAULT 'published', image_url text);
CREATE TABLE public.photo_downloads (id bigserial PRIMARY KEY, user_id uuid, event_photo_id uuid,
  first_downloaded_at timestamptz DEFAULT now(), last_downloaded_at timestamptz DEFAULT now(),
  download_count integer DEFAULT 1 CHECK (download_count >= 1), UNIQUE (user_id, event_photo_id));
CREATE FUNCTION public.user_is_premium(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS
$$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.plan = 'Premium' AND u.premium_until > now()) $$;

CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb, description text, updated_at timestamptz DEFAULT now());
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_select_authenticated ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, title text,
  message text, campaign_id uuid, read boolean DEFAULT false, created_at timestamptz DEFAULT now());
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
