-- add_face_recognition.sql

-- 1. Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear tabla para las fotos de los eventos
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  embedding vector(512), -- Buffalo_l model always outputs 512-dimensional vectors
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Habilitar RLS
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
-- Todos pueden ver las fotos (necesario para la búsqueda en el frontend)
CREATE POLICY "Event photos are viewable by everyone" 
  ON public.event_photos FOR SELECT USING (true);

-- Solo admins pueden insertar/actualizar/borrar (flujo de carga masiva)
CREATE POLICY "Admins can insert event photos" 
  ON public.event_photos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
  );

CREATE POLICY "Admins can update event photos" 
  ON public.event_photos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
  );

CREATE POLICY "Admins can delete event photos" 
  ON public.event_photos FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
  );

-- Función RPC para buscar fotos similares (será llamada desde la Edge Function)
DROP FUNCTION IF EXISTS match_event_photos(vector, float, int);

CREATE OR REPLACE FUNCTION match_event_photos(
  query_embedding vector(512),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  campaign_id UUID,
  image_url TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ep.id,
    ep.campaign_id,
    ep.image_url,
    1 - (ep.embedding <=> query_embedding) AS similarity
  FROM public.event_photos ep
  WHERE 1 - (ep.embedding <=> query_embedding) > match_threshold
  ORDER BY ep.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. Crear el bucket de Storage para las fotos del evento (si no existe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-photos', 'event-photos', true) 
ON CONFLICT (id) DO NOTHING;

-- Políticas de seguridad para el bucket
CREATE POLICY "Public event-photos access" ON storage.objects 
  FOR SELECT USING (bucket_id = 'event-photos');

CREATE POLICY "Admins can upload event-photos" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'event-photos' AND 
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
  );

CREATE POLICY "Admins can update event-photos" ON storage.objects 
  FOR UPDATE USING (
    bucket_id = 'event-photos' AND 
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
  );

CREATE POLICY "Admins can delete event-photos" ON storage.objects 
  FOR DELETE USING (
    bucket_id = 'event-photos' AND 
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
  );
