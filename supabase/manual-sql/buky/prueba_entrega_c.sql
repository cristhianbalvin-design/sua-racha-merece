-- ============================================================
-- Prueba en producción de la Entrega C (paso 28). Idempotente; todo marcado [TESTE].
--
-- 1) Lógica de canje con datos reales del esquema, dentro de una transacción que se deshace:
--    otro patrocinador no ve el premio, la marca lo valida por QR y por código, no se canjea dos veces.
-- 2) Deja un premio [TESTE] real para el admin dueño del proyecto (Cristhian) y lo hace miembro
--    "owner" del patrocinador 3BUK, para que pruebe en el celular: QR en la app → escanear en
--    www.3buk.com/patrocinador. Inserta el aviso "ganhou" → cola → e-mail real por Resend.
-- Limpieza: borrar el periodo 7e570000-0000-4000-8000-0000000000c0 y la membresía (ver al final).
-- ============================================================
\set ON_ERROR_STOP 1

-- ---------- 1) Lógica de canje (se deshace) ----------
BEGIN;
DO $$
DECLARE
  v_admin uuid := 'a9c5b97e-aeba-41f6-9d93-3a47244b76dc';      -- atleta ganador simulado
  v_staff uuid;                                                 -- miembro de la marca simulado (un atleta cualquiera, no admin)
  v_sp_a uuid := gen_random_uuid(); v_sp_b uuid := gen_random_uuid();
  v_p uuid := gen_random_uuid(); v_k uuid := gen_random_uuid(); v_r uuid := gen_random_uuid();
  v_tok text; j jsonb;
BEGIN
  SELECT id INTO v_staff FROM public.users WHERE role = 'USUARIO' AND id <> v_admin ORDER BY created_at LIMIT 1;
  INSERT INTO public.buky_sponsors (id, name) VALUES (v_sp_a, '[TESTE] Marca A'), (v_sp_b, '[TESTE] Marca B');
  INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at)
  VALUES (v_p, '[TESTE] rollback', now() + interval '1 day', now() + interval '2 days', now() + interval '3 days');
  INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, kind, scope)
  VALUES (v_k, v_p, v_sp_a, '[TESTE] Cupom', 'physical', 'raffle');
  INSERT INTO public.buky_raffle_results (id, period_id, coupon_id, rank, user_id, redeem_code, total_weight,
                                          candidates, candidates_sha256, delivery_status, redeem_deadline)
  VALUES (v_r, v_p, v_k, 1, v_admin, 'TESTE-RB-01', 1, '[]', 'x', 'notified', now() + interval '1 day');
  SELECT redeem_token INTO v_tok FROM public.buky_raffle_results WHERE id = v_r;
  IF v_tok IS NULL OR length(v_tok) < 20 THEN RAISE EXCEPTION 'falta token QR'; END IF;

  -- Miembro de OTRA marca: no encuentra nada
  INSERT INTO public.buky_sponsor_members (sponsor_id, user_id, role) VALUES (v_sp_b, v_staff, 'staff');
  PERFORM set_config('request.jwt.claim.sub', v_staff::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  IF public.buky_sponsor_lookup(v_tok) ->> 'status' <> 'not_found' THEN
    RAISE EXCEPTION 'aislamiento entre marcas falló';
  END IF;

  -- Miembro de la marca correcta: válido por URL del QR y por código; canje único
  INSERT INTO public.buky_sponsor_members (sponsor_id, user_id, role) VALUES (v_sp_a, v_staff, 'owner');
  j := public.buky_sponsor_lookup('https://www.3buk.com/patrocinador/validar/' || v_tok);
  IF j ->> 'status' <> 'valid' THEN RAISE EXCEPTION 'lookup por QR: %', j; END IF;
  IF public.buky_sponsor_lookup('TESTE-RB-01') ->> 'status' <> 'valid' THEN RAISE EXCEPTION 'lookup por código'; END IF;
  PERFORM public.buky_sponsor_redeem(v_r, 'qr');
  IF public.buky_sponsor_lookup(v_tok) ->> 'status' <> 'redeemed' THEN RAISE EXCEPTION 'no quedó canjeado'; END IF;
  BEGIN
    PERFORM public.buky_sponsor_redeem(v_r, 'code');
    RAISE EXCEPTION 'segundo canje no debía pasar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'already_redeemed' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK lógica de canje (aislamiento, QR, código, canje único)';
END $$;
ROLLBACK;

-- ---------- 2) Premio [TESTE] real para probar en el celular ----------
BEGIN;
DO $$
DECLARE
  v_admin uuid := 'a9c5b97e-aeba-41f6-9d93-3a47244b76dc';
  v_sp uuid := '7e570000-0000-4000-8000-000000000001';   -- patrocinador "3BUK" de los datos de prueba
  v_p uuid := '7e570000-0000-4000-8000-0000000000c0';
  v_k uuid := '7e570000-0000-4000-8000-0000000000c1';
  v_r uuid := '7e570000-0000-4000-8000-0000000000c2';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.buky_raffle_periods WHERE id = v_p) THEN
    INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence)
    VALUES (v_p, '[TESTE] Prueba de canje', now() - interval '3 days', now() - interval '2 days', now() - interval '2 days', 'none');
    -- El cupón se carga con el periodo programado (regla del paso 17)
    UPDATE public.buky_raffle_periods SET status = 'scheduled' WHERE id = v_p;
    INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, benefit, description, kind, scope, redeem_instructions)
    VALUES (v_k, v_p, v_sp, '[TESTE] Avaliação de corrida', '100% de desconto',
            'Prêmio de teste para validar o QR no painel do patrocinador.', 'physical', 'raffle',
            'Mostre o QR no estabelecimento.');
    UPDATE public.buky_raffle_periods SET status = 'drawn', drawn_at = now() WHERE id = v_p;
    INSERT INTO public.buky_raffle_results (id, period_id, coupon_id, rank, user_id, winning_ticket, redeem_code, total_weight,
                                            candidates, candidates_sha256, delivery_status, redeem_deadline, activated_at)
    VALUES (v_r, v_p, v_k, 1, v_admin, 'BK-TESTE-C', 'TESTE-C-01', 1, '[]', 'teste', 'notified', now() + interval '15 days', now());
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_admin, 'buky_raffle_won', '[TESTE] Você ganhou no sorteio!',
            'Você ganhou "[TESTE] Avaliação de corrida". Mostre o QR no app no estabelecimento.');
  END IF;
  INSERT INTO public.buky_sponsor_members (sponsor_id, user_id, role, invited_email)
  VALUES (v_sp, v_admin, 'owner', 'prueba-entrega-c')
  ON CONFLICT (sponsor_id, user_id) DO UPDATE SET revoked_at = NULL;
END $$;
COMMIT;

SELECT 'premio=' || (SELECT delivery_status FROM public.buky_raffle_results WHERE id = '7e570000-0000-4000-8000-0000000000c2'),
       'cola=' || (SELECT string_agg(channel || ':' || status, ',') FROM public.notification_outbox
                   WHERE payload ->> 'result_id' = '7e570000-0000-4000-8000-0000000000c2');

-- Limpieza (manual, cuando termine la prueba):
-- DELETE FROM public.buky_sponsor_members WHERE invited_email = 'prueba-entrega-c';
-- (el periodo [TESTE] queda como historial; los resultados son inmutables)
