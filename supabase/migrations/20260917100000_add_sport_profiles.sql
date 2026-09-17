BEGIN;

-- 1. Crear tabla sport_profiles (1:1 con users)
CREATE TABLE IF NOT EXISTS public.sport_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  practice_time TEXT CHECK (practice_time IS NULL OR practice_time IN ('menos_1_ano','1_a_3_anos','3_a_5_anos','mais_5_anos')),
  favorite_modality TEXT,
  main_goal TEXT CHECK (main_goal IS NULL OR main_goal IN ('melhorar_desempenho','participar_eventos','superar_limites','cuidar_saude','competir')),
  weekly_frequency TEXT CHECK (weekly_frequency IS NULL OR weekly_frequency IN ('1_vez','2_vezes','3_vezes','4_vezes','5_ou_mais')),
  target_event_2028 TEXT,
  desired_reward TEXT CHECK (desired_reward IS NULL OR desired_reward IN ('inscricao_eventos','kit_esportivo','produtos_esportivos','premios_dinheiro','outros_premios')),
  expectation_2028 TEXT CHECK (expectation_2028 IS NULL OR expectation_2028 IN ('mais_sorteios','mais_eventos','mais_premios','beneficios_premium','novas_experiencias')),
  instagram_handle TEXT,
  tiktok_handle TEXT,
  facebook_handle TEXT,
  youtube_handle TEXT,
  other_social_link TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.sport_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
-- Usuario autenticado puede leer exclusivamente su propio perfil
DROP POLICY IF EXISTS "users_read_own_sport_profile" ON public.sport_profiles;
CREATE POLICY "users_read_own_sport_profile" ON public.sport_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Usuario autenticado puede insertar su propio registro
DROP POLICY IF EXISTS "users_upsert_own_sport_profile" ON public.sport_profiles;
CREATE POLICY "users_upsert_own_sport_profile" ON public.sport_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuario autenticado puede actualizar su propio registro
DROP POLICY IF EXISTS "users_update_own_sport_profile" ON public.sport_profiles;
CREATE POLICY "users_update_own_sport_profile" ON public.sport_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Administradores pueden consultar todos los perfiles deportivos
DROP POLICY IF EXISTS "admin_read_all_sport_profiles" ON public.sport_profiles;
CREATE POLICY "admin_read_all_sport_profiles" ON public.sport_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'ADMIN'
    )
  );

-- 4. Permisos Postgres para roles API
GRANT SELECT, INSERT, UPDATE ON TABLE public.sport_profiles TO authenticated, service_role;

-- 5. Función y trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_sport_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_sport_profiles_updated_at ON public.sport_profiles;
CREATE TRIGGER trigger_set_sport_profiles_updated_at
  BEFORE UPDATE ON public.sport_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_sport_profiles_updated_at();

COMMIT;
