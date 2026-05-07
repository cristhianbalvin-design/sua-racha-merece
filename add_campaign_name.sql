ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE public.campaigns
SET name = description
WHERE name IS NULL OR name = '';

ALTER TABLE public.campaigns
  ALTER COLUMN name SET NOT NULL;
