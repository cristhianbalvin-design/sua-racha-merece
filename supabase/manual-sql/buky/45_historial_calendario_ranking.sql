BEGIN;

-- Local-day lookups for monthly rankings and the athlete's raffle history.
CREATE INDEX IF NOT EXISTS buky_passes_awarded_day_user_idx
  ON public.buky_passes (local_day, user_id) WHERE awarded;
CREATE INDEX IF NOT EXISTS buky_periods_history_idx
  ON public.buky_raffle_periods (ends_at DESC, id)
  WHERE status IN ('drawn', 'cancelled');
CREATE INDEX IF NOT EXISTS buky_periods_draw_day_idx
  ON public.buky_raffle_periods (draw_at, id);
CREATE INDEX IF NOT EXISTS buky_results_period_draw_idx
  ON public.buky_raffle_results (period_id, drawn_at DESC, id);

CREATE OR REPLACE FUNCTION public.buky_raffle_calendar(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 91 THEN
    RAISE EXCEPTION 'calendar_range_must_be_1_to_92_days';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'starts_at', p.starts_at, 'ends_at', p.ends_at,
    'draw_at', p.draw_at, 'status', p.status, 'cadence', p.cadence,
    'my_tickets', (SELECT count(*) FROM public.buky_entries e WHERE e.period_id = p.id AND e.user_id = auth.uid()),
    'prize_count', (SELECT count(*) FROM public.buky_coupons c WHERE c.period_id = p.id)
  ) ORDER BY p.draw_at, p.id), '[]'::jsonb) INTO result
  FROM public.buky_raffle_periods p
  JOIN public.users u ON u.id = auth.uid()
  WHERE p.draw_at >= (p_from::timestamp AT TIME ZONE public.buky_tz())
    AND p.draw_at < ((p_to + 1)::timestamp AT TIME ZONE public.buky_tz())
    AND (p.city_codes IS NULL OR public.buky_period_covers(p, u.city_code)
      OR EXISTS (SELECT 1 FROM public.buky_entries e WHERE e.period_id = p.id AND e.user_id = auth.uid()))
    AND p.status <> 'merged';
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.buky_ranking_page(
  p_scope text, p_city_code int DEFAULT NULL, p_month text DEFAULT NULL,
  p_limit int DEFAULT 25, p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_month text; v_first date; v_city int; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_scope NOT IN ('city', 'national') OR p_scope IS NULL THEN RAISE EXCEPTION 'invalid_ranking_scope'; END IF;
  v_month := coalesce(p_month, to_char(now() AT TIME ZONE public.buky_tz(), 'YYYY-MM'));
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR v_month < '2020-01'
     OR v_month > to_char(now() AT TIME ZONE public.buky_tz(), 'YYYY-MM') THEN
    RAISE EXCEPTION 'invalid_ranking_month';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_ranking_page';
  END IF;
  v_first := (v_month || '-01')::date;
  v_city := coalesce(p_city_code, (SELECT u.city_code FROM public.users u WHERE u.id = auth.uid()));
  WITH totals AS (
    SELECT p.user_id, count(*) AS bukys FROM public.buky_passes p
    WHERE p.awarded AND p.local_day >= v_first AND p.local_day < (v_first + interval '1 month')::date
    GROUP BY p.user_id
  ), ranked AS (
    SELECT u.id, u.name, u.nickname, u.avatar_url, t.bukys,
      rank() OVER (ORDER BY t.bukys DESC) AS pos
    FROM totals t JOIN public.users u ON u.id = t.user_id
    WHERE p_scope = 'national' OR u.city_code = v_city
  )
  SELECT jsonb_build_object(
    'period', v_month,
    'city', CASE WHEN p_scope = 'city' THEN (SELECT c.name FROM public.br_cities c WHERE c.code = v_city) END,
    'months', coalesce((SELECT jsonb_agg(m.month ORDER BY m.month DESC) FROM (
      SELECT DISTINCT to_char(p.local_day, 'YYYY-MM') AS month
      FROM public.buky_passes p JOIN public.users u ON u.id = p.user_id
      WHERE p.awarded AND (p_scope = 'national' OR u.city_code = v_city)
    ) m), '[]'::jsonb),
    'total', (SELECT count(*) FROM ranked),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'pos', r.pos, 'initials', public.buky_initials(r.name), 'nickname', r.nickname,
      'avatar_url', r.avatar_url, 'bukys', r.bukys, 'me', r.id = auth.uid()
    ) ORDER BY r.pos, r.id) FROM (
      SELECT * FROM ranked ORDER BY pos, id LIMIT p_limit OFFSET p_offset
    ) r), '[]'::jsonb),
    'me', (SELECT jsonb_build_object('pos', pos, 'bukys', bukys) FROM ranked WHERE id = auth.uid())
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.buky_my_raffle_history(p_month text DEFAULT NULL, p_limit int DEFAULT 12, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $history$
DECLARE v_month text; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_history_page';
  END IF;
  IF p_month IS NOT NULL AND (p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR p_month < '2020-01'
      OR p_month > to_char(now() AT TIME ZONE public.buky_tz(), 'YYYY-MM')) THEN
    RAISE EXCEPTION 'invalid_history_month';
  END IF;
  SELECT coalesce(p_month, to_char(max(p.ends_at AT TIME ZONE public.buky_tz()), 'YYYY-MM')) INTO v_month
  FROM public.buky_raffle_periods p JOIN public.users u ON u.id = auth.uid()
  WHERE p.status IN ('drawn', 'cancelled')
    AND to_char(p.ends_at AT TIME ZONE public.buky_tz(), 'YYYY-MM') <= to_char(now() AT TIME ZONE public.buky_tz(), 'YYYY-MM')
    AND (p.city_codes IS NULL
    OR public.buky_period_covers(p, u.city_code)
    OR EXISTS (SELECT 1 FROM public.buky_entries e WHERE e.period_id = p.id AND e.user_id = auth.uid()));
WITH me AS (SELECT u.id,
   u.city_code AS profile_city, CASE WHEN public.buky_is_route_tester() THEN
  coalesce(public.buky_city_at(NULL::double precision, NULL::double precision), u.city_code) ELSE
  public.buky_city_at(NULL::double precision, NULL::double precision) END AS here
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
  ORDER BY starts_at LIMIT 6) s), '[]'::jsonb), 'months', coalesce((SELECT jsonb_agg(jsonb_build_object('month', m.month, 'count', m.n) ORDER BY m.month DESC) FROM (SELECT to_char(ends_at AT TIME ZONE public.buky_tz(), 'YYYY-MM') AS month, count(*) AS n FROM period_json WHERE status IN ('drawn', 'cancelled') AND (city_codes IS NULL OR my_bukys IS NOT NULL OR home_ok OR here_ok) GROUP BY 1) m), '[]'::jsonb), 'total', (SELECT count(*) FROM period_json WHERE status IN ('drawn', 'cancelled') AND (city_codes IS NULL OR my_bukys IS NOT NULL OR home_ok OR here_ok) AND to_char(ends_at AT TIME ZONE public.buky_tz(), 'YYYY-MM') = v_month), 'items', coalesce( (SELECT jsonb_agg(x.j
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
  WHERE pj.status IN ('drawn', 'cancelled') AND (pj.city_codes IS NULL OR pj.my_bukys IS NOT NULL OR pj.home_ok OR pj.here_ok) AND to_char(pj.ends_at AT TIME ZONE public.buky_tz(), 'YYYY-MM') = v_month
  ORDER BY pj.ends_at DESC, pj.id LIMIT p_limit OFFSET p_offset) x), '[]'::jsonb), 'my_prizes', coalesce( (SELECT jsonb_agg(public.buky_prize_json(k) || jsonb_build_object('result_id',
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
  WHERE r.user_id = auth.uid() AND to_char(p.ends_at AT TIME ZONE public.buky_tz(), 'YYYY-MM') = v_month), '[]'::jsonb)) END INTO result;
  RETURN result;
END $history$;
REVOKE ALL ON FUNCTION public.buky_my_raffle_history(text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_my_raffle_history(text, int, int) TO authenticated;
REVOKE ALL ON FUNCTION public.buky_raffle_calendar(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buky_ranking_page(text, int, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_raffle_calendar(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buky_ranking_page(text, int, text, int, int) TO authenticated;

COMMIT;
