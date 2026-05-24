-- ================================================================
-- Migración: Tabla de Términos y Condiciones + Columnas de Aceptación en Usuarios
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- 1. Crear tabla terms_and_conditions
CREATE TABLE IF NOT EXISTS public.terms_and_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Habilitar RLS (Row Level Security) en terms_and_conditions
ALTER TABLE public.terms_and_conditions ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas de Seguridad RLS
DROP POLICY IF EXISTS "T&C viewable by everyone" ON public.terms_and_conditions;
CREATE POLICY "T&C viewable by everyone" ON public.terms_and_conditions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can modify T&C" ON public.terms_and_conditions;
CREATE POLICY "Only admins can modify T&C" ON public.terms_and_conditions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

-- 4. Agregar columnas de aceptación en public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;

-- 5. Modificar el trigger handle_new_user para validación backend
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  accepted BOOLEAN;
  accepted_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Extraer de los metadatos de registro de auth.users
  accepted := (new.raw_user_meta_data->>'accepted_terms')::boolean;
  
  -- Validación backend: Si no se aceptaron los términos, rechazar inserción
  IF accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'Você deve aceitar os Termos e Condições para criar uma conta.';
  END IF;

  INSERT INTO public.users (id, email, name, role, accepted_terms, accepted_terms_at)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'Corredor'), 
    COALESCE(new.raw_user_meta_data->>'role', 'USUARIO'),
    accepted,
    COALESCE((new.raw_user_meta_data->>'accepted_terms_at')::timestamp with time zone, NOW())
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Insertar Términos y Condiciones iniciales por defecto
INSERT INTO public.terms_and_conditions (content, version, is_active) VALUES (
  '<h3>Termos e Condições de Uso — 3BUK</h3><p>Bem-vindo ao 3BUK. Ao se cadastrar em nossa plataforma, você concorda com as seguintes condições:</p><ol><li><strong>Elegibilidade:</strong> Você deve ter pelo menos 18 anos ou possuir autorização legal dos responsáveis para participar de campanhas.</li><li><strong>Direito de Imagem:</strong> Ao enviar fotos ou vídeos como evidências nas campanhas, você autoriza a plataforma a utilizá-los para fins de validação e divulgação de resultados.</li><li><strong>Conduta e Fair Play:</strong> Evidências manipuladas ou falsas resultarão em desqualificação imediata e suspensão da conta.</li><li><strong>Proteção de Dados:</strong> Seus dados pessoais serão tratados em conformidadde com a Lei Geral de Proteção de Dados (LGPD).</li></ol>',
  1,
  true
) ON CONFLICT DO NOTHING;
