-- Bloque 3: celdas de 0,0003 grados. Los atletas distintos se calculan a partir
-- de contribuciones por sesi?n; ning?n cliente recibe contribuciones individuales.
BEGIN;
CREATE INDEX IF NOT EXISTS buky_sessions_live_idx ON public.buky_sessions(last_seen_at DESC) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS buky_sessions_seen_idx ON public.buky_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS buky_sessions_started_idx ON public.buky_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS buky_sessions_free_history_idx ON public.buky_sessions(started_at DESC) WHERE mode = 'free' AND status = 'valid';
CREATE TABLE IF NOT EXISTS public.buky_heat_ingested (
  session_id uuid PRIMARY KEY REFERENCES public.buky_sessions(id) ON DELETE CASCADE,
  city_code integer NOT NULL REFERENCES public.br_cities(code),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day date NOT NULL
);
CREATE TABLE IF NOT EXISTS public.buky_heat_contributions (
  session_id uuid NOT NULL REFERENCES public.buky_heat_ingested(session_id) ON DELETE CASCADE,
  cell_x integer NOT NULL, cell_y integer NOT NULL, hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (session_id, cell_x, cell_y)
);
CREATE INDEX IF NOT EXISTS buky_heat_ingested_city_day_idx ON public.buky_heat_ingested(city_code, day);
CREATE TABLE IF NOT EXISTS public.buky_heat_cells (
  city_code integer NOT NULL REFERENCES public.br_cities(code), cell_x integer NOT NULL, cell_y integer NOT NULL,
  hits integer NOT NULL, athletes integer NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_code, cell_x, cell_y)
);
ALTER TABLE public.buky_heat_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_heat_ingested ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_heat_contributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buky_heat_cells, public.buky_heat_ingested, public.buky_heat_contributions FROM PUBLIC, anon, authenticated;

-- La sesi?n determina ciudad, atleta y fecha; no se conf?a en esos datos del cliente.
CREATE OR REPLACE FUNCTION public.buky_heat_add(p_city_code integer, p_cells jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE sid uuid; s public.buky_sessions%ROWTYPE;
BEGIN
  sid := (p_cells->>'session_id')::uuid;
  SELECT * INTO s FROM public.buky_sessions WHERE id = sid AND mode = 'free' AND status = 'valid' AND start_city_code = p_city_code;
  IF NOT FOUND OR coalesce(jsonb_typeof(p_cells->'cells'), '') <> 'array' OR jsonb_array_length(p_cells->'cells') > 25000 THEN
    RAISE EXCEPTION 'invalid_heat_session' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(43, p_city_code);
  INSERT INTO public.buky_heat_ingested(session_id, city_code, user_id, day)
  VALUES (sid, p_city_code, s.user_id, (s.started_at AT TIME ZONE public.buky_tz())::date)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.buky_heat_contributions(session_id, cell_x, cell_y, hits)
  SELECT sid, (v->>'x')::integer, (v->>'y')::integer, sum((v->>'hits')::integer)::integer
  FROM jsonb_array_elements(p_cells->'cells') v
  WHERE (v->>'x')::integer BETWEEN -600000 AND 600000 AND (v->>'y')::integer BETWEEN -300000 AND 300000
    AND (v->>'hits')::integer BETWEEN 1 AND 25000
  GROUP BY 2, 3;
  INSERT INTO public.buky_heat_cells(city_code, cell_x, cell_y, hits, athletes)
  SELECT p_city_code, c.cell_x, c.cell_y, sum(c.hits)::integer, count(DISTINCT i.user_id)::integer
  FROM public.buky_heat_contributions c JOIN public.buky_heat_ingested i ON i.session_id = c.session_id
  WHERE i.city_code = p_city_code AND (c.cell_x,c.cell_y) IN
    (SELECT cell_x, cell_y FROM public.buky_heat_contributions WHERE session_id = sid)
  GROUP BY c.cell_x,c.cell_y
  ON CONFLICT (city_code, cell_x, cell_y) DO UPDATE SET hits=excluded.hits, athletes=excluded.athletes, updated_at=now();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.buky_heat_add(integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buky_heat_add(integer,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_buky_heat_add(p_city_code integer, p_cells jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN public.buky_heat_add(p_city_code,p_cells);
END $$;
CREATE OR REPLACE FUNCTION public.admin_buky_heat_pending(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM (SELECT s.id, s.start_city_code AS city_code, s.track_path FROM public.buky_sessions s WHERE s.mode='free' AND s.status='valid' AND s.track_path IS NOT NULL AND s.start_city_code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.buky_heat_ingested i WHERE i.session_id=s.id) ORDER BY s.started_at LIMIT greatest(1,least(coalesce(p_limit,20),50))) q);
END $$;
CREATE OR REPLACE FUNCTION public.admin_buky_heat_track_allowed(p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RETURN false; END IF;
 RETURN EXISTS (SELECT 1 FROM public.buky_sessions s WHERE s.track_path=p_path AND s.mode='free' AND s.status='valid' AND s.start_city_code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.buky_heat_ingested i WHERE i.session_id=s.id));
END $$;
REVOKE ALL ON FUNCTION public.admin_buky_heat_track_allowed(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_buky_heat_track_allowed(text) TO authenticated;
DROP POLICY IF EXISTS buky_tracks_admin_heat_pending ON storage.objects;
CREATE POLICY buky_tracks_admin_heat_pending ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='buky-tracks' AND public.admin_buky_heat_track_allowed(name));
CREATE OR REPLACE FUNCTION public.admin_buky_heat_cities()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.sessions DESC,q.name), '[]'::jsonb) FROM (SELECT c.code,c.name,s.uf,c.lat,c.lon,count(i.session_id) AS sessions FROM public.br_cities c JOIN public.br_states s ON s.code=c.state_code LEFT JOIN public.buky_heat_ingested i ON i.city_code=c.code GROUP BY c.code,c.name,s.uf,c.lat,c.lon) q);
END $$;
CREATE OR REPLACE FUNCTION public.admin_buky_heat(p_city_code integer, p_days integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_days IS NOT NULL AND p_days NOT IN (7,30) THEN RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023'; END IF;
 WITH selected AS (SELECT * FROM public.buky_heat_ingested WHERE city_code=p_city_code AND (p_days IS NULL OR day >= (now() AT TIME ZONE public.buky_tz())::date - (p_days-1))),
 totals AS (SELECT count(*) sessions,count(DISTINCT user_id) athletes FROM selected),
 cells AS (SELECT c.cell_x x,c.cell_y y,sum(c.hits)::integer hits,count(DISTINCT s.user_id)::integer athletes FROM selected s JOIN public.buky_heat_contributions c ON c.session_id=s.session_id GROUP BY c.cell_x,c.cell_y)
 SELECT jsonb_build_object('sessions',t.sessions,'athletes',t.athletes,'cells',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM cells c WHERE t.athletes >= 3 OR c.athletes > 1),'[]'::jsonb)) INTO result FROM totals t;
 -- Con menos de tres atletas en el periodo, se ocultan las celdas de un solo atleta.
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.admin_buky_live()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result jsonb; today timestamptz := date_trunc('day',now() AT TIME ZONE public.buky_tz()) AT TIME ZONE public.buky_tz();
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 WITH active AS (SELECT s.*,c.name city,st.uf,st.name state FROM public.buky_sessions s LEFT JOIN public.users u ON u.id=s.user_id LEFT JOIN public.br_cities c ON c.code=coalesce(s.start_city_code,u.city_code) LEFT JOIN public.br_states st ON st.code=c.state_code WHERE s.status='running' AND s.last_seen_at >= now()-interval '2 minutes'),
 states AS (SELECT coalesce(uf::text,'?') uf,coalesce(state,'N?o informada') name,count(*) count FROM active GROUP BY uf,state),
 cities AS (SELECT coalesce(city,'N?o informada') name,coalesce(uf::text,'?') uf,count(*) count FROM active GROUP BY city,uf),
 recent AS (SELECT coalesce(c.name,'N?o informada') city,s.mode,s.started_at,s.status,concat('Atleta ', upper(left(coalesce(u.name,''),1))) athlete FROM public.buky_sessions s LEFT JOIN public.users u ON u.id=s.user_id LEFT JOIN public.br_cities c ON c.code=coalesce(s.start_city_code,u.city_code) ORDER BY s.started_at DESC LIMIT 10)
 SELECT jsonb_build_object('now',jsonb_build_object('total',(SELECT count(*) FROM active),'route',(SELECT count(*) FROM active WHERE mode='route'),'free',(SELECT count(*) FROM active WHERE mode='free'),'country','BR'),
 'states',coalesce((SELECT jsonb_agg(to_jsonb(states) ORDER BY count DESC) FROM states),'[]'::jsonb),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(cities) ORDER BY count DESC) FROM cities),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(to_jsonb(recent) ORDER BY started_at DESC) FROM recent),'[]'::jsonb),
 'athletes_today',(SELECT count(DISTINCT user_id) FROM public.buky_sessions WHERE started_at>=today OR last_seen_at>=today),
 'athletes_24h',(SELECT count(DISTINCT user_id) FROM public.buky_sessions WHERE started_at>=now()-interval '24 hours' OR last_seen_at>=now()-interval '24 hours'),
 'sessions_today',(SELECT count(*) FROM public.buky_sessions WHERE started_at>=today),
 'invalid_today',(SELECT count(*) FROM public.buky_sessions WHERE status='invalid' AND finalized_at>=today),
 'bukys_today',(SELECT count(*) FROM public.buky_passes WHERE awarded AND local_day=(now() AT TIME ZONE public.buky_tz())::date)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_buky_heat_add(integer,jsonb), public.admin_buky_heat_pending(integer), public.admin_buky_heat_cities(), public.admin_buky_heat(integer,integer), public.admin_buky_live() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_buky_heat_add(integer,jsonb), public.admin_buky_heat_pending(integer), public.admin_buky_heat_cities(), public.admin_buky_heat(integer,integer), public.admin_buky_live() TO authenticated;
COMMIT;
