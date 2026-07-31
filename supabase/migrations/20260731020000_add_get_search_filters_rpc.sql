BEGIN;

CREATE OR REPLACE FUNCTION public.get_search_filters()
RETURNS TABLE(
  region_id uuid,
  region_name text,
  sport_id uuid,
  sport_name text,
  event_date date,
  photographer_id uuid,
  photographer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ep.region_id,
    r.name AS region_name,
    ep.sport_id,
    s.name AS sport_name,
    ep.event_date,
    ep.photographer_id,
    p.name AS photographer_name
  FROM public.event_photos ep
  LEFT JOIN public.regions r ON r.id = ep.region_id
  LEFT JOIN public.sports s ON s.id = ep.sport_id
  LEFT JOIN public.photographers p ON p.id = ep.photographer_id;
END;
$$;

COMMIT;
