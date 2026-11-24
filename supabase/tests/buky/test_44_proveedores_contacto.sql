\c - postgres
-- El stub local no incluye el campo de sesiones de Supabase Auth.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
\i :sqldir/44_proveedores_contacto.sql
\i :sqldir/44_proveedores_contacto.sql
BEGIN;

INSERT INTO public.users(id,email,name,nickname,role) VALUES
 ('44000000-0000-0000-0000-000000000001','admin44@test','Admin 44','admin44','ADMIN'),
 ('44000000-0000-0000-0000-000000000002','owner44@test','Owner 44','owner44','USUARIO'),
 ('44000000-0000-0000-0000-000000000003','staff44@test','Staff 44','staff44','USUARIO'),
 ('44000000-0000-0000-0000-000000000004','winner44@test','Ana Silva','ana44','USUARIO'),
 ('44000000-0000-0000-0000-000000000005','other44@test','Other 44','other44','USUARIO');
INSERT INTO public.buky_sponsors(id,name,whatsapp,phone,address,contact_email,maps_url) VALUES
 ('44000000-0000-0000-0000-000000000011','Marca 44','+5521999999999','+552133334444','Rua A, 10','loja@test.com','https://maps.google.com/a');
INSERT INTO public.buky_sponsor_members(sponsor_id,user_id,role) VALUES
 ('44000000-0000-0000-0000-000000000011','44000000-0000-0000-0000-000000000002','owner'),
 ('44000000-0000-0000-0000-000000000011','44000000-0000-0000-0000-000000000003','staff');
INSERT INTO public.buky_raffle_periods(id,name,starts_at,ends_at,draw_at)
 VALUES ('44000000-0000-0000-0000-000000000012','Sorteio 44',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days');
INSERT INTO public.buky_coupons(id,period_id,sponsor_id,title,kind,scope)
 VALUES ('44000000-0000-0000-0000-000000000013','44000000-0000-0000-0000-000000000012',
 '44000000-0000-0000-0000-000000000011','Cupom 44','digital','national');
INSERT INTO public.buky_raffle_results(id,period_id,coupon_id,rank,user_id,total_weight,
 candidates,candidates_sha256,delivery_status,redeem_deadline)
 VALUES ('44000000-0000-0000-0000-000000000014','44000000-0000-0000-0000-000000000012',
 '44000000-0000-0000-0000-000000000013',1,'44000000-0000-0000-0000-000000000004',1,
 '[]','hash','notified',now()+interval '1 day');

DO $$ BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
    AND table_name='buky_sponsors' AND column_name IN
      ('whatsapp','phone','address','contact_email','maps_url')) <> 5 THEN
    RAISE EXCEPTION 'missing contact columns';
  END IF;
  BEGIN
    UPDATE public.buky_sponsors SET phone='(21)3333' WHERE id='44000000-0000-0000-0000-000000000011';
    RAISE EXCEPTION 'invalid phone accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.buky_sponsors SET maps_url='javascript:alert(1)' WHERE id='44000000-0000-0000-0000-000000000011';
    RAISE EXCEPTION 'invalid maps URL accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

SET LOCAL ROLE authenticated;
DO $$ DECLARE j jsonb; BEGIN
  PERFORM set_config('request.jwt.claim.sub','44000000-0000-0000-0000-000000000005',true);
  IF public.buky_sponsor_contact('44000000-0000-0000-0000-000000000014') IS NOT NULL THEN
    RAISE EXCEPTION 'other athlete saw contact'; END IF;
  BEGIN
    PERFORM whatsapp FROM public.buky_sponsors LIMIT 1;
    RAISE EXCEPTION 'direct contact read accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.buky_sponsor_redemptions('44000000-0000-0000-0000-000000000011');
    RAISE EXCEPTION 'other athlete saw redemptions';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claim.sub','44000000-0000-0000-0000-000000000004',true);
  IF public.buky_sponsor_contact('44000000-0000-0000-0000-000000000014')->>'phone' <> '+552133334444' THEN
    RAISE EXCEPTION 'winner missing contact'; END IF;

  PERFORM set_config('request.jwt.claim.sub','44000000-0000-0000-0000-000000000003',true);
  IF public.buky_sponsor_contact('44000000-0000-0000-0000-000000000014')->>'phone' IS NULL THEN
    RAISE EXCEPTION 'staff missing contact'; END IF;
  BEGIN
    PERFORM public.buky_sponsor_update_own_data('44000000-0000-0000-0000-000000000011','{}');
    RAISE EXCEPTION 'staff edited contact';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.buky_sponsor_owner_dashboard('44000000-0000-0000-0000-000000000011');
    RAISE EXCEPTION 'staff saw owner coupons';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  j:=public.buky_sponsor_redemptions('44000000-0000-0000-0000-000000000011');
  IF j::text ~* '(email|phone|whatsapp|Ana Silva)' OR j->0->>'username' <> 'ana44' THEN
    RAISE EXCEPTION 'personal data in redemptions: %', j; END IF;

  PERFORM set_config('request.jwt.claim.sub','44000000-0000-0000-0000-000000000002',true);
  PERFORM public.buky_sponsor_update_own_data('44000000-0000-0000-0000-000000000011',
    '{"whatsapp":"+5511999999999","phone":"+552133334444","address":"Rua B, 20","contact_email":"loja@test.com","maps_url":"https://maps.google.com/b"}');
  IF public.buky_sponsor_own_data('44000000-0000-0000-0000-000000000011')->>'address' <> 'Rua B, 20' THEN
    RAISE EXCEPTION 'owner edit failed'; END IF;
  IF jsonb_array_length(public.buky_sponsor_owner_dashboard('44000000-0000-0000-0000-000000000011')->'coupons') <> 1 THEN
    RAISE EXCEPTION 'owner coupon list failed'; END IF;

  PERFORM set_config('request.jwt.claim.sub','44000000-0000-0000-0000-000000000001',true);
  IF public.buky_sponsor_contact('44000000-0000-0000-0000-000000000014')->>'address' <> 'Rua B, 20' THEN
    RAISE EXCEPTION 'admin missing contact'; END IF;
END $$;
ROLLBACK;
