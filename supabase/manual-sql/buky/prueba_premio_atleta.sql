-- ============================================================
-- Premio [TESTE] para un atleta (prueba del canje con QR). Uso:
--   psql "$DB" -v email=correo@ejemplo.com -f prueba_premio_atleta.sql
-- Crea, una sola vez por atleta, un sorteo [TESTE] ya sorteado con un premio físico del patrocinador
-- "3BUK", lo deja "notified" con 15 días para canjear e inserta el aviso "ganhou" (→ e-mail).
-- ============================================================
\set ON_ERROR_STOP 1
SELECT set_config('prueba.email', lower(trim(:'email')), false);
BEGIN;
DO $$
DECLARE
  v_user uuid;
  v_sp uuid := '7e570000-0000-4000-8000-000000000001';   -- patrocinador "3BUK" de los datos de prueba
  v_p uuid; v_k uuid; v_r uuid;
BEGIN
  SELECT id INTO v_user FROM public.users WHERE lower(email) = current_setting('prueba.email');
  IF v_user IS NULL THEN RAISE EXCEPTION 'no existe el atleta %', current_setting('prueba.email'); END IF;
  -- Ids derivados del atleta: re-ejecutar no duplica
  v_p := md5('teste-canje-periodo-' || v_user)::uuid;
  v_k := md5('teste-canje-cupom-' || v_user)::uuid;
  v_r := md5('teste-canje-resultado-' || v_user)::uuid;
  IF EXISTS (SELECT 1 FROM public.buky_raffle_results WHERE id = v_r) THEN
    RAISE NOTICE 'ya existía el premio de prueba de %', current_setting('prueba.email');
    RETURN;
  END IF;
  INSERT INTO public.buky_raffle_periods (id, name, starts_at, ends_at, draw_at, cadence)
  VALUES (v_p, '[TESTE] Prueba de canje', now() - interval '3 days', now() - interval '2 days', now() - interval '2 days', 'none');
  INSERT INTO public.buky_coupons (id, period_id, sponsor_id, title, benefit, description, kind, scope, redeem_instructions)
  VALUES (v_k, v_p, v_sp, '[TESTE] Avaliação de corrida', '100% de desconto',
          'Prêmio de teste para validar o QR no painel do patrocinador.', 'physical', 'raffle',
          'Mostre o QR no estabelecimento.');
  UPDATE public.buky_raffle_periods SET status = 'drawn', drawn_at = now() WHERE id = v_p;
  INSERT INTO public.buky_raffle_results (id, period_id, coupon_id, rank, user_id, winning_ticket, redeem_code, total_weight,
                                          candidates, candidates_sha256, delivery_status, redeem_deadline, activated_at)
  VALUES (v_r, v_p, v_k, 1, v_user, 'BK-TESTE-' || upper(left(v_user::text, 4)), 'TESTE-' || upper(left(v_user::text, 6)), 1,
          '[]', 'teste', 'notified', now() + interval '15 days', now());
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_user, 'buky_raffle_won', '[TESTE] Você ganhou no sorteio!',
          'Você ganhou "[TESTE] Avaliação de corrida". Mostre o QR no app no estabelecimento.');
  RAISE NOTICE 'OK premio de prueba creado para %', current_setting('prueba.email');
END $$;
COMMIT;
