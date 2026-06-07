ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS image_url TEXT;
