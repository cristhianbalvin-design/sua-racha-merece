BEGIN;
ALTER TABLE public.photographers
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
COMMIT;
