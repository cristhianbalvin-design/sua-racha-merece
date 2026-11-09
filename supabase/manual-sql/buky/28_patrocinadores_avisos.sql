-- Paso 28: patrocinadores, canjes y avisos. Reejecutable.
 BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1
  FROM pg_available_extensions
  WHERE name='pg_net') THEN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
END $$ ;
INSERT INTO public.app_settings(key, value, description)
  VALUES ('notify_dispatch_url','"https://ljizlialjsonmmvppoqh.supabase.co/functions/v1/send-notifications"',
  'URL del despachador'), ('notify_email_from','"3buk <avisos@mail.3buk.com>"','Remitente de avisos'),
   ('notify_max_attempts','5','Máximo de intentos')
  ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.buky_sponsor_members (sponsor_id uuid NOT NULL REFERENCES public.buky_sponsors(id),
   user_id uuid NOT NULL REFERENCES public.users(id), role text NOT NULL CHECK(role IN ('owner',
   'staff')), invited_email text, invited_by uuid REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now(),
   revoked_at timestamptz, PRIMARY KEY(sponsor_id, user_id));
ALTER TABLE public.buky_sponsor_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sponsor_members_read ON public.buky_sponsor_members;
CREATE POLICY sponsor_members_read ON public.buky_sponsor_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.buky_sponsor_members
  FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS public.buky_sponsor_invites (email text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.buky_sponsor_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buky_sponsor_invites
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS redeem_token text;
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS redeemed_by uuid REFERENCES public.users(id);
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS redeemed_channel text;
ALTER TABLE public.buky_raffle_results DROP CONSTRAINT IF EXISTS buky_results_redeemed_channel_check;
ALTER TABLE public.buky_raffle_results ADD CONSTRAINT buky_results_redeemed_channel_check CHECK (redeemed_channel IN ('qr',
   'code', 'admin'));
CREATE UNIQUE INDEX IF NOT EXISTS buky_results_redeem_token_key ON public.buky_raffle_results(redeem_token);
CREATE OR REPLACE FUNCTION public.buky_results_write_once() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$ DECLARE v_mutable text[] := ARRAY['delivery_status',
  'delivery_note','delivered_at','redeem_deadline','activated_at', 'republished_to',
  'redeem_code','redeem_token','redeemed_at','redeemed_by', 'redeemed_channel'];
BEGIN
  IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'buky_raffle_results es inmutable' USING ERRCODE='42501';
  END IF;
IF (to_jsonb(NEW)-v_mutable) IS DISTINCT
  FROM (to_jsonb(OLD)-v_mutable) THEN
  RAISE EXCEPTION 'buky_raffle_results es inmutable (solo cambia la entrega)' USING ERRCODE='42501';
  END IF;
IF OLD.redeem_code IS NOT NULL AND NEW.redeem_code IS DISTINCT
  FROM OLD.redeem_code THEN
  RAISE EXCEPTION 'redeem_code_locked' USING ERRCODE='42501';
  END IF;
IF OLD.redeem_token IS NOT NULL AND NEW.redeem_token IS DISTINCT
  FROM OLD.redeem_token THEN
  RAISE EXCEPTION 'redeem_token_locked' USING ERRCODE='42501';
  END IF;
RETURN NEW;
END $$ ;
UPDATE public.buky_raffle_results SET redeem_token=encode(extensions.gen_random_bytes(24),
   'hex')
  WHERE user_id IS NOT NULL AND redeem_token IS NULL;
CREATE OR REPLACE FUNCTION public.buky_result_token() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$ BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.redeem_token IS NULL THEN
  NEW.redeem_token:=encode(extensions.gen_random_bytes(24), 'hex');
  END IF;
RETURN NEW;
END $$ ;
DROP TRIGGER IF EXISTS buky_result_token ON public.buky_raffle_results;
CREATE TRIGGER buky_result_token BEFORE INSERT ON public.buky_raffle_results FOR EACH ROW EXECUTE FUNCTION public.buky_result_token();
CREATE OR REPLACE FUNCTION public.buky_my_sponsors() RETURNS SETOF public.buky_sponsors LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$ SELECT s.*
  FROM public.buky_sponsors s
  JOIN public.buky_sponsor_members m ON m.sponsor_id=s.id
  WHERE s.active AND m.user_id=auth.uid() AND m.revoked_at IS NULL
  ORDER BY s.name $$ ;
CREATE OR REPLACE FUNCTION public.buky_sponsor_lookup(p_value text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$ DECLARE r record;
v text:=regexp_replace(trim(p_value), '^https://www\.3buk\.com/patrocinador/validar/',
   '');
BEGIN
  SELECT x.*,k.title,k.benefit,k.kind,u.name INTO r
  FROM public.buky_raffle_results x
  JOIN public.buky_coupons k ON k.id=x.coupon_id
  JOIN public.users u ON u.id=x.user_id
  WHERE (x.redeem_token=v OR x.redeem_code=v) AND x.delivery_status IN ('pending',
  'notified','delivered','expired') AND (public.is_admin() OR EXISTS (SELECT 1
  FROM public.buky_sponsor_members m
  JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
  WHERE m.sponsor_id=k.sponsor_id AND m.user_id=auth.uid() AND m.revoked_at IS NULL))
  ORDER BY (x.redeem_token=v) DESC,x.drawn_at DESC LIMIT 1;
IF NOT FOUND THEN
  RETURN jsonb_build_object('status', 'not_found');
  END IF;
RETURN jsonb_build_object('status', CASE WHEN r.redeemed_at IS NOT NULL OR r.delivery_status='delivered' THEN
  'redeemed' WHEN r.delivery_status='expired' OR r.redeem_deadline IS NULL OR now()>r.redeem_deadline THEN
  'expired' ELSE
  'valid' END, 'result_id', r.id, 'prize', jsonb_build_object('title', r.title, 'benefit',
   r.benefit, 'kind', r.kind), 'athlete_short_name', public.buky_short_name(r.name),
   'redeem_deadline', r.redeem_deadline, 'redeemed_at', coalesce(r.redeemed_at, r.delivered_at));
END $$ ;
CREATE OR REPLACE FUNCTION public.buky_sponsor_redeem(p_result_id uuid, p_channel text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE r public.buky_raffle_results;
sid uuid;
t timestamptz:=now();
BEGIN
  IF p_channel IS NULL OR p_channel NOT IN ('qr','code','admin') OR (p_channel='admin' AND NOT public.is_admin()) THEN
  RAISE EXCEPTION 'not_member' USING ERRCODE='P0001';
  END IF;
SELECT * INTO r
  FROM public.buky_raffle_results
  WHERE id=p_result_id FOR UPDATE;
IF NOT FOUND THEN
  RAISE EXCEPTION 'not_found' USING ERRCODE='P0001';
  END IF;
SELECT sponsor_id INTO sid
  FROM public.buky_coupons
  WHERE id=r.coupon_id;
IF NOT public.is_admin() AND NOT EXISTS (SELECT 1
  FROM public.buky_sponsor_members m
  JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
  WHERE m.sponsor_id=sid AND m.user_id=auth.uid() AND m.revoked_at IS NULL) THEN
  RAISE EXCEPTION 'not_member' USING ERRCODE='P0001';
  END IF;
IF r.redeemed_at IS NOT NULL OR r.delivery_status='delivered' THEN
  RAISE EXCEPTION 'already_redeemed' USING ERRCODE='P0001';
  END IF;
IF r.delivery_status NOT IN ('pending','notified') OR r.user_id IS NULL THEN
  RAISE EXCEPTION 'not_active' USING ERRCODE='P0001';
  END IF;
IF r.redeem_deadline IS NULL OR t>r.redeem_deadline THEN
  RAISE EXCEPTION 'expired' USING ERRCODE='P0001';
  END IF;
UPDATE public.buky_raffle_results SET delivery_status='delivered',delivered_at=t,
  redeemed_at=t,redeemed_by=auth.uid(),redeemed_channel=p_channel
  WHERE id=r.id;
INSERT INTO public.notifications(user_id, type, title, message)
  VALUES(r.user_id,'buky_prize_redeemed','Prêmio resgatado','Seu prêmio foi marcado como usado.');
RETURN jsonb_build_object('result_id', r.id, 'redeemed_at', t);
END $$ ;
CREATE OR REPLACE FUNCTION public.admin_buky_redeem(p_result_id uuid, p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE j jsonb;
BEGIN
  IF NOT public.is_admin() THEN
  RAISE EXCEPTION 'not_admin' USING ERRCODE='42501';
  END IF;
j:=public.buky_sponsor_redeem(p_result_id, 'admin');
UPDATE public.buky_raffle_results SET delivery_note=p_note
  WHERE id=p_result_id;
RETURN j;
END $$ ;
CREATE OR REPLACE FUNCTION public.admin_buky_sponsor_members(p_sponsor_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$ BEGIN
  IF NOT public.is_admin() THEN
  RAISE EXCEPTION 'not_admin' USING ERRCODE='42501';
  END IF;
RETURN coalesce( (SELECT jsonb_agg(to_jsonb(m)||jsonb_build_object('name', u.name,
   'email', u.email)
  ORDER BY m.created_at)
  FROM public.buky_sponsor_members m
  JOIN public.users u ON u.id=m.user_id
  WHERE m.sponsor_id=p_sponsor_id),'[]'::jsonb);
END $$ ;
CREATE OR REPLACE FUNCTION public.admin_buky_sponsor_revoke(p_sponsor_id uuid, p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN
  IF NOT public.is_admin() THEN
  RAISE EXCEPTION 'not_admin' USING ERRCODE='42501';
  END IF;
UPDATE public.buky_sponsor_members SET revoked_at=now()
  WHERE sponsor_id=p_sponsor_id AND user_id=p_user_id;
END $$ ;
CREATE OR REPLACE FUNCTION public.buky_sponsor_dashboard(p_sponsor_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$ BEGIN
  IF NOT public.is_admin() AND NOT EXISTS (SELECT 1
  FROM public.buky_sponsor_members m
  JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
  WHERE m.sponsor_id=p_sponsor_id AND m.user_id=auth.uid() AND m.revoked_at IS NULL) THEN
  RAISE EXCEPTION 'not_member' USING ERRCODE='P0001';
  END IF;
RETURN jsonb_build_object('coupons', coalesce( (SELECT jsonb_agg(jsonb_build_object('coupon_id',
   k.id, 'title', k.title, 'period_id', p.id, 'period', p.name, 'assigned', (SELECT count(*)
  FROM public.buky_raffle_results r
  WHERE r.coupon_id=k.id AND r.user_id IS NOT NULL AND r.delivery_status<>'standby'),
  'redeemed', (SELECT count(*)
  FROM public.buky_raffle_results r
  WHERE r.coupon_id=k.id AND r.delivery_status='delivered'),'pending', (SELECT count(*)
  FROM public.buky_raffle_results r
  WHERE r.coupon_id=k.id AND r.delivery_status IN ('pending', 'notified') AND r.redeem_deadline>=now()),
  'expired', (SELECT count(*)
  FROM public.buky_raffle_results r
  WHERE r.coupon_id=k.id AND (r.delivery_status='expired' OR (r.delivery_status IN ('pending',
   'notified') AND r.redeem_deadline<now()))),'codes_available', (SELECT count(*)
  FROM public.buky_coupon_codes c
  WHERE c.coupon_id=k.id AND NOT c.assigned)))
  FROM public.buky_coupons k
  JOIN public.buky_raffle_periods p ON p.id=k.period_id
  WHERE k.sponsor_id=p_sponsor_id),'[]'::jsonb), 'redemptions', coalesce( (SELECT jsonb_agg(x.j
  ORDER BY x.d DESC)
  FROM (SELECT coalesce(r.redeemed_at, r.delivered_at) d, jsonb_build_object('date',
   coalesce(r.redeemed_at, r.delivered_at), 'prize', k.title, 'athlete_short_name',
   public.buky_short_name(u.name), 'channel', r.redeemed_channel) j
  FROM public.buky_raffle_results r
  JOIN public.buky_coupons k ON k.id=r.coupon_id
  JOIN public.users u ON u.id=r.user_id
  WHERE k.sponsor_id=p_sponsor_id AND r.delivery_status='delivered'
  ORDER BY coalesce(r.redeemed_at, r.delivered_at) DESC LIMIT 50) x),'[]'::jsonb));
END $$ ;
CREATE OR REPLACE FUNCTION public.buky_my_raffles(p_lat double precision, p_lon double precision) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$ WITH me AS (SELECT u.id,
   u.city_code AS profile_city, CASE WHEN public.buky_is_route_tester() THEN
  coalesce(public.buky_city_at(p_lat, p_lon), u.city_code) ELSE
  public.buky_city_at(p_lat, p_lon) END AS here
  FROM public.users u
  WHERE u.id = auth.uid()), -- Premios de cada sorteo; los de alcance antiguo (ciudad/estado) solo si valen donde estoy o en mi ciudad
 prizes AS (SELECT k.period_id, jsonb_agg(public.buky_prize_json(k)
  ORDER BY k.discount_pct DESC NULLS LAST, (k.kind = 'physical') DESC, k.draw_order,
   k.title) AS list
  FROM public.buky_coupons k CROSS
  JOIN me
  WHERE k.scope IN ('raffle', 'national') OR (k.scope = 'city' AND k.city_code IN (me.here,
   me.profile_city)) OR (k.scope = 'state' AND k.state_code IN (SELECT c.state_code
  FROM public.br_cities c
  WHERE c.code IN (me.here, me.profile_city)))
  GROUP BY k.period_id), mine AS (SELECT e.period_id, sum(e.amount)::int AS bukys,
   jsonb_agg(e.ticket_code
  ORDER BY e.created_at) AS tickets
  FROM public.buky_entries e
  WHERE e.user_id = auth.uid()
  GROUP BY e.period_id), period_json AS (SELECT p.*, jsonb_build_object('id', p.id,
   'name', p.name, 'status', p.status, 'cadence', p.cadence, 'starts_at', p.starts_at,
   'ends_at', p.ends_at, 'draw_at', p.draw_at, 'drawn_at', p.drawn_at, 'national',
   p.city_codes IS NULL, 'cities', coalesce( (SELECT jsonb_agg(c.name
  ORDER BY c.name)
  FROM public.br_cities c
  WHERE c.code = ANY (p.city_codes)), '[]'::jsonb), 'available_here', public.buky_period_covers(p,
   me.here), 'participants', public.buky_period_participants(p.id), 'min_participants',
   p.min_participants, 'redeem_days', p.redeem_days, 'rules', jsonb_build_object('version',
   p.rules_version, 'text', coalesce(p.rules_text, public.buky_rules_placeholder()),
   'provisional', p.rules_text IS NULL, 'accepted', EXISTS (SELECT 1
  FROM public.buky_raffle_rule_acceptances a
  WHERE a.period_id = p.id AND a.user_id = auth.uid() AND a.version = p.rules_version)),
   'my_bukys', coalesce(m.bukys, 0), 'my_tickets', coalesce(m.tickets, '[]'::jsonb),
   'prizes', coalesce(pr.list, '[]'::jsonb)) AS j, public.buky_period_covers(p, me.here) AS here_ok,
   public.buky_period_covers(p, me.profile_city) AS home_ok, m.bukys AS my_bukys
  FROM public.buky_raffle_periods p CROSS
  JOIN me
  LEFT JOIN mine m ON m.period_id = p.id
  LEFT JOIN prizes pr ON pr.period_id = p.id) SELECT CASE WHEN auth.uid() IS NULL THEN
  NULL ELSE
  jsonb_build_object('here', (SELECT jsonb_build_object('code', c.code, 'name', c.name)
  FROM me
  JOIN public.br_cities c ON c.code = me.here), -- Abiertos (y cerrados esperando el sorteo): primero los que valen donde estoy
 'open', coalesce( (SELECT jsonb_agg(j
  ORDER BY here_ok DESC, home_ok DESC, ends_at)
  FROM period_json
  WHERE status IN ('open', 'closed') AND (here_ok OR home_ok OR my_bukys IS NOT NULL OR city_codes IS NULL)),
   '[]'::jsonb), 'upcoming', coalesce( (SELECT jsonb_agg(j
  ORDER BY starts_at)
  FROM (SELECT j, starts_at
  FROM period_json
  WHERE status = 'scheduled' AND (here_ok OR home_ok OR city_codes IS NULL)
  ORDER BY starts_at LIMIT 6) s), '[]'::jsonb), 'past', coalesce( (SELECT jsonb_agg(x.j
  ORDER BY x.ends_at DESC)
  FROM (SELECT pj.ends_at, pj.j || jsonb_build_object('my_wins', (SELECT count(*)
  FROM public.buky_raffle_results r
  WHERE r.period_id = pj.id AND r.user_id = auth.uid() AND r.role = 'winner'), 'results',
   coalesce( (SELECT jsonb_agg(jsonb_build_object('prize_id', z.id, 'title', z.title,
   'benefit', z.benefit, 'image_url', z.image_url, 'discount_pct', z.discount_pct,
   'sponsor', (SELECT sp.name
  FROM public.buky_sponsors sp
  WHERE sp.id = z.sponsor_id), 'winners', (SELECT count(*)
  FROM public.buky_raffle_results r
  WHERE r.coupon_id = z.id AND r.user_id IS NOT NULL AND r.role = 'winner'), 'cities',
   coalesce( (SELECT jsonb_agg(DISTINCT c.name)
  FROM public.buky_raffle_results r
  JOIN LATERAL (SELECT e.city_code
  FROM public.buky_entries e
  WHERE e.user_id = r.user_id AND e.period_id IN (SELECT q.id
  FROM public.buky_raffle_periods q
  WHERE q.id = r.period_id OR q.merged_into = r.period_id)
  ORDER BY e.created_at LIMIT 1) w ON true
  JOIN public.br_cities c ON c.code = w.city_code
  WHERE r.coupon_id = z.id AND r.user_id IS NOT NULL AND r.role = 'winner'), '[]'::jsonb),
   'mine', EXISTS (SELECT 1
  FROM public.buky_raffle_results r
  WHERE r.coupon_id = z.id AND r.user_id = auth.uid() AND r.role = 'winner'))
  ORDER BY z.discount_pct DESC NULLS LAST, (z.kind = 'physical') DESC, z.draw_order,
   z.title)
  FROM public.buky_coupons z
  JOIN public.buky_raffle_periods zp ON zp.id = z.period_id
  WHERE zp.id = pj.id OR zp.merged_into = pj.id), '[]'::jsonb)) AS j
  FROM period_json pj
  WHERE pj.status IN ('drawn', 'cancelled') AND (pj.my_bukys IS NOT NULL OR pj.home_ok OR pj.here_ok)
  ORDER BY pj.ends_at DESC LIMIT 12) x), '[]'::jsonb), 'my_prizes', coalesce( (SELECT jsonb_agg(public.buky_prize_json(k) || jsonb_build_object('result_id',
   r.id, 'period', p.name, 'ticket', r.winning_ticket, 'role', r.role, 'redeem_code',
   CASE WHEN r.delivery_status IN ('notified', 'pending', 'delivered') THEN
  r.redeem_code END, 'redeem_token', CASE WHEN r.delivery_status IN ('notified', 'pending',
   'delivered') THEN
  r.redeem_token END, 'kind', k.kind, 'redeemed_at', r.redeemed_at, 'redeem_deadline',
   r.redeem_deadline, 'delivery_status', r.delivery_status, 'drawn_at', r.drawn_at)
  ORDER BY (r.delivery_status IN ('notified', 'pending')) DESC, r.drawn_at DESC)
  FROM public.buky_raffle_results r
  JOIN public.buky_coupons k ON k.id = r.coupon_id
  JOIN public.buky_raffle_periods p ON p.id = r.period_id
  WHERE r.user_id = auth.uid()), '[]'::jsonb)) END $$ ;
-- La versión sin parámetros (app ya instalada) sigue funcionando sin ubicación
 CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$ DECLARE accepted boolean;
provider_name text;
BEGIN
  provider_name := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');
accepted := COALESCE((NEW.raw_user_meta_data ->> 'accepted_terms')::boolean, false);
IF provider_name = 'email' AND accepted IS NOT TRUE AND COALESCE(NEW.raw_app_meta_data ->> 'invited_photographer',
   'false') <> 'true' AND COALESCE(NEW.raw_app_meta_data ->> 'invited_sponsor', 'false') <> 'true' AND NOT EXISTS (SELECT 1
  FROM public.buky_sponsor_invites i
  WHERE i.email=lower(NEW.email) AND i.created_at > now()-interval '1 hour') AND NOT EXISTS (SELECT 1
  FROM public.photographers ph
  WHERE lower(ph.email) = lower(NEW.email) AND ph.auth_user_id IS NULL) THEN
  RAISE EXCEPTION 'Você deve aceitar os Termos e Condições para criar uma conta.';
  END IF;
IF provider_name <> 'email' THEN
  accepted := false;
  END IF;
INSERT INTO public.users (id, email, name, role, accepted_terms, accepted_terms_at,
   auth_provider)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'name', 'Corredor'),
   'USUARIO', accepted, CASE WHEN accepted THEN
  now() ELSE
  NULL END, provider_name);
RETURN NEW;
END;
$function$ ;
CREATE TABLE IF NOT EXISTS public.notification_outbox (id bigserial PRIMARY KEY, notification_id uuid REFERENCES public.notifications(id),
   user_id uuid REFERENCES public.users(id), to_email text, kind text NOT NULL, channel text NOT NULL CHECK(channel IN ('email',
   'push')), subject text, payload jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending',
   'sent', 'failed', 'skipped')), attempts integer NOT NULL DEFAULT 0, last_error text,
   provider_id text, dedupe_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
   sent_at timestamptz, claimed_at timestamptz);
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_outbox_admin ON public.notification_outbox;
CREATE POLICY notification_outbox_admin ON public.notification_outbox FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.notification_outbox
  FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1
  FROM pg_namespace
  WHERE nspname='vault') AND NOT EXISTS (SELECT 1
  FROM vault.decrypted_secrets
  WHERE name='buky_notify_dispatch') THEN
  PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'buky_notify_dispatch');
  END IF;
END $$ ;
CREATE OR REPLACE FUNCTION public.notify_dispatch_secret_ok(p text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE s text;
BEGIN
  SELECT decrypted_secret INTO s
  FROM vault.decrypted_secrets
  WHERE name='buky_notify_dispatch' LIMIT 1;
RETURN p IS NOT NULL AND s IS NOT NULL AND p=s;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$ ;
CREATE OR REPLACE FUNCTION public.notify_dispatch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE s text;
u text;
BEGIN
  UPDATE public.notification_outbox SET status='failed', last_error='claim_timeout',
   claimed_at=NULL
  WHERE status='pending' AND claimed_at < now()-interval '5 minutes' AND attempts >= coalesce( (SELECT (value #>> '{}')::int
  FROM public.app_settings
  WHERE key='notify_max_attempts'),5);
SELECT decrypted_secret INTO s
  FROM vault.decrypted_secrets
  WHERE name='buky_notify_dispatch' LIMIT 1;
SELECT value #>> '{}' INTO u
  FROM public.app_settings
  WHERE key='notify_dispatch_url';
IF s IS NOT NULL AND u IS NOT NULL THEN
  PERFORM net.http_post(url:=u,headers:=jsonb_build_object('Content-Type', 'application/json',
   'x-dispatch-secret', s),body:='{}'::jsonb);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$ ;
CREATE OR REPLACE FUNCTION public.notify_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE rid uuid;
admin_notice boolean;
BEGIN
  admin_notice:= NEW.type IN ('buky_raffle_review','buky_prize_unclaimed') AND EXISTS (SELECT 1
  FROM public.users
  WHERE id=NEW.user_id AND role='ADMIN');
IF NEW.type NOT IN ('buky_raffle_won','buky_raffle_substitute','premium_expiring') AND NOT admin_notice THEN
  RETURN NEW;
  END IF;
IF NEW.type='buky_raffle_substitute' THEN
  RETURN NEW;
  END IF;
IF NEW.type IN ('buky_raffle_won', 'buky_raffle_substitute') THEN
  -- Resultado activo más reciente que aún no tenga aviso (dos premios en la misma pasada no comparten aviso)
 SELECT r.id INTO rid
  FROM public.buky_raffle_results r
  WHERE r.user_id=NEW.user_id AND r.delivery_status IN ('pending','notified') AND NOT EXISTS (SELECT 1
  FROM public.notification_outbox o
  WHERE o.user_id=NEW.user_id AND o.payload->>'result_id'=r.id::text)
  ORDER BY coalesce(r.activated_at, r.drawn_at) DESC,r.ctid DESC LIMIT 1;
-- El paso 25 envía un aviso in-app a suplentes en espera; no es una activación.
 IF NEW.type='buky_raffle_substitute' AND rid IS NULL THEN
  RETURN NEW;
  END IF;
  END IF;
INSERT INTO public.notification_outbox(notification_id, user_id, kind, channel, subject,
   payload, dedupe_key)
  VALUES(NEW.id,NEW.user_id,NEW.type,'email',NEW.title, jsonb_build_object('message',
   NEW.message, 'result_id', rid),'notif:'||NEW.id||':email')
  ON CONFLICT(dedupe_key) DO NOTHING;
IF NEW.type IN ('buky_raffle_won', 'buky_raffle_substitute') THEN
  INSERT INTO public.notification_outbox(notification_id, user_id, kind, channel,
   subject, payload, dedupe_key)
  VALUES(NEW.id,NEW.user_id,NEW.type,'push',NEW.title, jsonb_build_object('message',
   NEW.message, 'result_id', rid),'notif:'||NEW.id||':push')
  ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
PERFORM public.notify_dispatch();
RETURN NEW;
END $$ ;
DROP TRIGGER IF EXISTS notify_enqueue ON public.notifications;
CREATE TRIGGER notify_enqueue AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_enqueue();
CREATE OR REPLACE FUNCTION public.notify_outbox_claim(p_limit int) RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ WITH chosen AS (SELECT o.id
  FROM public.notification_outbox o
  WHERE o.status='pending' AND (o.claimed_at IS NULL OR o.claimed_at<now()-interval '5 minutes') AND o.attempts < greatest(1,
   coalesce( (SELECT (value #>> '{}')::int
  FROM public.app_settings
  WHERE key='notify_max_attempts'),5))
  ORDER BY o.id FOR UPDATE SKIP LOCKED LIMIT greatest(0, least(coalesce(p_limit, 20),
   20))), claimed AS (UPDATE public.notification_outbox o SET attempts=o.attempts+1,
  claimed_at=now()
  FROM chosen c
  WHERE o.id=c.id
  RETURNING o.*) SELECT to_jsonb(c)||jsonb_build_object('email', coalesce(c.to_email,
   u.email), 'name', u.name, 'email_notifications', coalesce(u.email_notifications,
   true), 'prize', CASE WHEN r.id IS NULL THEN
  NULL ELSE
  jsonb_build_object('title', k.title, 'benefit', k.benefit, 'kind', k.kind, 'redeem_code',
   r.redeem_code, 'redeem_deadline', r.redeem_deadline, 'redeem_token', r.redeem_token,
   'sponsor', s.name) END)
  FROM claimed c
  LEFT JOIN public.users u ON u.id=c.user_id
  LEFT JOIN public.buky_raffle_results r ON r.id=(c.payload->>'result_id')::uuid
  LEFT JOIN public.buky_coupons k ON k.id=r.coupon_id
  LEFT JOIN public.buky_sponsors s ON s.id=k.sponsor_id $$ ;
CREATE OR REPLACE FUNCTION public.notify_outbox_mark(p_id bigint,p_status text,p_error text DEFAULT NULL,
   p_provider_id text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ DECLARE max_attempts int;
BEGIN
  IF p_status NOT IN ('sent','failed','skipped') THEN
  RAISE EXCEPTION 'invalid_status' USING ERRCODE='P0001';
  END IF;
SELECT coalesce((value #>> '{}')::int, 5) INTO max_attempts
  FROM public.app_settings
  WHERE key='notify_max_attempts';
UPDATE public.notification_outbox SET status=CASE WHEN p_status='failed' AND attempts<coalesce(max_attempts,
   5) THEN
  'pending' ELSE
  p_status END,last_error=p_error,provider_id=p_provider_id,claimed_at=NULL,sent_at=CASE WHEN p_status='sent' THEN
  now() ELSE
  sent_at END
  WHERE id=p_id AND status='pending';
END $$ ;
REVOKE ALL ON FUNCTION public.notify_dispatch_secret_ok(text),public.notify_outbox_claim(int),
   public.notify_outbox_mark(bigint,text,text,text),public.notify_dispatch()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_dispatch_secret_ok(text),public.notify_outbox_claim(int),
   public.notify_outbox_mark(bigint,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.buky_my_sponsors(),public.buky_sponsor_lookup(text),
  public.buky_sponsor_redeem(uuid,text), public.buky_sponsor_dashboard(uuid),public.admin_buky_sponsor_members(uuid),
   public.admin_buky_sponsor_revoke(uuid, uuid),public.admin_buky_redeem(uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buky_my_sponsors(),public.buky_sponsor_lookup(text),
  public.buky_sponsor_redeem(uuid,text), public.buky_sponsor_dashboard(uuid),public.admin_buky_sponsor_members(uuid),
   public.admin_buky_sponsor_revoke(uuid, uuid),public.admin_buky_redeem(uuid,text) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1
  FROM pg_extension
  WHERE extname='pg_cron') THEN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname='notify-outbox-retry';
PERFORM cron.schedule('notify-outbox-retry', '*/5 * * * *', 'SELECT public.notify_dispatch() WHERE EXISTS (SELECT 1 FROM public.notification_outbox WHERE status = ''pending'')');
  END IF;
END $$ ;
COMMIT;
