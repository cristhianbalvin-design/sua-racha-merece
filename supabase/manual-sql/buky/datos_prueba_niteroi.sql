-- ============================================================
-- 3BUK · Buky · DATOS DE PRUEBA (Niterói) — correr DESPUÉS de los pasos 15, 16 y 17.
-- Todo va marcado con [TESTE] y se borra con el bloque de LIMPIEZA del final.
--
-- Ruta: orla de Icaraí, 4 puntos cada 400 m desde la Pedra de Itapuca (-22.905773, -43.119835)
-- hacia el centro de la playa (-22.908884, -43.113861), corridos ~25 m hacia el calçadão.
-- Radio de 70 m porque las coordenadas tienen margen: se ajustan arrastrando en /admin/buky.
-- Sorteo: período único (no se repite) que abre ya y cierra en 7 días; cupones de prueba.
-- ============================================================
BEGIN;

INSERT INTO public.buky_sponsors (id, name, instagram, active)
VALUES ('7e570000-0000-4000-8000-000000000001', '[TESTE] 3BUK', '3buk', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buky_routes (id, name, city_code, kind, active, length_m)
VALUES ('7e570000-0000-4000-8000-000000000010', '[TESTE] Orla de Icaraí', 3303302, 'official', true, 1200)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buky_points (id, route_id, seq, label, lat, lon, radius_m) VALUES
  ('7e570000-0000-4000-8000-000000000011', '7e570000-0000-4000-8000-000000000010', 0, 'Pedra de Itapuca', -22.905573, -43.119735, 70),
  ('7e570000-0000-4000-8000-000000000012', '7e570000-0000-4000-8000-000000000010', 1, 'Icaraí 1', -22.907343, -43.116335, 70),
  ('7e570000-0000-4000-8000-000000000013', '7e570000-0000-4000-8000-000000000010', 2, 'Icaraí centro', -22.909113, -43.112935, 70),
  ('7e570000-0000-4000-8000-000000000014', '7e570000-0000-4000-8000-000000000010', 3, 'Icaraí 3', -22.910883, -43.109536, 70)
ON CONFLICT (id) DO NOTHING;

-- Período de prueba: se crea "programado" y el reloj (o el bloque de abajo) lo abre.
INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence)
VALUES ('7e570000-0000-4000-8000-000000000020', '[TESTE] Sorteio de teste', now() - interval '1 minute',
        now() + interval '7 days', now() + interval '7 days 1 hour', 'none')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, benefit, kind, scope, city_code,
                                 winners_count, draw_order, redeem_instructions)
VALUES
  ('7e570000-0000-4000-8000-000000000021', '7e570000-0000-4000-8000-000000000020', '7e570000-0000-4000-8000-000000000001',
   '[TESTE] Cupom físico Niterói', 'TESTE', 'physical', 'city', 3303302, 1, 10, 'Cupom de teste: não é um prêmio real.'),
  ('7e570000-0000-4000-8000-000000000022', '7e570000-0000-4000-8000-000000000020', '7e570000-0000-4000-8000-000000000001',
   '[TESTE] Cupom digital Brasil', 'TESTE', 'digital', 'national', NULL, 1, 20, 'Cupom de teste: não é um prêmio real.')
ON CONFLICT (id) DO NOTHING;

-- Abrir el período ya (si no hay otro abierto) sin esperar al reloj de 5 minutos
UPDATE public.buky_raffle_periods SET status = 'open'
WHERE id = '7e570000-0000-4000-8000-000000000020' AND status = 'scheduled'
  AND NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE status = 'open');

COMMIT;

-- Verificación
SELECT
  (SELECT count(*) FROM public.buky_points WHERE route_id = '7e570000-0000-4000-8000-000000000010') AS puntos_debe_ser_4,
  (SELECT status FROM public.buky_raffle_periods WHERE id = '7e570000-0000-4000-8000-000000000020') AS periodo_debe_ser_open,
  (SELECT count(*) FROM public.buky_coupons WHERE period_id = '7e570000-0000-4000-8000-000000000020') AS cupones_debe_ser_2;

-- ============================================================
-- LIMPIEZA (cuando termine el piloto). Si hubo envíos al sorteo de prueba, primero
-- cancelarlo desde /admin/buky para devolver los Bukys; luego:
--
-- BEGIN;
-- DELETE FROM public.buky_coupons WHERE period_id = '7e570000-0000-4000-8000-000000000020';
-- UPDATE public.buky_routes SET active = false WHERE id = '7e570000-0000-4000-8000-000000000010';
-- UPDATE public.buky_sponsors SET active = false WHERE id = '7e570000-0000-4000-8000-000000000001';
-- COMMIT;
-- (La ruta y sus puntos se desactivan en vez de borrarse si ya tienen entrenamientos registrados.)
-- ============================================================
