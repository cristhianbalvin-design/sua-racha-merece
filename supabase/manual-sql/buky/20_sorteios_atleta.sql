-- Paso 20 · Pantalla "Sorteios" del atleta (Atual · Próximos · Resultados).
-- Una sola función de lectura, segura para el atleta:
--   · Solo muestra los premios de SU zona (ciudad, estado o nacional), como el sorteo.
--   · Los resultados son anónimos: "1 ganhador em Niterói" (ciudad del envío ganador), nunca nombres.
--   · "Meus prêmios" con su código de canje.
-- Va después del 17. Idempotente.
BEGIN;

CREATE OR REPLACE FUNCTION public.buky_prize_json(k public.buky_coupons)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', k.id, 'title', k.title, 'description', k.description, 'benefit', k.benefit,
    'image_url', k.image_url, 'kind', k.kind, 'scope', k.scope,
    'city', (SELECT c.name FROM public.br_cities c WHERE c.code = k.city_code),
    'uf', (SELECT s.uf FROM public.br_states s WHERE s.code = k.state_code),
    'winners_count', k.winners_count, 'valid_until', k.valid_until,
    'redeem_instructions', k.redeem_instructions,
    'sponsor', jsonb_build_object('name', sp.name, 'logo_url', sp.logo_url, 'instagram', sp.instagram, 'website', sp.website))
  FROM public.buky_sponsors sp WHERE sp.id = k.sponsor_id
$$;

CREATE OR REPLACE FUNCTION public.buky_my_raffles()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH me AS (
    SELECT u.id, u.city_code, c.state_code
    FROM public.users u LEFT JOIN public.br_cities c ON c.code = u.city_code
    WHERE u.id = auth.uid()
  ),
  -- Premios que aplican a la zona del atleta, por periodo
  zone AS (
    SELECT k.*
    FROM public.buky_coupons k, me
    WHERE k.scope = 'national'
       OR (k.scope = 'state' AND k.state_code = me.state_code)
       OR (k.scope = 'city' AND k.city_code = me.city_code)
  ),
  prizes AS (
    SELECT z.period_id,
           jsonb_agg(public.buky_prize_json(z) ORDER BY (z.kind = 'physical') DESC, z.draw_order, z.title) AS list
    FROM zone z GROUP BY z.period_id
  ),
  mine AS (
    SELECT e.period_id, sum(e.amount)::int AS bukys, jsonb_agg(e.ticket_code ORDER BY e.created_at) AS tickets
    FROM public.buky_entries e WHERE e.user_id = auth.uid() GROUP BY e.period_id
  ),
  period_json AS (
    SELECT p.*, jsonb_build_object(
      'id', p.id, 'name', p.name, 'status', p.status, 'starts_at', p.starts_at, 'ends_at', p.ends_at,
      'draw_at', p.draw_at, 'drawn_at', p.drawn_at,
      'my_bukys', coalesce(m.bukys, 0), 'my_tickets', coalesce(m.tickets, '[]'::jsonb),
      'prizes', coalesce(pr.list, '[]'::jsonb)) AS j
    FROM public.buky_raffle_periods p
    LEFT JOIN mine m ON m.period_id = p.id
    LEFT JOIN prizes pr ON pr.period_id = p.id
  )
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'current', (SELECT j FROM period_json WHERE status IN ('open', 'closed') ORDER BY ends_at LIMIT 1),
    'upcoming', coalesce((SELECT jsonb_agg(j ORDER BY starts_at) FROM (
        SELECT j, starts_at FROM period_json WHERE status = 'scheduled' ORDER BY starts_at LIMIT 4) s), '[]'::jsonb),
    'past', coalesce((SELECT jsonb_agg(x.j ORDER BY x.ends_at DESC) FROM (
        SELECT pj.ends_at, pj.j
          || jsonb_build_object(
               'my_wins', (SELECT count(*) FROM public.buky_raffle_results r WHERE r.period_id = pj.id AND r.user_id = auth.uid()),
               -- Resultado anónimo por premio de la zona: cuántos ganaron y en qué ciudades
               'results', coalesce((
                 SELECT jsonb_agg(jsonb_build_object(
                          'prize_id', z.id, 'title', z.title, 'benefit', z.benefit, 'image_url', z.image_url,
                          'sponsor', (SELECT sp.name FROM public.buky_sponsors sp WHERE sp.id = z.sponsor_id),
                          'winners', (SELECT count(*) FROM public.buky_raffle_results r WHERE r.coupon_id = z.id AND r.user_id IS NOT NULL),
                          'cities', coalesce((
                             SELECT jsonb_agg(DISTINCT c.name)
                             FROM public.buky_raffle_results r
                             JOIN LATERAL (SELECT e.city_code FROM public.buky_entries e
                                           WHERE e.period_id = r.period_id AND e.user_id = r.user_id
                                           ORDER BY e.created_at LIMIT 1) w ON true
                             JOIN public.br_cities c ON c.code = w.city_code
                             WHERE r.coupon_id = z.id AND r.user_id IS NOT NULL), '[]'::jsonb),
                          'mine', EXISTS (SELECT 1 FROM public.buky_raffle_results r WHERE r.coupon_id = z.id AND r.user_id = auth.uid()))
                        ORDER BY (z.kind = 'physical') DESC, z.draw_order, z.title)
                 FROM zone z WHERE z.period_id = pj.id), '[]'::jsonb),
               'participants', (SELECT count(DISTINCT e.user_id) FROM public.buky_entries e WHERE e.period_id = pj.id)) AS j
        FROM period_json pj
        WHERE pj.status IN ('drawn', 'cancelled')
        ORDER BY pj.ends_at DESC LIMIT 12) x), '[]'::jsonb),
    'my_prizes', coalesce((
      SELECT jsonb_agg(public.buky_prize_json(k) || jsonb_build_object(
               'result_id', r.id, 'period', p.name, 'ticket', r.winning_ticket, 'redeem_code', r.redeem_code,
               'delivery_status', r.delivery_status, 'drawn_at', r.drawn_at) ORDER BY r.drawn_at DESC)
      FROM public.buky_raffle_results r
      JOIN public.buky_coupons k ON k.id = r.coupon_id
      JOIN public.buky_raffle_periods p ON p.id = r.period_id
      WHERE r.user_id = auth.uid()), '[]'::jsonb)
  ) END
$$;

REVOKE ALL ON FUNCTION public.buky_prize_json(public.buky_coupons) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buky_my_raffles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_my_raffles() TO authenticated;

COMMIT;
