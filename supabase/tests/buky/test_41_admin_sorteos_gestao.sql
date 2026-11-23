-- Contrato del bloque 1. Requiere los pasos anteriores y test_40.
\c - postgres
\i :sqldir/41_admin_sorteos_gestao.sql
\i :sqldir/41_admin_sorteos_gestao.sql
BEGIN;

INSERT INTO public.users (id, email, name, nickname, role, plan, city_code) VALUES
  ('41000000-0000-0000-0000-000000000001', 'admin41@buky.test', 'Admin Quarenta', 'admin41', 'ADMIN', 'Freemium', 3302700),
  ('41000000-0000-0000-0000-000000000002', 'ana41@buky.test', 'Ana Luz', 'ana41', 'USUARIO', 'Freemium', 3302700),
  ('41000000-0000-0000-0000-000000000003', 'bia41@buky.test', 'Bia Sol', 'bia41', 'USUARIO', 'Freemium', 3302700);
SELECT public.apply_buky_movement(id, 'found', 10) FROM public.users
  WHERE id IN ('41000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000003');
INSERT INTO public.buky_sponsors (id, name) VALUES
  ('41000000-0000-0000-0000-000000000004', 'Patrocinador 41');
INSERT INTO public.buky_raffle_periods
  (id, name, starts_at, ends_at, draw_at, cadence, status, min_participants, city_codes, is_test)
VALUES
  ('41000000-0000-0000-0000-000000000005', 'Teste descartável', now() - interval '1 day', now() + interval '1 day', now() + interval '2 days', 'none', 'open', 30, '{3302700}', true),
  ('41000000-0000-0000-0000-000000000006', 'Sorteio real', now() - interval '1 day', now() + interval '1 day', now() + interval '2 days', 'none', 'open', 1, '{3302700}', false),
  ('41000000-0000-0000-0000-000000000007', 'Sem entradas', now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', 'none', 'scheduled', 1, null, false),
  ('41000000-0000-0000-0000-000000000008', 'Arquivar com saldo', now() - interval '1 day', now() + interval '1 day', now() + interval '2 days', 'none', 'open', 1, '{3302700}', false);
INSERT INTO public.buky_coupons
  (period_id, sponsor_id, title, kind, scope, winners_count) VALUES
  ('41000000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000004', 'Prêmio teste', 'digital', 'raffle', 1),
  ('41000000-0000-0000-0000-000000000006', '41000000-0000-0000-0000-000000000004', 'Prêmio real', 'digital', 'raffle', 1);

SELECT set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_buky_delete_period('41000000-0000-0000-0000-000000000007');
    RAISE EXCEPTION 'atleta excluiu sorteio';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.admin_buky_archive_period('41000000-0000-0000-0000-000000000006', true);
    RAISE EXCEPTION 'atleta arquivou sorteio';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.admin_buky_list_entries('41000000-0000-0000-0000-000000000006');
    RAISE EXCEPTION 'atleta leu entradas';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT public.apply_buky_movement('41000000-0000-0000-0000-000000000002', 'sent', -2);
SELECT public.apply_buky_movement('41000000-0000-0000-0000-000000000003', 'sent', -2);
INSERT INTO public.buky_entries (period_id, user_id, amount, city_code, state_code, ticket_code) VALUES
  ('41000000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000002', 1, 3302700, (SELECT state_code FROM public.br_cities WHERE code = 3302700), 'T41-A'),
  ('41000000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000003', 1, 3302700, (SELECT state_code FROM public.br_cities WHERE code = 3302700), 'T41-B'),
  ('41000000-0000-0000-0000-000000000006', '41000000-0000-0000-0000-000000000002', 1, 3302700, (SELECT state_code FROM public.br_cities WHERE code = 3302700), 'T41-C'),
  ('41000000-0000-0000-0000-000000000008', '41000000-0000-0000-0000-000000000003', 1, 3302700, (SELECT state_code FROM public.br_cities WHERE code = 3302700), 'T41-D');

SELECT set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE r jsonb;
BEGIN
  IF (SELECT count(*) FROM public.admin_buky_list_entries('41000000-0000-0000-0000-000000000005')) <> 2 THEN
    RAISE EXCEPTION 'lista de participantes incompleta';
  END IF;
  BEGIN
    UPDATE public.buky_raffle_periods SET city_codes = '{3304557}'
      WHERE id = '41000000-0000-0000-0000-000000000005';
    RAISE EXCEPTION 'edición dejó participantes fuera';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'edición dejó participantes fuera' THEN RAISE; END IF;
  END;
  UPDATE public.buky_raffle_periods SET name = 'Teste editado', min_participants = 2,
    ends_at = now() + interval '3 days', draw_at = now() + interval '4 days'
    WHERE id = '41000000-0000-0000-0000-000000000005';
  r := public.admin_buky_draw_now('41000000-0000-0000-0000-000000000005', true);
  IF r->>'status' <> 'drawn' THEN RAISE EXCEPTION 'teste não sorteado: %', r; END IF;
  IF (public.admin_buky_draw_now('41000000-0000-0000-0000-000000000005', true)->>'duplicate')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'sorteio duplicado';
  END IF;
  IF public.admin_buky_draw_now('41000000-0000-0000-0000-000000000006', false)->>'status' <> 'drawn' THEN
    RAISE EXCEPTION 'sorteio real não realizado';
  END IF;
  BEGIN
    PERFORM public.admin_buky_delete_period('41000000-0000-0000-0000-000000000006');
    RAISE EXCEPTION 'sorteio real com entradas excluído';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Cancele ou arquive este sorteio' THEN RAISE; END IF;
  END;
  r := public.admin_buky_archive_period('41000000-0000-0000-0000-000000000008', true);
  IF (r->>'bukys_refunded')::integer <> 1 THEN RAISE EXCEPTION 'arquivo não devolveu saldo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE id = '41000000-0000-0000-0000-000000000008'
    AND status = 'cancelled' AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'arquivo incorreto'; END IF;
  IF (public.admin_buky_delete_period('41000000-0000-0000-0000-000000000005')->>'bukys_refunded')::integer <> 2 THEN
    RAISE EXCEPTION 'teste não devolveu saldo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_entries WHERE period_id = '41000000-0000-0000-0000-000000000005')
    OR EXISTS (SELECT 1 FROM public.buky_raffle_results WHERE period_id = '41000000-0000-0000-0000-000000000005')
    OR EXISTS (SELECT 1 FROM public.buky_coupons WHERE period_id = '41000000-0000-0000-0000-000000000005') THEN
    RAISE EXCEPTION 'datos del teste persistieron';
  END IF;
  PERFORM public.admin_buky_delete_period('41000000-0000-0000-0000-000000000007');
END $$;

SELECT set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE j jsonb;
BEGIN
  SELECT to_jsonb(w) INTO j FROM public.buky_public_winners() w
    WHERE w.period_id = '41000000-0000-0000-0000-000000000006' LIMIT 1;
  IF j IS NULL OR j->>'initials' NOT IN ('AL', 'BS') OR j->>'nickname' IS NULL THEN
    RAISE EXCEPTION 'ganador público ausente: %', j;
  END IF;
  IF j ?| ARRAY['name', 'email', 'phone', 'user_id', 'instagram'] THEN
    RAISE EXCEPTION 'datos privados en respuesta pública';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_public_winners() WHERE period_id = '41000000-0000-0000-0000-000000000005') THEN
    RAISE EXCEPTION 'teste visible públicamente';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
  IF (public.admin_buky_archive_period('41000000-0000-0000-0000-000000000006', true)->>'bukys_refunded')::integer <> 1 THEN
    RAISE EXCEPTION 'arquivo de sorteio realizado não devolveu saldo';
  END IF;
  IF (public.admin_buky_archive_period('41000000-0000-0000-0000-000000000006', true)->>'bukys_refunded')::integer <> 0 THEN
    RAISE EXCEPTION 'arquivo devolveu saldo duas vezes';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.buky_public_winners() WHERE period_id = '41000000-0000-0000-0000-000000000006') THEN
    RAISE EXCEPTION 'ganhador de sorteio arquivado visível';
  END IF;
END $$;
ROLLBACK;
