BEGIN;

-- Helper function for PT-BR Title Case (e.g. 'rio de janeiro' -> 'Rio de Janeiro')
CREATE OR REPLACE FUNCTION public.to_title_case_pt_br(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  words text[];
  i int;
  exceptions text[] := ARRAY['de', 'da', 'do', 'dos', 'das', 'e'];
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  words := regexp_split_to_array(lower(trim(input_text)), '\s+');
  
  FOR i IN 1..array_length(words, 1) LOOP
    IF i = 1 OR NOT (words[i] = ANY(exceptions)) THEN
      words[i] := initcap(words[i]);
    END IF;
  END LOOP;
  
  RETURN array_to_string(words, ' ');
END;
$function$;

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
  LEFT JOIN public.photographers p ON p.id = ep.photographer_id;
END;
$function$;

-- Safely drop all existing variants of match_event_photos to avoid orphans
DO $do$ 
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid::regprocedure AS func_sig 
    FROM pg_proc 
    WHERE proname = 'match_event_photos' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_sig;
  END LOOP;
END $do$;

CREATE OR REPLACE FUNCTION public.match_event_photos(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  filter_region_id uuid DEFAULT null,
  filter_sport_id uuid DEFAULT null,
  filter_event_date date DEFAULT null,
  filter_photographer_id uuid DEFAULT null,
  filter_city text DEFAULT null
)
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
    AND (filter_region_id IS NULL OR ep.region_id = filter_region_id)
    AND (filter_sport_id IS NULL OR ep.sport_id = filter_sport_id)
    AND (filter_event_date IS NULL OR ep.event_date = filter_event_date)
    AND (filter_photographer_id IS NULL OR ep.photographer_id = filter_photographer_id)
    AND (filter_city IS NULL OR LOWER(TRIM(ep.city)) = LOWER(TRIM(filter_city)))
  ORDER BY ep.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Restore GRANT EXECUTE permissions explicitly for both functions
GRANT EXECUTE ON FUNCTION public.get_search_filters() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_event_photos(vector, double precision, integer, uuid, uuid, date, uuid, text) TO anon, authenticated, service_role;

COMMIT;
