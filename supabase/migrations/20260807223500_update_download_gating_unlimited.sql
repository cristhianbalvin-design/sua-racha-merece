BEGIN;

-- Change download requirement: unlimited downloads if user has any participation 
-- that is not 'Não concluído' (Em curso, Concluído, Qualificado, Ganhador).
CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_has_participation boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  -- Verifica si tiene al menos una participación válida (cualquiera excepto 'Não concluído')
  SELECT EXISTS (
    SELECT 1 FROM public.participations
    WHERE user_id = v_user_id AND status <> 'Não concluído'
  ) INTO v_has_participation;

  IF v_has_participation THEN
    RETURN jsonb_build_object('allowed', true);
  ELSE
    RETURN jsonb_build_object('allowed', false);
  END IF;
END;
$$;

COMMIT;
