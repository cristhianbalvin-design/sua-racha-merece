-- Eliminar rutas sin sesiones y conservar el historial de las demás.
BEGIN;
ALTER TABLE public.buky_routes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.buky_raffle_periods ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Una ciudad ya registrada no puede quedar fuera al editar un sorteo.
CREATE OR REPLACE FUNCTION public.buky_period_edit_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.city_codes IS DISTINCT FROM OLD.city_codes AND NEW.city_codes IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.buky_entries e WHERE e.period_id = OLD.id AND NOT (e.city_code = ANY(NEW.city_codes))) THEN
    RAISE EXCEPTION 'A cidade de um participante não pode ser excluída' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS buky_period_edit_guard ON public.buky_raffle_periods;
CREATE TRIGGER buky_period_edit_guard BEFORE UPDATE ON public.buky_raffle_periods
  FOR EACH ROW EXECUTE FUNCTION public.buky_period_edit_guard();

-- Serializa una entrada con el cierre y la edición de ciudades.
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

CREATE OR REPLACE FUNCTION public.buky_coupons_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_id IS DISTINCT FROM OLD.period_id THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.scope = 'city' THEN SELECT state_code INTO NEW.state_code FROM public.br_cities WHERE code = NEW.city_code; END IF;
  SELECT status INTO v_status FROM public.buky_raffle_periods WHERE id = NEW.period_id FOR UPDATE;
  IF v_status NOT IN ('scheduled', 'open') THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.buky_coupons_block_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.buky_raffle_periods WHERE id = OLD.period_id FOR UPDATE;
  IF v_status NOT IN ('scheduled', 'open', 'cancelled') THEN
    RAISE EXCEPTION 'period_not_editable' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
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
  IF p.status NOT IN ('open', 'closed') THEN RAISE EXCEPTION 'period_not_open' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.buky_raffle_periods SET ends_at = now(), draw_at = now(), status = 'closed',
    is_test = is_test OR coalesce(p_is_test, false) WHERE id = p_period_id;
  participants := public.buky_period_participants(p_period_id);
  IF participants < p.min_participants AND NOT (p.is_test OR coalesce(p_is_test, false)) THEN
    UPDATE public.buky_raffle_periods SET needs_review = true,
      review_note = format('%s de %s participantes mínimos', participants, p.min_participants) WHERE id = p_period_id;
    PERFORM public.buky_notify_admins('buky_raffle_review', 'Sorteio Buky sem o mínimo de participantes',
      format('"%s" fechou com %s participantes (mínimo %s). Decida no painel.', p.name, participants, p.min_participants));
    RETURN jsonb_build_object('status', 'review', 'duplicate', false);
  END IF;
  RETURN public.buky_draw_period_internal(p_period_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_buky_draw_now(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_buky_draw_now(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_buky_list_entries(p_period_id uuid)
RETURNS TABLE(user_id uuid, nickname text, name text, cities text, tickets bigint, first_entry timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT e.user_id, u.nickname, u.name, string_agg(DISTINCT c.name, ', ' ORDER BY c.name),
    sum(e.amount)::bigint, min(e.created_at)
    FROM public.buky_entries e JOIN public.users u ON u.id = e.user_id
    JOIN public.br_cities c ON c.code = e.city_code
    WHERE e.period_id = p_period_id GROUP BY e.user_id, u.nickname, u.name ORDER BY min(e.created_at);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_buky_list_entries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_buky_list_entries(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_buky_delete_route(p_route_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.buky_routes WHERE id = p_route_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'route_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_sessions WHERE route_id = p_route_id) THEN
    UPDATE public.buky_routes SET active = false, archived_at = coalesce(archived_at, now()), updated_at = now()
      WHERE id = p_route_id;
    RETURN jsonb_build_object('status', 'archived');
  END IF;
  DELETE FROM public.buky_routes WHERE id = p_route_id;
  RETURN jsonb_build_object('status', 'deleted');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_buky_delete_route(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_buky_delete_route(uuid) TO authenticated;
COMMIT;
