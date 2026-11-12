-- Productos de ejemplo de la Loja (dos veces: idempotente)
\c - postgres
\i :sqldir/datos_loja_demo.sql
\i :sqldir/datos_loja_demo.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.shop_variants WHERE sku LIKE 'TESTE-%') <> 4 THEN RAISE EXCEPTION 'variantes de ejemplo'; END IF;
END $$;
