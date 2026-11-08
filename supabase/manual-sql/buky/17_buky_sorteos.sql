-- ============================================================
-- 3BUK · Buky · PASO 17 — Patrocinadores, cupones, periodos de sorteo y ganadores
-- Correr en el SQL Editor de Supabase DESPUÉS del paso 16. Es idempotente.
--
-- Reglas (decisiones del cliente, 3 de noviembre de 2026):
--   · Un solo botón "Enviar Bukys ao sorteio": se envía TODO el saldo al periodo abierto;
--     cada Buky es una opción; el atleta no elige cupón ni reparte.
--   · Cupones físicos: solo entre atletas de una ciudad. Digitales: nacionales, o limitados a un
--     estado o una ciudad. El admin los configura ANTES de que empiece el periodo.
--   · Por defecto 1 ganador por cupón (configurable); personas distintas en un mismo periodo.
--   · Periodos semanales al inicio y mensuales después; el siguiente se crea solo.
-- Supuestos por confirmar con el cliente (fáciles de cambiar):
--   · Los Bukys enviados cuentan a la vez en TODOS los cupones de la zona del atleta.
--   · Los Bukys enviados valen solo para ese periodo (el siguiente empieza de cero).
--   · La zona del atleta es la ciudad de su perfil en el momento del envío.
-- ============================================================

BEGIN;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('buky_raffle_draw_delay_min', '60', 'Minutos entre el cierre de un periodo y el sorteo automático')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- Patrocinadores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  logo_url text,
  instagram text CHECK (instagram IS NULL OR instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  website text,
  city_code integer REFERENCES public.br_cities(code),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Periodos de sorteo (uno abierto a la vez)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_raffle_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  draw_at timestamptz NOT NULL,
  cadence text NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly', 'monthly', 'none')),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'closed', 'drawn', 'cancelled')),
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buky_periods_dates CHECK (starts_at < ends_at AND draw_at >= ends_at)
);
-- Uno abierto a la vez (hasta el paso 25, que permite varios: al re-ejecutar no se vuelve a crear)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'buky_raffle_periods' AND column_name = 'city_codes') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS buky_periods_one_open ON public.buky_raffle_periods ((true)) WHERE status = 'open';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS buky_periods_status_idx ON public.buky_raffle_periods (status, starts_at);

-- ------------------------------------------------------------
-- Cupones de un periodo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.buky_raffle_periods(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.buky_sponsors(id),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 80),
  description text,
  benefit text,                               -- p. ej. "20% de desconto"
  image_url text,
  kind text NOT NULL CHECK (kind IN ('physical', 'digital')),
  scope text NOT NULL CHECK (scope IN ('city', 'state', 'national')),
  city_code integer REFERENCES public.br_cities(code),
  state_code smallint REFERENCES public.br_states(code),
  winners_count smallint NOT NULL DEFAULT 1 CHECK (winners_count BETWEEN 1 AND 50),
  draw_order smallint NOT NULL DEFAULT 100,
  redeem_instructions text,
  valid_until date,
  repeat_next boolean NOT NULL DEFAULT false,  -- copiarlo al periodo siguiente automático
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buky_coupons_physical_city CHECK (kind = 'digital' OR scope = 'city'),
  CONSTRAINT buky_coupons_scope_fields CHECK (
    (scope = 'city' AND city_code IS NOT NULL) OR
    (scope = 'state' AND state_code IS NOT NULL AND city_code IS NULL) OR
    (scope = 'national' AND city_code IS NULL AND state_code IS NULL))
);
CREATE INDEX IF NOT EXISTS buky_coupons_period_idx ON public.buky_coupons (period_id);

-- Códigos de canje (solo admin; al ganador se le copia el suyo en el resultado)
CREATE TABLE IF NOT EXISTS public.buky_coupon_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.buky_coupons(id) ON DELETE CASCADE,
  code text NOT NULL,
  assigned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, code)
);

-- Completa estado y ciudad del cupón para que el alcance quede coherente.
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
  -- Los cupones se configuran antes de empezar: una vez abierto el periodo no cambian las reglas.
  SELECT status INTO v_status FROM public.buky_raffle_periods WHERE id = NEW.period_id;
  IF TG_OP = 'INSERT' AND v_status <> 'scheduled' THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001',
      DETAIL = 'Los cupones se cargan antes de que empiece el periodo';
  END IF;
  IF TG_OP = 'UPDATE' AND v_status <> 'scheduled' AND (
       NEW.period_id IS DISTINCT FROM OLD.period_id OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.city_code IS DISTINCT FROM OLD.city_code
       OR NEW.state_code IS DISTINCT FROM OLD.state_code OR NEW.winners_count IS DISTINCT FROM OLD.winners_count
       OR NEW.draw_order IS DISTINCT FROM OLD.draw_order) THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001',
      DETAIL = 'Con el periodo abierto solo se pueden corregir textos e imagen';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS buky_coupons_normalize ON public.buky_coupons;
CREATE TRIGGER buky_coupons_normalize BEFORE INSERT OR UPDATE ON public.buky_coupons
  FOR EACH ROW EXECUTE FUNCTION public.buky_coupons_normalize();

CREATE OR REPLACE FUNCTION public.buky_coupons_block_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF (SELECT status FROM public.buky_raffle_periods WHERE id = OLD.period_id) NOT IN ('scheduled', 'cancelled') THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS buky_coupons_block_delete ON public.buky_coupons;
CREATE TRIGGER buky_coupons_block_delete BEFORE DELETE ON public.buky_coupons
  FOR EACH ROW EXECUTE FUNCTION public.buky_coupons_block_delete();

-- ------------------------------------------------------------
-- Participaciones (envíos) e historial de ganadores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buky_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.buky_raffle_periods(id),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),       -- Bukys enviados = opciones
  city_code integer NOT NULL REFERENCES public.br_cities(code),   -- zona en el momento del envío
  state_code smallint NOT NULL REFERENCES public.br_states(code),
  ticket_code text NOT NULL UNIQUE,
  ledger_id bigint REFERENCES public.buky_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buky_entries_period_idx ON public.buky_entries (period_id, user_id);
CREATE INDEX IF NOT EXISTS buky_entries_user_idx ON public.buky_entries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.buky_raffle_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.buky_raffle_periods(id),
  coupon_id uuid NOT NULL REFERENCES public.buky_coupons(id),
  rank smallint NOT NULL,                       -- 1..winners_count
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,  -- NULL: sin participantes elegibles
  winning_ticket text,
  redeem_code text,
  total_weight bigint NOT NULL,
  winning_number bigint,                        -- número al azar en [0, total_weight)
  candidates jsonb NOT NULL,                    -- [{user_id, weight}] en el orden usado (auditoría)
  candidates_sha256 text NOT NULL,
  method text NOT NULL DEFAULT 'pgcrypto.gen_random_bytes; muestreo por rechazo; acumulado por user_id ascendente',
  drawn_at timestamptz NOT NULL DEFAULT now(),
  -- Seguimiento de la entrega (lo único editable después)
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'notified', 'delivered', 'unclaimed')),
  delivery_note text,
  delivered_at timestamptz,
  UNIQUE (coupon_id, rank)
);
CREATE INDEX IF NOT EXISTS buky_results_user_idx ON public.buky_raffle_results (user_id);
-- Personas distintas dentro de un mismo periodo
CREATE UNIQUE INDEX IF NOT EXISTS buky_results_unique_winner ON public.buky_raffle_results (period_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.buky_results_write_once()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'buky_raffle_results es inmutable' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['delivery_status', 'delivery_note', 'delivered_at'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['delivery_status', 'delivery_note', 'delivered_at']) THEN
    RAISE EXCEPTION 'buky_raffle_results es inmutable (solo cambia la entrega)' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS buky_results_write_once ON public.buky_raffle_results;
CREATE TRIGGER buky_results_write_once BEFORE UPDATE OR DELETE ON public.buky_raffle_results
  FOR EACH ROW EXECUTE FUNCTION public.buky_results_write_once();

CREATE OR REPLACE FUNCTION public.buky_entries_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RAISE EXCEPTION 'buky_entries es inmutable' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS buky_entries_immutable ON public.buky_entries;
CREATE TRIGGER buky_entries_immutable BEFORE UPDATE OR DELETE ON public.buky_entries
  FOR EACH ROW EXECUTE FUNCTION public.buky_entries_block_mutation();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.buky_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_raffle_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buky_raffle_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buky_sponsors_select ON public.buky_sponsors;
CREATE POLICY buky_sponsors_select ON public.buky_sponsors FOR SELECT TO authenticated
  USING (active OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_sponsors_admin ON public.buky_sponsors;
CREATE POLICY buky_sponsors_admin ON public.buky_sponsors FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_periods_select ON public.buky_raffle_periods;
CREATE POLICY buky_periods_select ON public.buky_raffle_periods FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS buky_periods_admin ON public.buky_raffle_periods;
CREATE POLICY buky_periods_admin ON public.buky_raffle_periods FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_coupons_select ON public.buky_coupons;
CREATE POLICY buky_coupons_select ON public.buky_coupons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS buky_coupons_admin ON public.buky_coupons;
CREATE POLICY buky_coupons_admin ON public.buky_coupons FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_coupon_codes_admin ON public.buky_coupon_codes;
CREATE POLICY buky_coupon_codes_admin ON public.buky_coupon_codes FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_entries_select ON public.buky_entries;
CREATE POLICY buky_entries_select ON public.buky_entries FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS buky_results_select ON public.buky_raffle_results;
CREATE POLICY buky_results_select ON public.buky_raffle_results FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS buky_results_admin_delivery ON public.buky_raffle_results;
CREATE POLICY buky_results_admin_delivery ON public.buky_raffle_results FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.buky_sponsors, public.buky_raffle_periods, public.buky_coupons, public.buky_coupon_codes,
              public.buky_entries, public.buky_raffle_results FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.buky_entries FROM authenticated;
REVOKE INSERT, DELETE, TRUNCATE ON public.buky_raffle_results FROM authenticated;
REVOKE UPDATE ON public.buky_raffle_results FROM authenticated;
GRANT UPDATE (delivery_status, delivery_note, delivered_at) ON public.buky_raffle_results TO authenticated;

-- ------------------------------------------------------------
-- Azar criptográfico: entero uniforme en [0, p_max) sin sesgo de módulo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_secure_random(p_max bigint)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SET search_path TO ''
AS $$
DECLARE
  v_space numeric := 4611686018427387904;  -- 2^62
  v_limit numeric;
  v_r numeric;
  v_bytes bytea;
  i integer;
BEGIN
  IF p_max IS NULL OR p_max < 1 THEN
    RAISE EXCEPTION 'invalid_max' USING ERRCODE = '22023';
  END IF;
  v_limit := floor(v_space / p_max) * p_max;
  LOOP
    v_bytes := extensions.gen_random_bytes(8);
    v_r := 0;
    FOR i IN 0 .. 7 LOOP
      v_r := v_r * 256 + get_byte(v_bytes, i);
    END LOOP;
    v_r := mod(v_r, v_space);              -- 62 bits
    EXIT WHEN v_r < v_limit;
  END LOOP;
  RETURN mod(v_r, p_max)::bigint;
END;
$$;

-- Elige al ganador: recorre la lista en orden acumulando pesos y devuelve el primero cuyo
-- acumulado supera el número al azar n (0 <= n < suma de pesos). Probabilidad = peso / total.
CREATE OR REPLACE FUNCTION public.buky_weighted_pick(p_candidates jsonb, p_n bigint)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT (x.c ->> 'user_id')::uuid
  FROM (SELECT c, sum((c ->> 'weight')::bigint) OVER (ORDER BY ord) AS cum
        FROM jsonb_array_elements(p_candidates) WITH ORDINALITY AS t(c, ord)) x
  WHERE x.cum > p_n
  ORDER BY x.cum
  LIMIT 1
$$;

-- ------------------------------------------------------------
-- Atleta: enviar todo el saldo al periodo abierto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_send_to_raffle(p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_period public.buky_raffle_periods%ROWTYPE;
  v_user record;
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

  SELECT * INTO v_period FROM public.buky_raffle_periods
  WHERE status = 'open' AND now() >= starts_at AND now() < ends_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_open_period' USING ERRCODE = 'P0002';
  END IF;

  SELECT city_code, state_code INTO v_user FROM public.users WHERE id = v_uid;
  IF v_user.city_code IS NULL THEN
    RAISE EXCEPTION 'city_required' USING ERRCODE = 'P0001',
      DETAIL = 'Completa tu ciudad en el perfil para participar';
  END IF;

  INSERT INTO public.buky_balances (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.buky_balances WHERE user_id = v_uid FOR UPDATE;
  IF v_balance < 1 THEN
    RAISE EXCEPTION 'no_bukys' USING ERRCODE = 'P0001';
  END IF;

  v_move := public.apply_buky_movement(v_uid, 'sent', -v_balance, 'raffle_period', v_period.id::text,
                                       'raffle:' || p_idempotency_key, v_period.name);
  LOOP
    v_ticket := 'BK-' || upper(encode(extensions.gen_random_bytes(4), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.buky_entries WHERE ticket_code = v_ticket);
  END LOOP;

  INSERT INTO public.buky_entries (period_id, user_id, amount, city_code, state_code, ticket_code, ledger_id)
  VALUES (v_period.id, v_uid, v_balance, v_user.city_code, v_user.state_code, v_ticket, (v_move ->> 'ledger_id')::bigint)
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object('ticket', v_entry.ticket_code, 'amount', v_entry.amount,
                            'period_id', v_period.id, 'period_name', v_period.name,
                            'ends_at', v_period.ends_at, 'duplicate', false);
END;
$$;

-- Cupones para la pantalla Início: los del periodo abierto (o el próximo) que aplican a la ciudad.
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
    SELECT * FROM public.buky_raffle_periods
    WHERE status IN ('open', 'scheduled')
    ORDER BY (status = 'open') DESC, starts_at
    LIMIT 1
  )
  SELECT k.id, p.id, p.name, p.status, p.ends_at, k.title, k.description, k.benefit, k.image_url,
         k.kind, k.scope, k.winners_count, k.valid_until, s.name, s.logo_url, s.instagram
  FROM p
  JOIN public.buky_coupons k ON k.period_id = p.id
  JOIN public.buky_sponsors s ON s.id = k.sponsor_id
  LEFT JOIN me ON true
  WHERE auth.uid() IS NOT NULL
    AND (k.scope = 'national'
         OR (k.scope = 'state' AND k.state_code = me.state_code)
         OR (k.scope = 'city' AND k.city_code = me.city_code))
  ORDER BY k.kind DESC, k.draw_order, k.title
$$;

-- ------------------------------------------------------------
-- Sorteo de un periodo (cron o admin). Cupón por cupón, según draw_order;
-- cada ganador queda excluido del resto de cupones del periodo.
-- ------------------------------------------------------------
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
  v_candidates jsonb;
  v_total bigint;
  v_n bigint;
  v_winner uuid;
  v_ticket text;
  v_code_id uuid;
  v_code text;
  v_results integer := 0;
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

  FOR k IN SELECT * FROM public.buky_coupons WHERE period_id = p_period_id ORDER BY draw_order, created_at, id LOOP
    FOR v_rank IN 1 .. k.winners_count LOOP
      -- Pesos por atleta elegible (suma de Bukys enviados), sin quienes ya ganaron en el periodo
      SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'weight', weight) ORDER BY user_id), '[]'::jsonb),
             coalesce(sum(weight), 0)
        INTO v_candidates, v_total
      FROM (
        SELECT e.user_id, sum(e.amount)::bigint AS weight
        FROM public.buky_entries e
        WHERE e.period_id = p_period_id
          AND (k.scope = 'national'
               OR (k.scope = 'state' AND e.state_code = k.state_code)
               OR (k.scope = 'city' AND e.city_code = k.city_code))
          AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_results r
                          WHERE r.period_id = p_period_id AND r.user_id = e.user_id)
        GROUP BY e.user_id
      ) c;

      v_winner := NULL; v_n := NULL; v_ticket := NULL; v_code := NULL;
      IF v_total > 0 THEN
        v_n := public.buky_secure_random(v_total);
        v_winner := public.buky_weighted_pick(v_candidates, v_n);
        SELECT ticket_code INTO v_ticket FROM public.buky_entries
        WHERE period_id = p_period_id AND user_id = v_winner ORDER BY created_at LIMIT 1;
        SELECT id, code INTO v_code_id, v_code FROM public.buky_coupon_codes
        WHERE coupon_id = k.id AND NOT assigned ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
        IF v_code_id IS NOT NULL THEN
          UPDATE public.buky_coupon_codes SET assigned = true WHERE id = v_code_id;
          v_code_id := NULL;
        END IF;
      END IF;

      INSERT INTO public.buky_raffle_results (period_id, coupon_id, rank, user_id, winning_ticket, redeem_code,
                                              total_weight, winning_number, candidates, candidates_sha256,
                                              delivery_status)
      VALUES (p_period_id, k.id, v_rank, v_winner, v_ticket, v_code, v_total, v_n, v_candidates,
              encode(extensions.digest(v_candidates::text, 'sha256'), 'hex'),
              CASE WHEN v_winner IS NULL THEN 'unclaimed' ELSE 'notified' END);
      v_results := v_results + 1;

      IF v_winner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (v_winner, 'buky_raffle_won', 'Você ganhou no sorteio Buky! 🎉',
                format('Seu ticket %s foi sorteado no cupom "%s". Veja como resgatar na sua Bolsa.', v_ticket, k.title));
      END IF;
      EXIT WHEN v_winner IS NULL;  -- sin más candidatos para este cupón
    END LOOP;
  END LOOP;

  UPDATE public.buky_raffle_periods SET status = 'drawn', drawn_at = now() WHERE id = p_period_id;
  RETURN jsonb_build_object('status', 'drawn', 'results', v_results, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_buky_draw_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.buky_is_privileged() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.buky_draw_period_internal(p_period_id);
END;
$$;

-- Cancela un periodo y devuelve a cada atleta los Bukys que envió.
CREATE OR REPLACE FUNCTION public.admin_buky_cancel_period(p_period_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_period public.buky_raffle_periods%ROWTYPE;
  r record;
  v_refunded integer := 0;
BEGIN
  IF NOT public.buky_is_privileged() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_period FROM public.buky_raffle_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status = 'drawn' THEN
    RAISE EXCEPTION 'period_already_drawn' USING ERRCODE = 'P0001';
  END IF;
  IF v_period.status = 'cancelled' THEN
    RETURN jsonb_build_object('changed', false);
  END IF;
  FOR r IN SELECT user_id, sum(amount)::integer AS amount FROM public.buky_entries
           WHERE period_id = p_period_id GROUP BY user_id LOOP
    PERFORM public.apply_buky_movement(r.user_id, 'adjust', r.amount, 'raffle_period_cancelled',
                                       p_period_id::text, 'period_cancel:' || p_period_id, trim(p_reason));
    v_refunded := v_refunded + r.amount;
  END LOOP;
  UPDATE public.buky_raffle_periods SET status = 'cancelled' WHERE id = p_period_id;
  RETURN jsonb_build_object('changed', true, 'bukys_refunded', v_refunded);
END;
$$;

-- ------------------------------------------------------------
-- Reloj de los sorteos (pg_cron cada 5 minutos):
--   abre los periodos programados, cierra los vencidos, crea el siguiente y sortea.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_raffle_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.buky_raffle_periods%ROWTYPE;
  v_next uuid;
  v_len interval;
  v_opened integer := 0;
  v_closed integer := 0;
  v_drawn integer := 0;
  v_created integer := 0;
BEGIN
  IF NOT public.buky_is_privileged() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 1) Cerrar los vencidos y crear el siguiente periodo automático
  FOR p IN SELECT * FROM public.buky_raffle_periods WHERE status = 'open' AND ends_at <= now() FOR UPDATE LOOP
    UPDATE public.buky_raffle_periods SET status = 'closed' WHERE id = p.id;
    v_closed := v_closed + 1;
    IF p.cadence <> 'none' AND NOT EXISTS (
         SELECT 1 FROM public.buky_raffle_periods WHERE starts_at >= p.ends_at AND status <> 'cancelled') THEN
      v_len := CASE p.cadence WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END;
      INSERT INTO public.buky_raffle_periods (name, starts_at, ends_at, draw_at, cadence)
      VALUES (CASE p.cadence WHEN 'weekly' THEN 'Sorteio semanal ' ELSE 'Sorteio mensal ' END
                || to_char(p.ends_at AT TIME ZONE public.buky_tz(), 'DD/MM'),
              p.ends_at, p.ends_at + v_len, p.ends_at + v_len + (p.draw_at - p.ends_at), p.cadence)
      RETURNING id INTO v_next;
      INSERT INTO public.buky_coupons (period_id, sponsor_id, title, description, benefit, image_url, kind, scope,
                                       city_code, state_code, winners_count, draw_order, redeem_instructions,
                                       valid_until, repeat_next)
      SELECT v_next, sponsor_id, title, description, benefit, image_url, kind, scope, city_code, state_code,
             winners_count, draw_order, redeem_instructions, NULL, true
      FROM public.buky_coupons WHERE period_id = p.id AND repeat_next;
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- 2) Abrir el programado que ya empezó (uno a la vez)
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE status = 'open') THEN
    UPDATE public.buky_raffle_periods SET status = 'open'
    WHERE id = (SELECT id FROM public.buky_raffle_periods
                WHERE status = 'scheduled' AND starts_at <= now() AND ends_at > now()
                ORDER BY starts_at LIMIT 1);
    GET DIAGNOSTICS v_opened = ROW_COUNT;
  END IF;

  -- 3) Sortear los cerrados cuya hora de sorteo llegó
  FOR p IN SELECT * FROM public.buky_raffle_periods WHERE status = 'closed' AND draw_at <= now() ORDER BY ends_at LOOP
    PERFORM public.buky_draw_period_internal(p.id);
    v_drawn := v_drawn + 1;
  END LOOP;

  RETURN jsonb_build_object('opened', v_opened, 'closed', v_closed, 'created', v_created, 'drawn', v_drawn);
END;
$$;

-- ------------------------------------------------------------
-- Resumen del atleta ampliado (Bolsa / Perfil)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buky_my_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'balance', coalesce(b.balance, 0),
    'found_total', coalesce(b.found_total, 0),
    'gift_total', coalesce(b.gift_total, 0),
    'sent_total', coalesce(b.sent_total, 0),
    'passes_valid_total', (SELECT count(*) FROM public.buky_passes p WHERE p.user_id = auth.uid() AND p.awarded),
    'sessions_total', (SELECT count(*) FROM public.buky_sessions s WHERE s.user_id = auth.uid() AND s.status = 'valid'),
    'last_session', (
      SELECT jsonb_build_object('id', s.id, 'status', s.status, 'ended_at', s.ended_at,
                                'bukys', s.bukys_awarded, 'passes', s.passes_valid,
                                'route', r.name, 'city', c.name, 'invalid_reason', s.invalid_reason)
      FROM public.buky_sessions s
      JOIN public.buky_routes r ON r.id = s.route_id
      JOIN public.br_cities c ON c.code = r.city_code
      WHERE s.user_id = auth.uid() AND s.status IN ('valid', 'invalid')
      ORDER BY s.ended_at DESC NULLS LAST LIMIT 1),
    'open_period', (
      SELECT jsonb_build_object('id', p.id, 'name', p.name, 'ends_at', p.ends_at, 'draw_at', p.draw_at,
                                'my_bukys', coalesce((SELECT sum(e.amount) FROM public.buky_entries e
                                                      WHERE e.period_id = p.id AND e.user_id = auth.uid()), 0),
                                'my_tickets', coalesce((SELECT jsonb_agg(e.ticket_code ORDER BY e.created_at)
                                                        FROM public.buky_entries e
                                                        WHERE e.period_id = p.id AND e.user_id = auth.uid()), '[]'::jsonb))
      FROM public.buky_raffle_periods p WHERE p.status = 'open' LIMIT 1),
    'wins', coalesce((
      SELECT jsonb_agg(jsonb_build_object('period', p.name, 'coupon', k.title, 'benefit', k.benefit,
                                          'sponsor', s.name, 'kind', k.kind, 'ticket', r.winning_ticket,
                                          'redeem_code', r.redeem_code, 'redeem_instructions', k.redeem_instructions,
                                          'valid_until', k.valid_until, 'delivery_status', r.delivery_status,
                                          'drawn_at', r.drawn_at) ORDER BY r.drawn_at DESC)
      FROM public.buky_raffle_results r
      JOIN public.buky_coupons k ON k.id = r.coupon_id
      JOIN public.buky_sponsors s ON s.id = k.sponsor_id
      JOIN public.buky_raffle_periods p ON p.id = r.period_id
      WHERE r.user_id = auth.uid()), '[]'::jsonb)
  )
  FROM (SELECT 1) one
  LEFT JOIN public.buky_balances b ON b.user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- Permisos de ejecución
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buky_secure_random(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_draw_period_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_weighted_pick(jsonb, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_send_to_raffle(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_zone_coupons(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_draw_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_cancel_period(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_raffle_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_my_summary() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.buky_secure_random(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.buky_draw_period_internal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.buky_weighted_pick(jsonb, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.buky_send_to_raffle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_zone_coupons(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buky_draw_period(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_buky_cancel_period(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buky_raffle_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.buky_my_summary() TO authenticated;

-- ------------------------------------------------------------
-- Programación con pg_cron (si la extensión está instalada; en producción lo está)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'buky-raffle-tick';
    PERFORM cron.schedule('buky-raffle-tick', '*/5 * * * *', 'SELECT public.buky_raffle_tick()');
  ELSE
    RAISE NOTICE 'pg_cron no está instalado: programar buky_raffle_tick() manualmente';
  END IF;
END $$;

COMMIT;
