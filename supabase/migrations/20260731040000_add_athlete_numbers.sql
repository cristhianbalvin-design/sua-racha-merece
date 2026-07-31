BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_athlete_numbers()
RETURNS TABLE(
  user_id uuid,
  athlete_number bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    ROW_NUMBER() OVER (ORDER BY u.created_at ASC NULLS LAST, u.id ASC) AS athlete_number
  FROM public.users u
  WHERE u.role <> 'ADMIN';
$$;

REVOKE ALL ON FUNCTION public.get_user_athlete_numbers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_athlete_numbers() TO authenticated;

COMMIT;
