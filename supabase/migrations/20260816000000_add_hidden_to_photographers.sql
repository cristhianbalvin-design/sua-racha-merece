BEGIN;

-- Add is_hidden column to photographers table
ALTER TABLE public.photographers ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE NOT NULL;

-- Safely drop all existing variants of get_search_filters to avoid orphans
DO $do$ 
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid::regprocedure AS func_sig 
    FROM pg_proc 
    WHERE proname = 'get_search_filters' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_sig;
  END LOOP;
END $do$;

-- Recreate get_search_filters with is_hidden filtering
CREATE OR REPLACE FUNCTION public.get_search_filters()
RETURNS TABLE(
  region_id uuid,
  region_name text,
  sport_id uuid,
  sport_name text,
  event_date date,
  photographer_id uuid,
  photographer_name text,
  city_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ep.region_id,
    r.name AS region_name,
    ep.sport_id,
    s.name AS sport_name,
    ep.event_date,
    ep.photographer_id,
    p.name AS photographer_name,
    public.to_title_case_pt_br(ep.city) AS city_name
  FROM public.event_photos ep
  LEFT JOIN public.regions r ON r.id = ep.region_id
  LEFT JOIN public.sports s ON s.id = ep.sport_id
  -- Only return photographer names for visible photographers
  LEFT JOIN public.photographers p ON p.id = ep.photographer_id AND p.is_hidden = FALSE;
END;
$function$;

-- Restore GRANT EXECUTE permissions explicitly for the function
GRANT EXECUTE ON FUNCTION public.get_search_filters() TO anon, authenticated, service_role;

COMMIT;
