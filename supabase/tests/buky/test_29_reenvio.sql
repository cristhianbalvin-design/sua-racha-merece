\i :sqldir/29_reenvio_acceso.sql
BEGIN;
DO $$
BEGIN
  IF NOT public.buky_claim_sponsor_access_resend('Teste@Example.com') OR
     NOT public.buky_claim_sponsor_access_resend('teste@example.com') OR
     NOT public.buky_claim_sponsor_access_resend('teste@example.com') OR
     public.buky_claim_sponsor_access_resend('teste@example.com') THEN
    RAISE EXCEPTION 'El límite de reenvíos no funciona';
  END IF;
  UPDATE public.buky_sponsor_access_resends SET sent_at = now() - interval '61 minutes';
  IF NOT public.buky_claim_sponsor_access_resend('teste@example.com') THEN
    RAISE EXCEPTION 'El límite no se restablece después de una hora';
  END IF;
END $$;
ROLLBACK;
