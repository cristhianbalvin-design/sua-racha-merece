BEGIN;
-- La reserva serializa por correo para impedir que solicitudes simultáneas superen el límite.
CREATE TABLE IF NOT EXISTS public.buky_sponsor_access_resends (
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buky_sponsor_access_resends_email_time
  ON public.buky_sponsor_access_resends (email, sent_at);
ALTER TABLE public.buky_sponsor_access_resends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buky_sponsor_access_resends FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.buky_claim_sponsor_access_resend(p_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  DELETE FROM public.buky_sponsor_access_resends WHERE sent_at < now() - interval '1 hour';
  IF (SELECT count(*) FROM public.buky_sponsor_access_resends WHERE email = v_email) >= 3 THEN
    RETURN false;
  END IF;
  INSERT INTO public.buky_sponsor_access_resends (email) VALUES (v_email);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.buky_claim_sponsor_access_resend(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buky_claim_sponsor_access_resend(text) TO service_role;
COMMIT;
