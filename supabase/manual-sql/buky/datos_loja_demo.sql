-- Productos de ejemplo de la Loja 3buk (12/11/2026) para tener datos en el admin.
-- Marcados [TESTE]; se editan o se desactivan desde Admin → Buky → Loja → Produtos.
-- Idempotente: no pisa cambios hechos después en el admin (solo inserta si no existen).
\set ON_ERROR_STOP 1
INSERT INTO public.shop_products (id, slug, name, description, images, price_cents, active, weight_kg, width_cm, height_cm, length_cm)
VALUES
  ('5b0b0000-0000-4000-8000-000000000001', 'bone-buky-teste', '[TESTE] Boné esportivo Buky',
   'Boné de corrida com o Buky bordado na frente. Tecido leve, laterais em tela respirável e regulagem traseira.',
   ARRAY['https://www.3buk.com/loja-demo/bone-buky.jpg'], 6990, true, 0.15, 20, 12, 25),
  ('5b0b0000-0000-4000-8000-000000000002', 'squeeze-buky-teste', '[TESTE] Squeeze esportivo Buky 750 ml',
   'Garrafa squeeze de 750 ml com bico de pressão e o Buky estampado. Livre de BPA.',
   ARRAY['https://www.3buk.com/loja-demo/squeeze-buky.jpg'], 3990, true, 0.2, 8, 8, 25)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_variants (id, product_id, color, size, sku, stock, active)
VALUES
  ('5b0b0000-0000-4000-8000-000000000011', '5b0b0000-0000-4000-8000-000000000001', 'Preto', 'Único', 'TESTE-BONE-PRETO', 5, true),
  ('5b0b0000-0000-4000-8000-000000000012', '5b0b0000-0000-4000-8000-000000000001', 'Verde lima', 'Único', 'TESTE-BONE-VERDE', 3, true),
  ('5b0b0000-0000-4000-8000-000000000021', '5b0b0000-0000-4000-8000-000000000002', 'Preto', '750 ml', 'TESTE-SQUEEZE-PRETO', 8, true),
  ('5b0b0000-0000-4000-8000-000000000022', '5b0b0000-0000-4000-8000-000000000002', 'Transparente', '750 ml', 'TESTE-SQUEEZE-TRANSP', 4, true)
ON CONFLICT (id) DO NOTHING;

SELECT name || ' · ' || (SELECT string_agg(color || ' ' || size || ' (' || stock || ')', ', ') FROM public.shop_variants v WHERE v.product_id = p.id)
FROM public.shop_products p WHERE p.id::text LIKE '5b0b0000-%' ORDER BY p.slug;
