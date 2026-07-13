-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Create event_photos table
CREATE TABLE IF NOT EXISTS public.event_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    embedding vector(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on event_photos
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_photos
CREATE POLICY "Allow public read access to event_photos"
    ON public.event_photos
    FOR SELECT
    TO public
    USING (true);

-- Function to match faces
CREATE OR REPLACE FUNCTION match_event_photos (
  query_embedding vector(512),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  campaign_id uuid,
  photo_url text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ep.id,
    ep.campaign_id,
    ep.photo_url,
    1 - (ep.embedding <=> query_embedding) AS similarity
  FROM public.event_photos ep
  WHERE 1 - (ep.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Grant permissions to service_role and authenticated
GRANT ALL PRIVILEGES ON TABLE public.event_photos TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON FUNCTION public.match_event_photos TO anon, authenticated, service_role;
