BEGIN;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_download_count int;
  v_has_active_campaign boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  SELECT download_count INTO v_download_count FROM public.users WHERE id = v_user_id;

  IF v_download_count < 3 THEN
    UPDATE public.users SET download_count = download_count + 1 WHERE id = v_user_id;
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Verifica si tiene campaña 'Em curso'
  SELECT EXISTS (
    SELECT 1 FROM public.participations
    WHERE user_id = v_user_id
      AND (status = 'Em curso' OR status = 'EM CURSO')
  ) INTO v_has_active_campaign;

  IF v_has_active_campaign THEN
    RETURN jsonb_build_object('allowed', true);
  ELSE
    RETURN jsonb_build_object('allowed', false);
  END IF;
END;
$$;
COMMIT;
