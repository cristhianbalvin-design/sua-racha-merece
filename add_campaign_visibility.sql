-- Agregar la columna is_hidden a la tabla campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Forzar el refresco de caché de schema en Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';
