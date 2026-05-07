CREATE TABLE IF NOT EXISTS public.home_popups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.home_popups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Home popups viewable by everyone" ON public.home_popups;
CREATE POLICY "Home popups viewable by everyone"
ON public.home_popups FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can insert home popups" ON public.home_popups;
CREATE POLICY "Admins can insert home popups"
ON public.home_popups FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

DROP POLICY IF EXISTS "Admins can delete home popups" ON public.home_popups;
CREATE POLICY "Admins can delete home popups"
ON public.home_popups FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('popups', 'popups', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Public popups access" ON storage.objects;
CREATE POLICY "Public popups access"
ON storage.objects FOR SELECT
USING (bucket_id = 'popups');

DROP POLICY IF EXISTS "Admins can upload popups" ON storage.objects;
CREATE POLICY "Admins can upload popups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'popups'
  AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);
