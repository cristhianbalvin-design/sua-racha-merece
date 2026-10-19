-- ============================================================
-- 3BUK · Fase 2 · Descarga por el camino correcto
-- PASO 12 — Correr en el SQL Editor de Supabase. Es idempotente.
--
-- Regla de negocio (roadmap, entregable C):
--   * Freemium: 3 fotos gratis cada 3 meses (ventana móvil, fotos DISTINTAS).
--   * Premium vigente: cada foto nueva descuenta get_photo_credit_cost() créditos (hoy 10).
--   * Volver a bajar una foto ya registrada es gratis para todos ("baixar de novo não gasta créditos").
--   * Admin: sin cupo ni cobro (para pruebas y soporte); la descarga igual se registra.
--   * Se mantiene la regla de acceso vigente: participación distinta de 'Não concluído',
--     y la foto debe estar publicada.
--
-- Qué cambia:
--   1. app_settings: free_download_quota (3) y free_download_window_months (3), editables sin desplegar.
--   2. get_my_download_status(): estado del usuario en sesión (plan, cupo, saldo, costo).
--   3. check_and_register_download: aplica cupo/cobro de forma atómica y devuelve el motivo si no se puede.
--      Motivos: participation_required, photo_not_available, free_quota_exhausted, insufficient_credits.
--      Compatibilidad: sin participación sigue devolviendo allowed=false (ahora con reason).
--
-- Concurrencia: se serializa por usuario con un advisory lock; el cobro usa apply_credit_movement
-- con idempotency_key 'download:<foto>', así una doble llamada no cobra dos veces.
-- ============================================================

-- 1. Parámetros
INSERT INTO public.app_settings (key, value, description) VALUES
  ('free_download_quota', '3'::jsonb, 'Fotos gratis por ventana para usuarios Freemium'),
  ('free_download_window_months', '3'::jsonb, 'Meses de la ventana móvil del cupo gratis (Freemium)')
ON CONFLICT (key) DO NOTHING;

-- 2. Estado de descargas del usuario en sesión
CREATE OR REPLACE FUNCTION public.get_my_download_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quota integer;
  v_months integer;
  v_cost integer;
  v_premium boolean;
  v_balance integer;
  v_used integer;
  v_oldest timestamptz;
  v_remaining integer;
  v_next timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_quota := COALESCE((SELECT (value #>> '{}')::integer FROM public.app_settings WHERE key = 'free_download_quota'), 3);
  v_months := COALESCE((SELECT (value #>> '{}')::integer FROM public.app_settings WHERE key = 'free_download_window_months'), 3);
  v_cost := public.get_photo_credit_cost();
  v_premium := public.user_is_premium(v_user_id);
  v_balance := COALESCE((SELECT balance FROM public.credit_balances WHERE user_id = v_user_id), 0);

  -- Fotos del cupo gratis usadas en la ventana: distintas, y sin las que se pagaron con créditos.
  SELECT count(*), min(pd.first_downloaded_at)
    INTO v_used, v_oldest
  FROM public.photo_downloads pd
  WHERE pd.user_id = v_user_id
    AND pd.first_downloaded_at > now() - make_interval(months => v_months)
    AND NOT EXISTS (
      SELECT 1 FROM public.credit_ledger cl
      WHERE cl.user_id = v_user_id
        AND cl.reason = 'photo_download'
        AND cl.ref_id = pd.event_photo_id::text
    );

  v_remaining := GREATEST(v_quota - v_used, 0);
  v_next := CASE WHEN v_remaining = 0 AND v_oldest IS NOT NULL
                 THEN v_oldest + make_interval(months => v_months) END;

  RETURN jsonb_build_object(
    'plan', CASE WHEN v_premium THEN 'Premium' ELSE 'Freemium' END,
    'free_quota', v_quota,
    'free_window_months', v_months,
    'free_used', v_used,
    'free_remaining', v_remaining,
    'next_free_at', v_next,
    'balance', v_balance,
    'cost', v_cost,
    'photos_affordable', CASE WHEN v_cost > 0 THEN v_balance / v_cost ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_download_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_download_status() TO authenticated;

-- 3. Descarga con cupo / cobro
CREATE OR REPLACE FUNCTION public.check_and_register_download(p_event_photo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status jsonb;
  v_charged text := 'none';
  v_already boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  -- Una sola descarga a la vez por usuario: cupo y saldo se leen y escriben sin carreras.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 12));

  -- Regla de acceso vigente: cualquier participación distinta de 'Não concluído'.
  IF NOT EXISTS (
    SELECT 1 FROM public.participations
    WHERE user_id = v_user_id AND status <> 'Não concluído'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'participation_required');
  END IF;

  -- La foto debe existir y estar publicada.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_photos
    WHERE id = p_event_photo_id AND status = 'published'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'photo_not_available');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.photo_downloads
    WHERE user_id = v_user_id AND event_photo_id = p_event_photo_id
  ) INTO v_already;

  IF NOT v_already AND NOT public.is_admin() THEN
    IF public.user_is_premium(v_user_id) THEN
      -- Premium: descuenta créditos. Sin saldo suficiente no se registra nada.
      BEGIN
        PERFORM public.apply_credit_movement(
          v_user_id,
          -public.get_photo_credit_cost(),
          'photo_download',
          'event_photo',
          p_event_photo_id::text,
          'download:' || p_event_photo_id::text,
          NULL
        );
        v_charged := 'credits';
      EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'insufficient_credits' THEN
          RAISE;
        END IF;
        RETURN jsonb_build_object(
          'allowed', false,
          'reason', 'insufficient_credits',
          'status', public.get_my_download_status()
        );
      END;
    ELSE
      -- Freemium: usa una de las fotos gratis de la ventana.
      v_status := public.get_my_download_status();
      IF (v_status ->> 'free_remaining')::integer <= 0 THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'reason', 'free_quota_exhausted',
          'status', v_status
        );
      END IF;
      v_charged := 'free';
    END IF;
  END IF;

  INSERT INTO public.photo_downloads (user_id, event_photo_id)
  VALUES (v_user_id, p_event_photo_id)
  ON CONFLICT (user_id, event_photo_id) DO UPDATE
    SET last_downloaded_at = now(),
        download_count = public.photo_downloads.download_count + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'charged', v_charged,
    'status', public.get_my_download_status()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_register_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_register_download(uuid) TO authenticated;
