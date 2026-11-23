-- Bloque 1: gestión de sorteos, borrado controlado y nombres públicos.
-- Aplicar después de 40_admin_rutas.sql. Reejecutable.
BEGIN;

ALTER TABLE public.buky_raffle_periods
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.buky_raffle_periods
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- La configuración sólo cambia antes del sorteo. Las entradas existentes deben
-- seguir dentro de las fechas y ciudades del periodo.
CREATE OR REPLACE FUNCTION public.buky_period_edit_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF (NEW.name, NEW.starts_at, NEW.ends_at, NEW.draw_at, NEW.cadence,
      NEW.city_codes, NEW.min_participants, NEW.redeem_days, NEW.rules_text)
     IS DISTINCT FROM
     (OLD.name, OLD.starts_at, OLD.ends_at, OLD.draw_at, OLD.cadence,
      OLD.city_codes, OLD.min_participants, OLD.redeem_days, OLD.rules_text) THEN
    IF OLD.status NOT IN ('scheduled', 'open') OR OLD.drawn_at IS NOT NULL THEN
      -- El cierre anticipado es una transición, no una edición de configuración.
      IF NOT (OLD.status = 'closed' AND NEW.status = 'closed' AND
              current_setting('buky.draw_now_id', true) = OLD.id::text) THEN
        RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    IF NEW.city_codes IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.buky_entries e WHERE e.period_id = OLD.id
        AND NOT (e.city_code = ANY(NEW.city_codes))
    ) THEN
      RAISE EXCEPTION 'A cidade de um participante não pode ser excluída' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.buky_entries e WHERE e.period_id = OLD.id
        AND (e.created_at < NEW.starts_at OR e.created_at > NEW.ends_at)
    ) THEN
      RAISE EXCEPTION 'As novas datas deixariam participações fora do período' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Cada entrada bloqueia a linha do periodo, serializando envíos, edición y cierre.
CREATE OR REPLACE FUNCTION public.buky_entry_period_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p public.buky_raffle_periods%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.buky_raffle_periods WHERE id = NEW.period_id FOR UPDATE;
  -- Solo entradas en vivo: las cargas con fecha pasada (datos de ejemplo, importaciones) no se bloquean.
  IF NEW.created_at < now() - interval '1 minute' THEN
    RETURN NEW;
  END IF;
  IF NOT FOUND OR p.status <> 'open' OR now() < p.starts_at OR now() >= p.ends_at
     OR (p.city_codes IS NOT NULL AND NOT (NEW.city_code = ANY(p.city_codes))) THEN
    RAISE EXCEPTION 'period_not_open_or_outside_area' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS buky_entry_period_guard ON public.buky_entries;
CREATE TRIGGER buky_entry_period_guard BEFORE INSERT ON public.buky_entries
  FOR EACH ROW EXECUTE FUNCTION public.buky_entry_period_guard();

-- Permitir editar todos los premios en un sorteo abierto, incluso con entradas.
-- Una ciudad/estado nuevo no puede dejar entradas anteriores fuera de ese cupón.
CREATE OR REPLACE FUNCTION public.buky_coupons_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE p public.buky_raffle_periods%ROWTYPE; v_check_scope boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_id IS DISTINCT FROM OLD.period_id THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.scope = 'city' THEN
    SELECT state_code INTO NEW.state_code FROM public.br_cities WHERE code = NEW.city_code;
  END IF;
  SELECT * INTO p FROM public.buky_raffle_periods WHERE id = NEW.period_id FOR UPDATE;
  IF NOT FOUND OR p.status NOT IN ('scheduled', 'open') OR p.drawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_check_scope := true;
  ELSE
    v_check_scope := (NEW.scope, NEW.city_code, NEW.state_code)
      IS DISTINCT FROM (OLD.scope, OLD.city_code, OLD.state_code);
  END IF;
  IF v_check_scope AND EXISTS (
        SELECT 1 FROM public.buky_entries e WHERE e.period_id = NEW.period_id
          AND ((NEW.scope = 'city' AND e.city_code <> NEW.city_code)
            OR (NEW.scope = 'state' AND e.state_code <> NEW.state_code))
      ) THEN
    RAISE EXCEPTION 'O novo alcance excluiria participantes do prêmio' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_coupons_block_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE p public.buky_raffle_periods%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.buky_raffle_periods WHERE id = OLD.period_id FOR UPDATE;
  IF current_setting('buky.delete_period_id', true) = OLD.period_id::text
     AND public.is_admin() AND (p.is_test OR NOT EXISTS (
       SELECT 1 FROM public.buky_entries e WHERE e.period_id = OLD.period_id)) THEN
    RETURN OLD;
  END IF;
  IF p.status NOT IN ('scheduled', 'open', 'cancelled') OR p.drawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

-- Sólo el borrado administrativo autorizado puede atravesar los triggers
-- inmutables; el resto de mutaciones sigue prohibido.
CREATE OR REPLACE FUNCTION public.buky_entries_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('buky.delete_period_id', true) = OLD.period_id::text
     AND public.is_admin() AND EXISTS (
       SELECT 1 FROM public.buky_raffle_periods p WHERE p.id = OLD.period_id AND p.is_test) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'buky_entries es inmutable' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_results_write_once()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_mutable text[] := ARRAY['delivery_status', 'delivery_note', 'delivered_at',
  'redeem_deadline', 'activated_at', 'republished_to', 'redeem_code', 'redeem_token',
  'redeemed_at', 'redeemed_by', 'redeemed_channel'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('buky.delete_period_id', true) = OLD.period_id::text
       AND public.is_admin() AND EXISTS (
         SELECT 1 FROM public.buky_raffle_periods p WHERE p.id = OLD.period_id
           AND (p.is_test OR NOT EXISTS (
             SELECT 1 FROM public.buky_entries e WHERE e.period_id = OLD.period_id))) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'buky_raffle_results es inmutable' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'buky_raffle_results es inmutable (solo cambia la entrega)' USING ERRCODE = '42501';
  END IF;
  IF OLD.redeem_code IS NOT NULL AND NEW.redeem_code IS DISTINCT FROM OLD.redeem_code THEN
    RAISE EXCEPTION 'redeem_code_locked' USING ERRCODE = '42501';
  END IF;
  IF OLD.redeem_token IS NOT NULL AND NEW.redeem_token IS DISTINCT FROM OLD.redeem_token THEN
    RAISE EXCEPTION 'redeem_token_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_buky_draw_now(p_period_id uuid, p_is_test boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p public.buky_raffle_periods%ROWTYPE; participants integer;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.buky_raffle_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0002'; END IF;
  IF p.status = 'drawn' THEN RETURN jsonb_build_object('status', 'drawn', 'duplicate', true); END IF;
  IF p.status NOT IN ('open', 'closed') OR p.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'period_not_open' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('buky.draw_now_id', p_period_id::text, true);
  UPDATE public.buky_raffle_periods SET ends_at = now(), draw_at = now(), status = 'closed',
    is_test = is_test OR coalesce(p_is_test, false) WHERE id = p_period_id;
  PERFORM set_config('buky.draw_now_id', '', true);
  participants := public.buky_period_participants(p_period_id);
  IF participants < p.min_participants AND NOT (p.is_test OR coalesce(p_is_test, false)) THEN
    UPDATE public.buky_raffle_periods SET needs_review = true,
      review_note = format('%s de %s participantes mínimos', participants, p.min_participants)
      WHERE id = p_period_id;
    PERFORM public.buky_notify_admins('buky_raffle_review', 'Sorteio Buky sem o mínimo de participantes',
      format('"%s" fechou com %s participantes (mínimo %s). Decida no painel.', p.name, participants, p.min_participants));
    RETURN jsonb_build_object('status', 'review', 'duplicate', false);
  END IF;
  RETURN public.buky_draw_period_internal(p_period_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_buky_list_entries(p_period_id uuid)
RETURNS TABLE(user_id uuid, nickname text, name text, cities text, tickets bigint, first_entry timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT e.user_id, u.nickname, u.name,
    string_agg(DISTINCT c.name, ', ' ORDER BY c.name), sum(e.amount)::bigint, min(e.created_at)
    FROM public.buky_entries e JOIN public.users u ON u.id = e.user_id
    JOIN public.br_cities c ON c.code = e.city_code
    WHERE e.period_id = p_period_id OR e.period_id IN (
      SELECT id FROM public.buky_raffle_periods WHERE merged_into = p_period_id)
    GROUP BY e.user_id, u.nickname, u.name
    ORDER BY min(e.created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_buky_delete_period(p_period_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p public.buky_raffle_periods%ROWTYPE; r record; v_refunded integer := 0;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.buky_raffle_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT p.is_test AND EXISTS (SELECT 1 FROM public.buky_entries WHERE period_id = p_period_id) THEN
    RAISE EXCEPTION 'Cancele ou arquive este sorteio' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE merged_into = p_period_id)
     OR EXISTS (SELECT 1 FROM public.buky_raffle_results WHERE republished_to = p_period_id) THEN
    RAISE EXCEPTION 'Desfaça os vínculos com outros sorteios antes de excluir' USING ERRCODE = 'P0001';
  END IF;
  -- Mesmo em testes, saldos debitados são restaurados; o ledger permanece auditável.
  IF p.is_test THEN
    FOR r IN SELECT user_id, sum(amount)::integer AS amount FROM public.buky_entries
             WHERE period_id = p_period_id GROUP BY user_id LOOP
      PERFORM public.apply_buky_movement(r.user_id, 'adjust', r.amount,
        'raffle_period_cancelled', p_period_id::text, 'period_delete:' || p_period_id, 'Sorteio de teste excluído');
      v_refunded := v_refunded + r.amount;
    END LOOP;
  END IF;
  PERFORM set_config('buky.delete_period_id', p_period_id::text, true);
  WITH gone AS (
    DELETE FROM public.notification_outbox o WHERE o.payload->>'result_id' IN (
      SELECT id::text FROM public.buky_raffle_results WHERE period_id = p_period_id)
    RETURNING notification_id
  )
  DELETE FROM public.notifications n WHERE n.id IN (
    SELECT notification_id FROM gone WHERE notification_id IS NOT NULL);
  DELETE FROM public.buky_raffle_results WHERE period_id = p_period_id;
  DELETE FROM public.buky_entries WHERE period_id = p_period_id;
  DELETE FROM public.buky_raffle_rule_acceptances WHERE period_id = p_period_id;
  DELETE FROM public.buky_coupon_codes WHERE coupon_id IN (
    SELECT id FROM public.buky_coupons WHERE period_id = p_period_id);
  DELETE FROM public.buky_coupons WHERE period_id = p_period_id;
  DELETE FROM public.buky_raffle_periods WHERE id = p_period_id;
  PERFORM set_config('buky.delete_period_id', '', true);
  RETURN jsonb_build_object('deleted', true, 'bukys_refunded', v_refunded);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_buky_archive_period(p_period_id uuid, p_archived boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p public.buky_raffle_periods%ROWTYPE; v_refunded integer := 0; v_cancel jsonb; r record;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.buky_raffle_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(p_archived, false) AND p.archived_at IS NULL AND p.status IN ('scheduled', 'open', 'closed')
     AND EXISTS (SELECT 1 FROM public.buky_entries WHERE period_id = p_period_id) THEN
    v_cancel := public.admin_buky_cancel_period(p_period_id, 'Arquivado pelo administrador');
    v_refunded := coalesce((v_cancel->>'bukys_refunded')::integer, 0);
  ELSIF coalesce(p_archived, false) AND p.archived_at IS NULL AND p.status IN ('drawn', 'merged') THEN
    -- Los sorteos ya realizados o unidos conservan sus resultados y entradas;
    -- el archivo devuelve los Bukys gastados una sola vez.
    FOR r IN SELECT user_id, sum(amount)::integer AS amount FROM public.buky_entries
             WHERE period_id = p_period_id GROUP BY user_id LOOP
      PERFORM public.apply_buky_movement(r.user_id, 'adjust', r.amount,
        'raffle_period_cancelled', p_period_id::text, 'period_archive:' || p_period_id, 'Sorteio arquivado');
      v_refunded := v_refunded + r.amount;
    END LOOP;
  ELSIF coalesce(p_archived, false) AND p.status IN ('scheduled', 'open', 'closed') THEN
    UPDATE public.buky_raffle_periods SET status = 'cancelled' WHERE id = p_period_id;
  END IF;
  UPDATE public.buky_raffle_periods SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END
    WHERE id = p_period_id;
  RETURN jsonb_build_object('archived', coalesce(p_archived, false), 'bukys_refunded', v_refunded);
END;
$$;

-- La API pública entrega exclusivamente iniciales y apodo. No devuelve el id
-- del usuario, nombre, correo, teléfono ni el resultado administrativo.
CREATE OR REPLACE FUNCTION public.buky_public_winners()
RETURNS TABLE(period_id uuid, coupon_id uuid, initials text, nickname text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT r.period_id, r.coupon_id,
    upper(left(split_part(trim(u.name), ' ', 1), 1) ||
          left((regexp_match(trim(u.name), '[^ ]+$'))[1], 1))::text,
    u.nickname
  FROM public.buky_raffle_results r
  JOIN public.buky_raffle_periods p ON p.id = r.period_id
  JOIN public.users u ON u.id = r.user_id
  WHERE auth.uid() IS NOT NULL AND r.role = 'winner' AND p.status = 'drawn'
    AND p.archived_at IS NULL AND NOT p.is_test
  ORDER BY r.drawn_at DESC, r.coupon_id, r.rank
  LIMIT 500
$$;

REVOKE ALL ON FUNCTION public.admin_buky_draw_now(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_list_entries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_delete_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buky_archive_period(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_public_winners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_buky_draw_now(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buky_list_entries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buky_delete_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buky_archive_period(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_public_winners() TO authenticated;
COMMIT;
