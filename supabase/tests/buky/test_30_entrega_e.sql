-- Contrato de privacidad, contacto y contador de la Entrega E.
\c - postgres
\i :sqldir/30_entrega_e.sql
\i :sqldir/../fase1/09_proteger_columnas_users.sql
DROP TRIGGER IF EXISTS test_protect_users ON public.users;
CREATE TRIGGER test_protect_users BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_sensitive_columns();
DO $$
BEGIN
  IF public.buky_initials('Jesús Eddgar Balvin') <> 'JB' OR public.buky_initials('ana') <> 'A' THEN
    RAISE EXCEPTION 'iniciales incorrectas';
  END IF;
  IF public.buky_nickname_valid('x') OR public.buky_nickname_valid('porra') OR NOT public.buky_nickname_valid('Capitão') THEN
    RAISE EXCEPTION 'validación de apodo incorrecta';
  END IF;
  BEGIN
    UPDATE public.users SET whatsapp = '123' WHERE id = '26000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'whatsapp inválido aceptado';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Un teléfono antiguo en formato libre no debe impedir otros cambios del usuario (la web lo guarda así)
  UPDATE public.users SET phone = '21999998888', nickname = 'Velho' WHERE id = '26000000-0000-0000-0000-000000000001';
  BEGIN
    UPDATE public.users SET nickname = '!' WHERE id = '26000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'apodo inválido aceptado';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
\c - authenticator
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);
UPDATE public.users SET nickname = 'Capitão', phone = '+5521999999999', whatsapp = '+552133334444', role = 'ADMIN'
  WHERE id = auth.uid();
DO $$
DECLARE r jsonb; u public.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = auth.uid();
  IF u.nickname <> 'Capitão' OR u.phone <> '+5521999999999' OR u.whatsapp <> '+552133334444' OR u.role = 'ADMIN' THEN
    RAISE EXCEPTION 'protección o campos editables incorrectos';
  END IF;
  r := public.buky_city_ranking(3302700);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'top') x WHERE x ? 'name' OR NOT (x ? 'initials' AND x ? 'nickname')) THEN
    RAISE EXCEPTION 'ranking expone nombre o faltan campos';
  END IF;
  IF (public.buky_my_counters()->>'sorteios')::int <> (SELECT count(DISTINCT period_id) FROM public.buky_entries WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'contador incorrecto';
  END IF;
END $$;
ROLLBACK;
