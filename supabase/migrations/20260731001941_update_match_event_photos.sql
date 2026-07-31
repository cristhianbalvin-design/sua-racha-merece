DROP FUNCTION IF EXISTS public.match_event_photos(vector, double precision, integer);

CREATE OR REPLACE FUNCTION public.match_event_photos(query_embedding vector, match_threshold double precision, match_count integer)
RETURNS TABLE(
  id uuid,
  campaign_id uuid,
  image_url text,
  region_id uuid,
  city text,
  sport_id uuid,
  photographer_id uuid,
  event_date date,
  similarity double precision
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ep.id,
    ep.campaign_id,
    ep.image_url,
    ep.region_id,
    ep.city,
    ep.sport_id,
    ep.photographer_id,
    ep.event_date,
    1 - (ep.embedding <=> query_embedding) AS similarity
  FROM public.event_photos ep
  WHERE 1 - (ep.embedding <=> query_embedding) > match_threshold
  ORDER BY ep.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;
