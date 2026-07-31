BEGIN;
ALTER TABLE public.event_photos
  ADD COLUMN IF NOT EXISTS event_date DATE;
COMMIT;
