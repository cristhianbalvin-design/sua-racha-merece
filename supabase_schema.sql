-- Habilitar extensión pgcrypto para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================
-- 1. Tabla: users
-- ==============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'USUARIO' CHECK (role IN ('USUARIO', 'ADMIN')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  city TEXT,
  country TEXT,
  sport TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'Freemium' CHECK (plan IN ('Freemium', 'Premium')),
  user_status TEXT DEFAULT 'Ativo' CHECK (user_status IN ('Ativo', 'Desabilitado')),
  campaigns_participated INTEGER DEFAULT 0,
  campaigns_won INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

-- Trigger: Insert en users al registrar desde Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'Corredor'), 
    COALESCE(new.raw_user_meta_data->>'role', 'USUARIO')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================
-- 2. Tabla: campaigns
-- ==============================================
CREATE TABLE public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  sport_icon TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT NOT NULL,
  winners_count INTEGER NOT NULL,
  prize TEXT NOT NULL,
  plan_required TEXT DEFAULT 'Ambos' CHECK (plan_required IN ('Freemium', 'Premium', 'Ambos')),
  instagram_optional BOOLEAN DEFAULT false,
  instagram_hashtags TEXT,
  status TEXT DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Concluído', 'Eliminado', 'Qualificado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaigns are viewable by everyone" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Admins can insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update campaigns" ON public.campaigns FOR UPDATE USING (true);
CREATE POLICY "Admins can delete campaigns" ON public.campaigns FOR DELETE USING (true);

-- ==============================================
-- 3. Tabla: participations
-- ==============================================
CREATE TABLE public.participations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Em curso' CHECK (status IN ('Em curso', 'Concluído', 'Não concluído', 'Qualificado', 'Ganhador')),
  photo_url TEXT,
  comment TEXT,
  instagram_posted BOOLEAN DEFAULT false,
  attitude_score NUMERIC,
  commitment_score NUMERIC DEFAULT 10,
  continuity_score NUMERIC,
  total_score NUMERIC,
  prize_delivered BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(user_id, campaign_id)
);

ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participations viewable by all (for leaderboards)" ON public.participations FOR SELECT USING (true);
CREATE POLICY "Users can insert their own participation" ON public.participations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation, admins all" ON public.participations FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

-- ==============================================
-- 4. Tablas Maestras
-- ==============================================
CREATE TABLE public.sports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sports viewable by everyone" ON public.sports FOR SELECT USING (true);
CREATE POLICY "Only admins modify sports" ON public.sports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

CREATE TABLE public.regions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regions viewable by everyone" ON public.regions FOR SELECT USING (true);
CREATE POLICY "Only admins modify regions" ON public.regions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

-- Mock Master Data Inicial
INSERT INTO public.sports (name) VALUES ('Corrida de Rua'), ('Ciclismo'), ('Natação'), ('Crossfit');
INSERT INTO public.regions (name) VALUES ('Nordeste'), ('Sudeste'), ('Sul'), ('Norte'), ('Centro-Oeste');

-- ==============================================
-- 5. Storage Buckets (Fotos y Evidencias)
-- ==============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('evidences', 'evidences', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Public avatars access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'evidences'));
CREATE POLICY "Any user can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('avatars', 'evidences'));
CREATE POLICY "Any user can update" ON storage.objects FOR UPDATE USING (bucket_id IN ('avatars', 'evidences'));
CREATE POLICY "Any user can delete" ON storage.objects FOR DELETE USING (bucket_id IN ('avatars', 'evidences'));
