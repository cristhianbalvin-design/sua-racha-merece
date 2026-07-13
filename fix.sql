CREATE TABLE IF NOT EXISTS public.terms_and_conditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  version integer NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.terms_and_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terms viewable by everyone" ON public.terms_and_conditions FOR SELECT USING (true);
GRANT SELECT ON public.terms_and_conditions TO anon, authenticated;

INSERT INTO public.terms_and_conditions (content, version, is_active) VALUES ('Estos son los términos y condiciones por defecto. Por favor, acéptelos para continuar.', 1, true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
