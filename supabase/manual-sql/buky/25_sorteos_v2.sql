-- Paso 25 · Sorteos v2 (decisiones del cliente, 8/11/2026).
--   · Varios sorteos abiertos a la vez (semanal, quincenal o mensual), cada uno para una ciudad o un
--     grupo de ciudades (city_codes; NULL = todo Brasil). El atleta ELIGE a cuál enviar y cuántos Bukys.
--   · Solo puede enviar a un sorteo de la ciudad donde ESTÁ en ese momento (posición del teléfono →
--     buky_city_at). Los testadores usan la ciudad del perfil (pruebas desde fuera de Brasil).
--   · Reglamento por sorteo: el atleta lo acepta antes de enviar y queda registrado (versión).
--     El texto lo prepara el abogado; mientras tanto la app muestra un texto provisorio.
--   · Premios con % de descuento; se sortean de mayor a menor %. Cada cupón: 1 ganador y 1 suplente
--     exclusivo. Nadie gana ni es suplente más de una vez en el mismo sorteo. Peso = Bukys enviados.
--   · Mínimo de participantes (30, configurable por sorteo): si no se llega, NO se sortea solo; se avisa
--     al admin, que decide sortear igual o unirlo con otro sorteo (nunca automático).
--   · Plazo de canje por sorteo (15 días por defecto). Vencido el ganador → pasa al suplente con un plazo
--     nuevo. Vencido el suplente → el admin lo lleva a otro sorteo (campaña nueva e independiente).
--   · Los Bukys enviados se consumen siempre (no pasan al siguiente sorteo).
-- Va después del 24 (usa buky_city_at). Idempotente.
BEGIN;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('buky_raffle_min_participants', '30', 'Mínimo de participantes por sorteo (valor inicial de cada sorteo nuevo)'),
  ('buky_redeem_days', '15', 'Días para canjear un premio (valor inicial de cada sorteo nuevo)')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- Sorteos (buky_raffle_periods)
-- ------------------------------------------------------------
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS city_codes integer[];
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS min_participants integer NOT NULL DEFAULT 30;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS redeem_days smallint NOT NULL DEFAULT 15;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS rules_text text;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS rules_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.buky_raffle_periods(id);

ALTER TABLE public.buky_raffle_periods DROP CONSTRAINT IF EXISTS buky_raffle_periods_cadence_check;
ALTER TABLE public.buky_raffle_periods ADD CONSTRAINT buky_raffle_periods_cadence_check
  CHECK (cadence IN ('weekly', 'biweekly', 'monthly', 'none'));
ALTER TABLE public.buky_raffle_periods DROP CONSTRAINT IF EXISTS buky_raffle_periods_status_check;
ALTER TABLE public.buky_raffle_periods ADD CONSTRAINT buky_raffle_periods_status_check
  CHECK (status IN ('scheduled', 'open', 'closed', 'drawn', 'cancelled', 'merged'));
ALTER TABLE public.buky_raffle_periods DROP CONSTRAINT IF EXISTS buky_periods_limits;
ALTER TABLE public.buky_raffle_periods ADD CONSTRAINT buky_periods_limits
  CHECK (min_participants BETWEEN 1 AND 100000 AND redeem_days BETWEEN 1 AND 365 AND rules_version >= 1
         AND (merged_into IS NULL OR merged_into <> id));
-- Varios sorteos abiertos a la vez
DROP INDEX IF EXISTS public.buky_periods_one_open;
CREATE INDEX IF NOT EXISTS buky_periods_cities_idx ON public.buky_raffle_periods USING gin (city_codes);

-- Sube la versión del reglamento cuando cambia el texto (hay que volver a aceptarlo)
CREATE OR REPLACE FUNCTION public.buky_periods_rules_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.rules_text IS DISTINCT FROM OLD.rules_text THEN
    NEW.rules_version := OLD.rules_version + 1;
  ELSE
    NEW.rules_version := OLD.rules_version;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS buky_periods_rules_version ON public.buky_raffle_periods;
CREATE TRIGGER buky_periods_rules_version BEFORE UPDATE ON public.buky_raffle_periods
  FOR EACH ROW EXECUTE FUNCTION public.buky_periods_rules_version();

-- Valores iniciales desde Configurações al crear un sorteo
CREATE OR REPLACE FUNCTION public.buky_periods_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.min_participants IS NULL OR NEW.min_participants = 30 THEN
    NEW.min_participants := public.buky_setting_num('buky_raffle_min_participants', 30);
  END IF;
  IF NEW.redeem_days IS NULL OR NEW.redeem_days = 15 THEN
    NEW.redeem_days := public.buky_setting_num('buky_redeem_days', 15);
  END IF;
  IF NEW.city_codes IS NOT NULL AND cardinality(NEW.city_codes) = 0 THEN
    NEW.city_codes := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS buky_periods_defaults ON public.buky_raffle_periods;
CREATE TRIGGER buky_periods_defaults BEFORE INSERT ON public.buky_raffle_periods
  FOR EACH ROW EXECUTE FUNCTION public.buky_periods_defaults();

-- ------------------------------------------------------------
-- Premios: % de descuento y alcance "todo el sorteo"
-- ------------------------------------------------------------
ALTER TABLE public.buky_coupons ADD COLUMN IF NOT EXISTS discount_pct smallint;
ALTER TABLE public.buky_coupons DROP CONSTRAINT IF EXISTS buky_coupons_discount_pct;
ALTER TABLE public.buky_coupons ADD CONSTRAINT buky_coupons_discount_pct CHECK (discount_pct IS NULL OR discount_pct BETWEEN 1 AND 100);
ALTER TABLE public.buky_coupons DROP CONSTRAINT IF EXISTS buky_coupons_scope_check;
ALTER TABLE public.buky_coupons ADD CONSTRAINT buky_coupons_scope_check CHECK (scope IN ('raffle', 'city', 'state', 'national'));
ALTER TABLE public.buky_coupons DROP CONSTRAINT IF EXISTS buky_coupons_physical_city;
ALTER TABLE public.buky_coupons ADD CONSTRAINT buky_coupons_physical_city CHECK (kind = 'digital' OR scope IN ('city', 'raffle'));
ALTER TABLE public.buky_coupons DROP CONSTRAINT IF EXISTS buky_coupons_scope_fields;
ALTER TABLE public.buky_coupons ADD CONSTRAINT buky_coupons_scope_fields CHECK (
  (scope = 'raffle' AND city_code IS NULL AND state_code IS NULL) OR
  (scope = 'city' AND city_code IS NOT NULL) OR
  (scope = 'state' AND state_code IS NOT NULL AND city_code IS NULL) OR
  (scope = 'national' AND city_code IS NULL AND state_code IS NULL));
ALTER TABLE public.buky_coupons ALTER COLUMN scope SET DEFAULT 'raffle';

-- Igual que el paso 17, sumando el % (no cambia con el sorteo abierto)
CREATE OR REPLACE FUNCTION public.buky_coupons_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.scope = 'city' THEN
    SELECT state_code INTO NEW.state_code FROM public.br_cities WHERE code = NEW.city_code;
  END IF;
  SELECT status INTO v_status FROM public.buky_raffle_periods WHERE id = NEW.period_id;
  IF TG_OP = 'INSERT' AND v_status <> 'scheduled' THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001',
      DETAIL = 'Los cupones se cargan antes de que empiece el periodo';
  END IF;
  IF TG_OP = 'UPDATE' AND v_status <> 'scheduled' AND (
       NEW.period_id IS DISTINCT FROM OLD.period_id OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.city_code IS DISTINCT FROM OLD.city_code
       OR NEW.state_code IS DISTINCT FROM OLD.state_code OR NEW.winners_count IS DISTINCT FROM OLD.winners_count
       OR NEW.draw_order IS DISTINCT FROM OLD.draw_order OR NEW.discount_pct IS DISTINCT FROM OLD.discount_pct) THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001',
      DETAIL = 'Con el periodo abierto solo se pueden corregir textos e imagen';
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Resultados: ganador y suplente, plazo de canje
-- ------------------------------------------------------------
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'winner';
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS redeem_deadline timestamptz;
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE public.buky_raffle_results ADD COLUMN IF NOT EXISTS republished_to uuid REFERENCES public.buky_raffle_periods(id);
ALTER TABLE public.buky_raffle_results DROP CONSTRAINT IF EXISTS buky_raffle_results_role_check;
ALTER TABLE public.buky_raffle_results ADD CONSTRAINT buky_raffle_results_role_check CHECK (role IN ('winner', 'substitute'));
ALTER TABLE public.buky_raffle_results DROP CONSTRAINT IF EXISTS buky_raffle_results_delivery_status_check;
ALTER TABLE public.buky_raffle_results ADD CONSTRAINT buky_raffle_results_delivery_status_check
  CHECK (delivery_status IN ('pending', 'notified', 'delivered', 'unclaimed', 'standby', 'expired'));
ALTER TABLE public.buky_raffle_results DROP CONSTRAINT IF EXISTS buky_raffle_results_coupon_id_rank_key;
DROP INDEX IF EXISTS public.buky_results_coupon_rank_role;
CREATE UNIQUE INDEX buky_results_coupon_rank_role ON public.buky_raffle_results (coupon_id, rank, role);

-- Solo cambian la entrega, el plazo, la activación del suplente y su código.
CREATE OR REPLACE FUNCTION public.buky_results_write_once()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_mutable text[] := ARRAY['delivery_status', 'delivery_note', 'delivered_at', 'redeem_deadline',
                            'activated_at', 'republished_to', 'redeem_code'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'buky_raffle_results es inmutable' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'buky_raffle_results es inmutable (solo cambia la entrega)' USING ERRCODE = '42501';
  END IF;
  IF OLD.redeem_code IS NOT NULL AND NEW.redeem_code IS DISTINCT FROM OLD.redeem_code THEN
    RAISE EXCEPTION 'redeem_code_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
GRANT UPDATE (delivery_status, delivery_note, delivered_at) ON public.buky_raffle_results TO authenticated;

-- ------------------------------------------------------------
-- Aceptación del reglamento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_raffle_rule_acceptances (
  period_id uuid NOT NULL REFERENCES public.buky_raffle_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_id, user_id, version)
);
ALTER TABLE public.buky_raffle_rule_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buky_rule_acc_select ON public.buky_raffle_rule_acceptances;
CREATE POLICY buky_rule_acc_select ON public.buky_raffle_rule_acceptances FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
REVOKE ALL ON public.buky_raffle_rule_acceptances FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.buky_raffle_rule_acceptances FROM authenticated;

-- Texto provisorio mientras el abogado no entrega el reglamento
CREATE OR REPLACE FUNCTION public.buky_rules_placeholder()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT 'Regulamento em elaboração (versão de teste). Ao participar você declara que os Bukys enviados '
      || 'são consumidos neste sorteio, ganhe ou não; que cada Buky enviado é uma chance; que cada pessoa pode '
      || 'ganhar no máximo um prêmio por sorteio; e que o prêmio deve ser resgatado dentro do prazo informado. '
      || 'O texto oficial será publicado pela 3buk antes dos sorteios com prêmios reais.'
$$;

-- ¿El sorteo vale para esta ciudad?
CREATE OR REPLACE FUNCTION public.buky_period_covers(p public.buky_raffle_periods, p_city integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT p_city IS NOT NULL AND (p.city_codes IS NULL OR p_city = ANY (p.city_codes))
$$;

-- Avisa a los admins (bandeja de notificaciones de 3BUK)
CREATE OR REPLACE FUNCTION public.buky_notify_admins(p_type text, p_title text, p_message text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT u.id, p_type, p_title, p_message FROM public.users u WHERE u.role = 'ADMIN'
$$;

-- ------------------------------------------------------------
-- Atleta: enviar Bukys a un sorteo elegido
-- ------------------------------------------------------------
-- La versión anterior (todo el saldo al único sorteo abierto) queda cerrada: pide actualizar la app.
CREATE OR REPLACE FUNCTION public.buky_send_to_raffle(p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RAISE EXCEPTION 'app_update_required' USING ERRCODE = 'P0001',
    DETAIL = 'Atualize o app para escolher o sorteio';
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_send_to_raffle_v2(
  p_period_id uuid, p_amount integer, p_lat double precision, p_lon double precision,
  p_rules_version integer, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_period public.buky_raffle_periods%ROWTYPE;
  v_city integer;
  v_state smallint;
  v_balance integer;
  v_existing public.buky_entries%ROWTYPE;
  v_move jsonb;
  v_ticket text;
  v_entry public.buky_entries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 8 AND 80 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  -- Reintento del mismo envío: devuelve el ticket ya creado
  SELECT e.* INTO v_existing FROM public.buky_entries e
  JOIN public.buky_ledger l ON l.id = e.ledger_id
  WHERE l.user_id = v_uid AND l.idempotency_key = 'raffle:' || p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ticket', v_existing.ticket_code, 'amount', v_existing.amount,
                              'period_id', v_existing.period_id, 'duplicate', true);
  END IF;

  SELECT * INTO v_period FROM public.buky_raffle_periods WHERE id = p_period_id;
  IF NOT FOUND OR v_period.status <> 'open' OR now() < v_period.starts_at OR now() >= v_period.ends_at THEN
    RAISE EXCEPTION 'period_not_open' USING ERRCODE = 'P0002';
  END IF;

  -- Ciudad donde está el atleta ahora (el testador usa la de su perfil)
  IF public.buky_is_route_tester() THEN
    v_city := coalesce(public.buky_city_at(p_lat, p_lon), (SELECT city_code FROM public.users WHERE id = v_uid));
  ELSE
    IF p_lat IS NULL OR p_lon IS NULL THEN
      RAISE EXCEPTION 'location_required' USING ERRCODE = 'P0001';
    END IF;
    v_city := public.buky_city_at(p_lat, p_lon);
  END IF;
  IF v_city IS NULL OR NOT public.buky_period_covers(v_period, v_city) THEN
    RAISE EXCEPTION 'outside_area' USING ERRCODE = 'P0001',
      DETAIL = 'Este sorteio não vale para a cidade onde você está agora';
  END IF;
  SELECT state_code INTO v_state FROM public.br_cities WHERE code = v_city;

  -- Reglamento: aceptar la versión vigente
  IF p_rules_version IS DISTINCT FROM v_period.rules_version THEN
    RAISE EXCEPTION 'rules_not_accepted' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.buky_raffle_rule_acceptances (period_id, user_id, version)
  VALUES (v_period.id, v_uid, v_period.rules_version) ON CONFLICT DO NOTHING;

  INSERT INTO public.buky_balances (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.buky_balances WHERE user_id = v_uid FOR UPDATE;
  IF v_balance < 1 THEN
    RAISE EXCEPTION 'no_bukys' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > v_balance THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  v_move := public.apply_buky_movement(v_uid, 'sent', -p_amount, 'raffle_period', v_period.id::text,
                                       'raffle:' || p_idempotency_key, v_period.name);
  LOOP
    v_ticket := 'BK-' || upper(encode(extensions.gen_random_bytes(4), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.buky_entries WHERE ticket_code = v_ticket);
  END LOOP;

  INSERT INTO public.buky_entries (period_id, user_id, amount, city_code, state_code, ticket_code, ledger_id)
  VALUES (v_period.id, v_uid, p_amount, v_city, v_state, v_ticket, (v_move ->> 'ledger_id')::bigint)
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object('ticket', v_entry.ticket_code, 'amount', v_entry.amount,
                            'period_id', v_period.id, 'period_name', v_period.name,
                            'ends_at', v_period.ends_at, 'balance', (v_move ->> 'balance')::integer,
                            'duplicate', false);
END;
$$;

-- Cupones para Início/Treino: los de los sorteos abiertos (o el próximo) que valen para la ciudad.
CREATE OR REPLACE FUNCTION public.buky_zone_coupons(p_city_code integer DEFAULT NULL)
RETURNS TABLE (coupon_id uuid, period_id uuid, period_name text, period_status text, ends_at timestamptz,
               title text, description text, benefit text, image_url text, kind text, scope text,
               winners_count smallint, valid_until date, sponsor_name text, sponsor_logo_url text,
               sponsor_instagram text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH me AS (
    SELECT c.code AS city_code, c.state_code
    FROM public.br_cities c
    WHERE c.code = coalesce(p_city_code, (SELECT u.city_code FROM public.users u WHERE u.id = auth.uid()))
  ), p AS (
    SELECT pp.* FROM public.buky_raffle_periods pp, me
    WHERE pp.status = 'open' AND public.buky_period_covers(pp, me.city_code)
    UNION ALL
    SELECT * FROM (
      SELECT pp.* FROM public.buky_raffle_periods pp, me
      WHERE pp.status = 'scheduled' AND public.buky_period_covers(pp, me.city_code)
        AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods o WHERE o.status = 'open' AND public.buky_period_covers(o, me.city_code))
      ORDER BY pp.starts_at LIMIT 1) nxt
  )
  SELECT k.id, p.id, p.name, p.status, p.ends_at, k.title, k.description, k.benefit, k.image_url,
         k.kind, k.scope, k.winners_count, k.valid_until, s.name, s.logo_url, s.instagram
  FROM p
  JOIN public.buky_coupons k ON k.period_id = p.id
  JOIN public.buky_sponsors s ON s.id = k.sponsor_id
  LEFT JOIN me ON true
  WHERE auth.uid() IS NOT NULL
    AND (k.scope IN ('raffle', 'national')
         OR (k.scope = 'state' AND k.state_code = me.state_code)
         OR (k.scope = 'city' AND k.city_code = me.city_code))
  ORDER BY k.discount_pct DESC NULLS LAST, k.kind DESC, k.draw_order, k.title
$$;

-- ------------------------------------------------------------
-- Sorteo: premios por % (mayor a menor), ganador + suplente, sorteos unidos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_pick_candidate(p_period_id uuid, k public.buky_coupons, p_exclude uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_candidates jsonb;
  v_total bigint;
  v_n bigint;
  v_user uuid;
BEGIN
  -- Pesos = Bukys enviados por cada atleta elegible en el sorteo (y en los unidos a él)
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'weight', weight) ORDER BY user_id), '[]'::jsonb),
         coalesce(sum(weight), 0)
    INTO v_candidates, v_total
  FROM (
    SELECT e.user_id, sum(e.amount)::bigint AS weight
    FROM public.buky_entries e
    JOIN public.buky_raffle_periods pe ON pe.id = e.period_id
    WHERE (pe.id = p_period_id OR pe.merged_into = p_period_id)
      AND (k.scope IN ('raffle', 'national')
           OR (k.scope = 'state' AND e.state_code = k.state_code)
           OR (k.scope = 'city' AND e.city_code = k.city_code))
      AND NOT (e.user_id = ANY (coalesce(p_exclude, '{}')))
      AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_results r WHERE r.period_id = p_period_id AND r.user_id = e.user_id)
    GROUP BY e.user_id
  ) c;
  IF v_total > 0 THEN
    v_n := public.buky_secure_random(v_total);
    v_user := public.buky_weighted_pick(v_candidates, v_n);
  END IF;
  RETURN jsonb_build_object('user_id', v_user, 'n', v_n, 'total', v_total, 'candidates', v_candidates);
END;
$$;

-- Toma un código libre del cupón (o NULL si no hay)
CREATE OR REPLACE FUNCTION public.buky_take_code(p_coupon_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_id uuid;
  v_code text;
BEGIN
  SELECT id, code INTO v_id, v_code FROM public.buky_coupon_codes
  WHERE coupon_id = p_coupon_id AND NOT assigned ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_id IS NOT NULL THEN
    UPDATE public.buky_coupon_codes SET assigned = true WHERE id = v_id;
  END IF;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_draw_period_internal(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_period public.buky_raffle_periods%ROWTYPE;
  k public.buky_coupons%ROWTYPE;
  v_rank integer;
  w jsonb;
  s jsonb;
  v_winner uuid;
  v_sub uuid;
  v_ticket text;
  v_results integer := 0;
  v_deadline timestamptz;
BEGIN
  SELECT * INTO v_period FROM public.buky_raffle_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status = 'drawn' THEN
    RETURN jsonb_build_object('status', 'drawn', 'duplicate', true);
  END IF;
  IF v_period.status NOT IN ('open', 'closed') OR now() < v_period.ends_at THEN
    RAISE EXCEPTION 'period_not_closed' USING ERRCODE = 'P0001';
  END IF;
  v_deadline := now() + make_interval(days => v_period.redeem_days);

  -- Premios del sorteo y de los unidos a él, de mayor a menor %
  FOR k IN SELECT c.* FROM public.buky_coupons c JOIN public.buky_raffle_periods pc ON pc.id = c.period_id
           WHERE pc.id = p_period_id OR pc.merged_into = p_period_id
           ORDER BY c.discount_pct DESC NULLS LAST, c.draw_order, c.created_at, c.id LOOP
    FOR v_rank IN 1 .. k.winners_count LOOP
      w := public.buky_pick_candidate(p_period_id, k, NULL);
      v_winner := (w ->> 'user_id')::uuid;
      SELECT ticket_code INTO v_ticket FROM public.buky_entries e
      JOIN public.buky_raffle_periods pe ON pe.id = e.period_id
      WHERE (pe.id = p_period_id OR pe.merged_into = p_period_id) AND e.user_id = v_winner
      ORDER BY e.created_at LIMIT 1;

      INSERT INTO public.buky_raffle_results (period_id, coupon_id, rank, role, user_id, winning_ticket, redeem_code,
                                              total_weight, winning_number, candidates, candidates_sha256,
                                              delivery_status, redeem_deadline, activated_at)
      VALUES (p_period_id, k.id, v_rank, 'winner', v_winner, v_ticket,
              CASE WHEN v_winner IS NOT NULL THEN public.buky_take_code(k.id) END,
              (w ->> 'total')::bigint, (w ->> 'n')::bigint, w -> 'candidates',
              encode(extensions.digest((w -> 'candidates')::text, 'sha256'), 'hex'),
              CASE WHEN v_winner IS NULL THEN 'unclaimed' ELSE 'notified' END,
              CASE WHEN v_winner IS NOT NULL THEN v_deadline END,
              CASE WHEN v_winner IS NOT NULL THEN now() END);
      v_results := v_results + 1;
      EXIT WHEN v_winner IS NULL;  -- sin más candidatos para este cupón

      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (v_winner, 'buky_raffle_won', 'Você ganhou no sorteio Buky! 🎉',
              format('Seu ticket %s ganhou "%s". Resgate até %s na tela Sorteios.', v_ticket, k.title,
                     to_char(v_deadline AT TIME ZONE public.buky_tz(), 'DD/MM HH24:MI')));

      -- Suplente exclusivo de este cupón (no puede ser el ganador ni tener otro papel en el sorteo)
      s := public.buky_pick_candidate(p_period_id, k, ARRAY[v_winner]);
      v_sub := (s ->> 'user_id')::uuid;
      IF v_sub IS NOT NULL THEN
        SELECT ticket_code INTO v_ticket FROM public.buky_entries e
        JOIN public.buky_raffle_periods pe ON pe.id = e.period_id
        WHERE (pe.id = p_period_id OR pe.merged_into = p_period_id) AND e.user_id = v_sub
        ORDER BY e.created_at LIMIT 1;
        INSERT INTO public.buky_raffle_results (period_id, coupon_id, rank, role, user_id, winning_ticket,
                                                total_weight, winning_number, candidates, candidates_sha256, delivery_status)
        VALUES (p_period_id, k.id, v_rank, 'substitute', v_sub, v_ticket, (s ->> 'total')::bigint, (s ->> 'n')::bigint,
                s -> 'candidates', encode(extensions.digest((s -> 'candidates')::text, 'sha256'), 'hex'), 'standby');
        v_results := v_results + 1;
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (v_sub, 'buky_raffle_substitute', 'Você é suplente no sorteio Buky',
                format('Se o ganhador de "%s" não resgatar no prazo, o prêmio passa para você.', k.title));
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.buky_raffle_periods SET status = 'drawn', drawn_at = now(), needs_review = false WHERE id = p_period_id;
  UPDATE public.buky_raffle_periods SET drawn_at = now() WHERE merged_into = p_period_id;
  RETURN jsonb_build_object('status', 'drawn', 'results', v_results, 'duplicate', false);
END;
$$;

-- Participantes distintos de un sorteo (con los unidos a él)
CREATE OR REPLACE FUNCTION public.buky_period_participants(p_period_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT count(DISTINCT e.user_id)::integer
  FROM public.buky_entries e JOIN public.buky_raffle_periods p ON p.id = e.period_id
  WHERE p.id = p_period_id OR p.merged_into = p_period_id
$$;

-- Admin: unir un sorteo con pocos participantes a otro (los participantes y premios del primero
-- se sortean junto con el segundo). Nunca es automático.
CREATE OR REPLACE FUNCTION public.admin_buky_merge_period(p_source uuid, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_src public.buky_raffle_periods%ROWTYPE;
  v_dst public.buky_raffle_periods%ROWTYPE;
BEGIN
  IF NOT public.buky_is_privileged() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_source = p_target THEN
    RAISE EXCEPTION 'same_period' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_src FROM public.buky_raffle_periods WHERE id = p_source FOR UPDATE;
  SELECT * INTO v_dst FROM public.buky_raffle_periods WHERE id = p_target FOR UPDATE;
  IF v_src.id IS NULL OR v_dst.id IS NULL THEN
    RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_src.status NOT IN ('open', 'closed') OR v_dst.status NOT IN ('scheduled', 'open', 'closed') OR v_dst.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'period_not_mergeable' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE merged_into = p_source) THEN
    RAISE EXCEPTION 'period_not_mergeable' USING ERRCODE = 'P0001', DETAIL = 'Otro sorteo ya está unido a este';
  END IF;
  UPDATE public.buky_raffle_periods
  SET status = 'merged', merged_into = p_target, needs_review = false,
      review_note = format('Unido a "%s" el %s', v_dst.name, to_char(now() AT TIME ZONE public.buky_tz(), 'DD/MM HH24:MI'))
  WHERE id = p_source;
  UPDATE public.buky_raffle_periods
  SET city_codes = CASE WHEN v_dst.city_codes IS NULL OR v_src.city_codes IS NULL THEN NULL
                        ELSE (SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(v_dst.city_codes || v_src.city_codes) c) END,
      needs_review = false
  WHERE id = p_target;
  RETURN jsonb_build_object('merged', true, 'participants', public.buky_period_participants(p_target));
END;
$$;

-- Admin: llevar un premio no canjeado (ganador y suplente vencidos) a otro sorteo programado.
CREATE OR REPLACE FUNCTION public.admin_buky_republish_prize(p_result_id uuid, p_target uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r public.buky_raffle_results%ROWTYPE;
  k public.buky_coupons%ROWTYPE;
  v_new uuid;
BEGIN
  IF NOT public.buky_is_privileged() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.buky_raffle_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'result_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF r.republished_to IS NOT NULL THEN
    RAISE EXCEPTION 'already_republished' USING ERRCODE = 'P0001';
  END IF;
  IF r.delivery_status NOT IN ('expired', 'unclaimed') OR EXISTS (
       SELECT 1 FROM public.buky_raffle_results o
       WHERE o.coupon_id = r.coupon_id AND o.rank = r.rank AND o.delivery_status IN ('notified', 'pending', 'delivered', 'standby')) THEN
    RAISE EXCEPTION 'prize_still_active' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO k FROM public.buky_coupons WHERE id = r.coupon_id;
  INSERT INTO public.buky_coupons (period_id, sponsor_id, title, description, benefit, image_url, kind, scope,
                                   city_code, state_code, winners_count, draw_order, redeem_instructions,
                                   valid_until, repeat_next, discount_pct)
  VALUES (p_target, k.sponsor_id, k.title, k.description, k.benefit, k.image_url, k.kind,
          CASE WHEN k.scope = 'national' THEN 'raffle' ELSE k.scope END, k.city_code, k.state_code, 1, k.draw_order,
          k.redeem_instructions, NULL, false, k.discount_pct)
  RETURNING id INTO v_new;  -- el trigger exige que el sorteo destino esté programado
  UPDATE public.buky_raffle_results SET republished_to = p_target WHERE coupon_id = r.coupon_id AND rank = r.rank;
  RETURN v_new;
END;
$$;

-- ------------------------------------------------------------
-- Reloj de los sorteos (pg_cron cada 5 minutos)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_raffle_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.buky_raffle_periods%ROWTYPE;
  r public.buky_raffle_results%ROWTYPE;
  v_sub public.buky_raffle_results%ROWTYPE;
  v_next uuid;
  v_len interval;
  v_opened integer := 0;
  v_closed integer := 0;
  v_drawn integer := 0;
  v_created integer := 0;
  v_review integer := 0;
  v_expired integer := 0;
  v_parts integer;
  v_code text;
  v_days integer;
BEGIN
  IF NOT public.buky_is_privileged() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 1) Cerrar los vencidos y crear el siguiente de la misma serie (cadencia + ciudades)
  FOR p IN SELECT * FROM public.buky_raffle_periods WHERE status = 'open' AND ends_at <= now() FOR UPDATE LOOP
    UPDATE public.buky_raffle_periods SET status = 'closed' WHERE id = p.id;
    v_closed := v_closed + 1;
    IF p.cadence <> 'none' AND NOT EXISTS (
         SELECT 1 FROM public.buky_raffle_periods q
         WHERE q.starts_at >= p.ends_at AND q.status <> 'cancelled' AND q.cadence = p.cadence
           AND q.city_codes IS NOT DISTINCT FROM p.city_codes) THEN
      v_len := CASE p.cadence WHEN 'weekly' THEN interval '7 days' WHEN 'biweekly' THEN interval '14 days' ELSE interval '1 month' END;
      INSERT INTO public.buky_raffle_periods (name, starts_at, ends_at, draw_at, cadence, city_codes, min_participants,
                                              redeem_days, rules_text)
      VALUES (CASE p.cadence WHEN 'weekly' THEN 'Sorteio semanal ' WHEN 'biweekly' THEN 'Sorteio quinzenal ' ELSE 'Sorteio mensal ' END
                || to_char(p.ends_at AT TIME ZONE public.buky_tz(), 'DD/MM'),
              p.ends_at, p.ends_at + v_len, p.ends_at + v_len + (p.draw_at - p.ends_at), p.cadence, p.city_codes,
              p.min_participants, p.redeem_days, p.rules_text)
      RETURNING id INTO v_next;
      UPDATE public.buky_raffle_periods SET min_participants = p.min_participants, redeem_days = p.redeem_days WHERE id = v_next;
      INSERT INTO public.buky_coupons (period_id, sponsor_id, title, description, benefit, image_url, kind, scope,
                                       city_code, state_code, winners_count, draw_order, redeem_instructions,
                                       valid_until, repeat_next, discount_pct)
      SELECT v_next, sponsor_id, title, description, benefit, image_url, kind, scope, city_code, state_code,
             winners_count, draw_order, redeem_instructions, NULL, true, discount_pct
      FROM public.buky_coupons WHERE period_id = p.id AND repeat_next;
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- 2) Abrir todos los programados que ya empezaron
  UPDATE public.buky_raffle_periods SET status = 'open'
  WHERE status = 'scheduled' AND starts_at <= now() AND ends_at > now();
  GET DIAGNOSTICS v_opened = ROW_COUNT;

  -- 3) Sortear los cerrados cuya hora llegó, si alcanzan el mínimo; si no, avisar al admin
  FOR p IN SELECT * FROM public.buky_raffle_periods
           WHERE status = 'closed' AND draw_at <= now() AND NOT needs_review ORDER BY ends_at LOOP
    v_parts := public.buky_period_participants(p.id);
    IF v_parts < p.min_participants THEN
      UPDATE public.buky_raffle_periods
      SET needs_review = true, review_note = format('%s de %s participantes mínimos', v_parts, p.min_participants)
      WHERE id = p.id;
      PERFORM public.buky_notify_admins('buky_raffle_review', 'Sorteio Buky sem o mínimo de participantes',
        format('"%s" fechou com %s participantes (mínimo %s). Decida no painel: sortear mesmo assim ou unir com outro sorteio.',
               p.name, v_parts, p.min_participants));
      v_review := v_review + 1;
    ELSE
      PERFORM public.buky_draw_period_internal(p.id);
      v_drawn := v_drawn + 1;
    END IF;
  END LOOP;

  -- 4) Plazos de canje: el ganador vencido pasa al suplente; el suplente vencido queda para el admin
  FOR r IN SELECT * FROM public.buky_raffle_results
           WHERE delivery_status IN ('notified', 'pending') AND redeem_deadline IS NOT NULL AND redeem_deadline <= now()
           ORDER BY drawn_at FOR UPDATE LOOP
    UPDATE public.buky_raffle_results SET delivery_status = 'expired' WHERE id = r.id;
    v_expired := v_expired + 1;
    IF r.role = 'winner' THEN
      SELECT redeem_days INTO v_days FROM public.buky_raffle_periods WHERE id = r.period_id;
      v_code := coalesce(public.buky_take_code(r.coupon_id), r.redeem_code);
      UPDATE public.buky_raffle_results
      SET delivery_status = 'notified', activated_at = now(),
          redeem_deadline = now() + make_interval(days => coalesce(v_days, 15)), redeem_code = v_code
      WHERE coupon_id = r.coupon_id AND rank = r.rank AND role = 'substitute' AND delivery_status = 'standby'
      RETURNING * INTO v_sub;
      IF FOUND THEN
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (v_sub.user_id, 'buky_raffle_won', 'O prêmio do sorteio Buky passou para você! 🎉',
                format('Você era suplente e agora o prêmio é seu. Resgate até %s na tela Sorteios.',
                       to_char(v_sub.redeem_deadline AT TIME ZONE public.buky_tz(), 'DD/MM HH24:MI')));
      ELSE
        PERFORM public.buky_notify_admins('buky_prize_unclaimed', 'Prêmio Buky sem resgate',
          'Um prêmio venceu sem suplente. Leve-o para outro sorteio no painel.');
      END IF;
    ELSE
      PERFORM public.buky_notify_admins('buky_prize_unclaimed', 'Prêmio Buky sem resgate',
        'Ganhador e suplente não resgataram um prêmio. Leve-o para outro sorteio no painel.');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('opened', v_opened, 'closed', v_closed, 'created', v_created, 'drawn', v_drawn,
                            'review', v_review, 'expired', v_expired);
END;
$$;

-- ------------------------------------------------------------
-- Pantalla Sorteios del atleta (paso 20, versión con varios sorteos)
-- p_lat/p_lon: dónde está ahora (para saber a qué sorteos puede enviar).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_prize_json(k public.buky_coupons)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', k.id, 'title', k.title, 'description', k.description, 'benefit', k.benefit,
    'image_url', k.image_url, 'kind', k.kind, 'scope', k.scope, 'discount_pct', k.discount_pct,
    'city', (SELECT c.name FROM public.br_cities c WHERE c.code = k.city_code),
    'uf', (SELECT s.uf FROM public.br_states s WHERE s.code = k.state_code),
    'winners_count', k.winners_count, 'valid_until', k.valid_until,
    'redeem_instructions', k.redeem_instructions,
    'sponsor', jsonb_build_object('name', sp.name, 'logo_url', sp.logo_url, 'instagram', sp.instagram, 'website', sp.website))
  FROM public.buky_sponsors sp WHERE sp.id = k.sponsor_id
$$;

DROP FUNCTION IF EXISTS public.buky_my_raffles(double precision, double precision);
CREATE FUNCTION public.buky_my_raffles(p_lat double precision, p_lon double precision)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH me AS (
    SELECT u.id, u.city_code AS profile_city,
           CASE WHEN public.buky_is_route_tester()
                THEN coalesce(public.buky_city_at(p_lat, p_lon), u.city_code)
                ELSE public.buky_city_at(p_lat, p_lon) END AS here
    FROM public.users u WHERE u.id = auth.uid()
  ),
  -- Premios de cada sorteo; los de alcance antiguo (ciudad/estado) solo si valen donde estoy o en mi ciudad
  prizes AS (
    SELECT k.period_id,
           jsonb_agg(public.buky_prize_json(k) ORDER BY k.discount_pct DESC NULLS LAST, (k.kind = 'physical') DESC, k.draw_order, k.title) AS list
    FROM public.buky_coupons k CROSS JOIN me
    WHERE k.scope IN ('raffle', 'national')
       OR (k.scope = 'city' AND k.city_code IN (me.here, me.profile_city))
       OR (k.scope = 'state' AND k.state_code IN (SELECT c.state_code FROM public.br_cities c WHERE c.code IN (me.here, me.profile_city)))
    GROUP BY k.period_id
  ),
  mine AS (
    SELECT e.period_id, sum(e.amount)::int AS bukys, jsonb_agg(e.ticket_code ORDER BY e.created_at) AS tickets
    FROM public.buky_entries e WHERE e.user_id = auth.uid() GROUP BY e.period_id
  ),
  period_json AS (
    SELECT p.*, jsonb_build_object(
      'id', p.id, 'name', p.name, 'status', p.status, 'cadence', p.cadence,
      'starts_at', p.starts_at, 'ends_at', p.ends_at, 'draw_at', p.draw_at, 'drawn_at', p.drawn_at,
      'national', p.city_codes IS NULL,
      'cities', coalesce((SELECT jsonb_agg(c.name ORDER BY c.name) FROM public.br_cities c WHERE c.code = ANY (p.city_codes)), '[]'::jsonb),
      'available_here', public.buky_period_covers(p, me.here),
      'participants', public.buky_period_participants(p.id),
      'min_participants', p.min_participants,
      'redeem_days', p.redeem_days,
      'rules', jsonb_build_object('version', p.rules_version,
                                  'text', coalesce(p.rules_text, public.buky_rules_placeholder()),
                                  'provisional', p.rules_text IS NULL,
                                  'accepted', EXISTS (SELECT 1 FROM public.buky_raffle_rule_acceptances a
                                                      WHERE a.period_id = p.id AND a.user_id = auth.uid() AND a.version = p.rules_version)),
      'my_bukys', coalesce(m.bukys, 0), 'my_tickets', coalesce(m.tickets, '[]'::jsonb),
      'prizes', coalesce(pr.list, '[]'::jsonb)) AS j,
      public.buky_period_covers(p, me.here) AS here_ok,
      public.buky_period_covers(p, me.profile_city) AS home_ok,
      m.bukys AS my_bukys
    FROM public.buky_raffle_periods p
    CROSS JOIN me
    LEFT JOIN mine m ON m.period_id = p.id
    LEFT JOIN prizes pr ON pr.period_id = p.id
  )
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'here', (SELECT jsonb_build_object('code', c.code, 'name', c.name) FROM me JOIN public.br_cities c ON c.code = me.here),
    -- Abiertos (y cerrados esperando el sorteo): primero los que valen donde estoy
    'open', coalesce((SELECT jsonb_agg(j ORDER BY here_ok DESC, home_ok DESC, ends_at) FROM period_json
                      WHERE status IN ('open', 'closed')
                        AND (here_ok OR home_ok OR my_bukys IS NOT NULL OR city_codes IS NULL)), '[]'::jsonb),
    'upcoming', coalesce((SELECT jsonb_agg(j ORDER BY starts_at) FROM (
        SELECT j, starts_at FROM period_json WHERE status = 'scheduled' AND (here_ok OR home_ok OR city_codes IS NULL)
        ORDER BY starts_at LIMIT 6) s), '[]'::jsonb),
    'past', coalesce((SELECT jsonb_agg(x.j ORDER BY x.ends_at DESC) FROM (
        SELECT pj.ends_at, pj.j
          || jsonb_build_object(
               'my_wins', (SELECT count(*) FROM public.buky_raffle_results r
                           WHERE r.period_id = pj.id AND r.user_id = auth.uid() AND r.role = 'winner'),
               'results', coalesce((
                 SELECT jsonb_agg(jsonb_build_object(
                          'prize_id', z.id, 'title', z.title, 'benefit', z.benefit, 'image_url', z.image_url,
                          'discount_pct', z.discount_pct,
                          'sponsor', (SELECT sp.name FROM public.buky_sponsors sp WHERE sp.id = z.sponsor_id),
                          'winners', (SELECT count(*) FROM public.buky_raffle_results r
                                      WHERE r.coupon_id = z.id AND r.user_id IS NOT NULL AND r.role = 'winner'),
                          'cities', coalesce((
                             SELECT jsonb_agg(DISTINCT c.name)
                             FROM public.buky_raffle_results r
                             JOIN LATERAL (SELECT e.city_code FROM public.buky_entries e
                                           WHERE e.user_id = r.user_id AND e.period_id IN (
                                             SELECT q.id FROM public.buky_raffle_periods q WHERE q.id = r.period_id OR q.merged_into = r.period_id)
                                           ORDER BY e.created_at LIMIT 1) w ON true
                             JOIN public.br_cities c ON c.code = w.city_code
                             WHERE r.coupon_id = z.id AND r.user_id IS NOT NULL AND r.role = 'winner'), '[]'::jsonb),
                          'mine', EXISTS (SELECT 1 FROM public.buky_raffle_results r
                                          WHERE r.coupon_id = z.id AND r.user_id = auth.uid() AND r.role = 'winner'))
                        ORDER BY z.discount_pct DESC NULLS LAST, (z.kind = 'physical') DESC, z.draw_order, z.title)
                 FROM public.buky_coupons z JOIN public.buky_raffle_periods zp ON zp.id = z.period_id
                 WHERE zp.id = pj.id OR zp.merged_into = pj.id), '[]'::jsonb)) AS j
        FROM period_json pj
        WHERE pj.status IN ('drawn', 'cancelled') AND (pj.my_bukys IS NOT NULL OR pj.home_ok OR pj.here_ok)
        ORDER BY pj.ends_at DESC LIMIT 12) x), '[]'::jsonb),
    'my_prizes', coalesce((
      SELECT jsonb_agg(public.buky_prize_json(k) || jsonb_build_object(
               'result_id', r.id, 'period', p.name, 'ticket', r.winning_ticket, 'role', r.role,
               'redeem_code', CASE WHEN r.delivery_status IN ('notified', 'pending', 'delivered') THEN r.redeem_code END,
               'redeem_deadline', r.redeem_deadline, 'delivery_status', r.delivery_status, 'drawn_at', r.drawn_at)
             ORDER BY (r.delivery_status IN ('notified', 'pending')) DESC, r.drawn_at DESC)
      FROM public.buky_raffle_results r
      JOIN public.buky_coupons k ON k.id = r.coupon_id
      JOIN public.buky_raffle_periods p ON p.id = r.period_id
      WHERE r.user_id = auth.uid()), '[]'::jsonb)
  ) END
$$;

-- La versión sin parámetros (app ya instalada) sigue funcionando sin ubicación
CREATE OR REPLACE FUNCTION public.buky_my_raffles()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.buky_my_raffles(NULL::double precision, NULL::double precision)
$$;

-- ------------------------------------------------------------
-- Permisos
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buky_period_covers(public.buky_raffle_periods, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_notify_admins(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_send_to_raffle_v2(uuid, integer, double precision, double precision, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_pick_candidate(uuid, public.buky_coupons, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_take_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_period_participants(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_merge_period(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_republish_prize(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_my_raffles(double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_rules_placeholder() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.buky_period_covers(public.buky_raffle_periods, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buky_send_to_raffle_v2(uuid, integer, double precision, double precision, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_period_participants(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_buky_merge_period(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_buky_republish_prize(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buky_my_raffles(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_rules_placeholder() TO authenticated;

COMMIT;
