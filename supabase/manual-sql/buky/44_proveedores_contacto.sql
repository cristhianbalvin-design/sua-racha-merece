-- Paso 44: contacto privado y portal de proveedores. Reejecutable.
BEGIN;

ALTER TABLE public.buky_sponsors
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS maps_url text;

ALTER TABLE public.buky_sponsors DROP CONSTRAINT IF EXISTS buky_sponsors_whatsapp_check;
ALTER TABLE public.buky_sponsors ADD CONSTRAINT buky_sponsors_whatsapp_check
  CHECK (whatsapp IS NULL OR whatsapp ~ '^\+?[0-9]{8,15}$');
ALTER TABLE public.buky_sponsors DROP CONSTRAINT IF EXISTS buky_sponsors_phone_check;
ALTER TABLE public.buky_sponsors ADD CONSTRAINT buky_sponsors_phone_check
  CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$');
ALTER TABLE public.buky_sponsors DROP CONSTRAINT IF EXISTS buky_sponsors_address_check;
ALTER TABLE public.buky_sponsors ADD CONSTRAINT buky_sponsors_address_check
  CHECK (address IS NULL OR char_length(btrim(address)) BETWEEN 3 AND 300);
ALTER TABLE public.buky_sponsors DROP CONSTRAINT IF EXISTS buky_sponsors_contact_email_check;
ALTER TABLE public.buky_sponsors ADD CONSTRAINT buky_sponsors_contact_email_check
  CHECK (contact_email IS NULL OR (char_length(contact_email) <= 254 AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
ALTER TABLE public.buky_sponsors DROP CONSTRAINT IF EXISTS buky_sponsors_maps_url_check;
ALTER TABLE public.buky_sponsors ADD CONSTRAINT buky_sponsors_maps_url_check
  CHECK (maps_url IS NULL OR (char_length(maps_url) <= 2048 AND maps_url ~* '^https?://[^[:space:]]+$'));

-- RLS limita filas, no columnas. La lectura directa sólo ofrece campos públicos.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.buky_sponsors FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, logo_url, instagram, website, city_code, active, created_at)
  ON public.buky_sponsors TO authenticated;

CREATE OR REPLACE FUNCTION public.buky_sponsor_contact(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object('name', s.name, 'whatsapp', s.whatsapp,
    'phone', s.phone, 'address', s.address, 'contact_email', s.contact_email,
    'maps_url', s.maps_url, 'instagram', s.instagram, 'website', s.website)
    INTO v
  FROM public.buky_raffle_results r
  JOIN public.buky_coupons c ON c.id = r.coupon_id
  JOIN public.buky_sponsors s ON s.id = c.sponsor_id
  WHERE r.id = p_result_id AND (
    coalesce(public.is_admin(), false)
    OR EXISTS (SELECT 1 FROM public.buky_sponsor_members m
      WHERE m.sponsor_id = s.id AND m.user_id = auth.uid() AND m.revoked_at IS NULL)
    OR (r.user_id = auth.uid() AND r.delivery_status IN ('pending', 'notified')
      AND r.redeem_deadline >= now())
  );
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.buky_sponsor_own_data(p_sponsor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.buky_sponsor_members m
    JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
    WHERE m.sponsor_id=p_sponsor_id AND m.user_id=auth.uid()
      AND m.revoked_at IS NULL AND m.role='owner') THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object('id', id, 'name', name, 'whatsapp', whatsapp,
    'phone', phone, 'address', address, 'contact_email', contact_email,
    'maps_url', maps_url, 'instagram', instagram, 'website', website,
    'logo_url', logo_url) INTO v
  FROM public.buky_sponsors WHERE id=p_sponsor_id;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.buky_my_sponsor_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id,
    'name', s.name, 'role', m.role) ORDER BY s.name)
    FROM public.buky_sponsor_members m
    JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
    WHERE m.user_id=auth.uid() AND m.revoked_at IS NULL), '[]'::jsonb);
END $$;

-- El resumen legado exponía cupones a staff. Sólo el owner puede abrirlo ahora.
REVOKE ALL ON FUNCTION public.buky_sponsor_dashboard(uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.buky_sponsor_owner_dashboard(p_sponsor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.buky_sponsor_members m
    JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
    WHERE m.sponsor_id=p_sponsor_id AND m.user_id=auth.uid()
      AND m.revoked_at IS NULL AND m.role='owner') THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE='42501';
  END IF;
  RETURN public.buky_sponsor_dashboard(p_sponsor_id) - 'redemptions';
END $$;

CREATE OR REPLACE FUNCTION public.buky_sponsor_update_own_data(p_sponsor_id uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.buky_sponsor_members m
    JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
    WHERE m.sponsor_id=p_sponsor_id AND m.user_id=auth.uid()
      AND m.revoked_at IS NULL AND m.role='owner') THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE='42501';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR p_data ?| ARRAY['id','name','active','city_code','created_at'] THEN
    RAISE EXCEPTION 'invalid_fields' USING ERRCODE='22023';
  END IF;
  UPDATE public.buky_sponsors SET
    whatsapp=NULLIF(btrim(p_data->>'whatsapp'), ''),
    phone=NULLIF(btrim(p_data->>'phone'), ''),
    address=NULLIF(btrim(p_data->>'address'), ''),
    contact_email=NULLIF(btrim(p_data->>'contact_email'), ''),
    maps_url=NULLIF(btrim(p_data->>'maps_url'), ''),
    instagram=NULLIF(btrim(p_data->>'instagram'), ''),
    website=NULLIF(btrim(p_data->>'website'), ''),
    logo_url=NULLIF(btrim(p_data->>'logo_url'), '')
  WHERE id=p_sponsor_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_buky_sponsors()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object(
    'active_members', (SELECT count(*) FROM public.buky_sponsor_members m
      WHERE m.sponsor_id=s.id AND m.revoked_at IS NULL),
    'pending_invites', (SELECT count(*) FROM public.buky_sponsor_members m
      LEFT JOIN auth.users au ON au.id=m.user_id
      WHERE m.sponsor_id=s.id AND m.revoked_at IS NULL
        AND (au.id IS NULL OR au.last_sign_in_at IS NULL))) ORDER BY s.name)
    FROM public.buky_sponsors s), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_buky_sponsor_save(p_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR
     coalesce(char_length(btrim(p_data->>'name')) BETWEEN 2 AND 80, false) IS FALSE THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.buky_sponsors(id, name, logo_url, instagram, website, city_code,
    active, whatsapp, phone, address, contact_email, maps_url)
  VALUES (coalesce(p_id, gen_random_uuid()), btrim(p_data->>'name'),
    NULLIF(btrim(p_data->>'logo_url'), ''), NULLIF(btrim(p_data->>'instagram'), ''),
    NULLIF(btrim(p_data->>'website'), ''), (p_data->>'city_code')::integer,
    coalesce((p_data->>'active')::boolean, true),
    NULLIF(btrim(p_data->>'whatsapp'), ''), NULLIF(btrim(p_data->>'phone'), ''),
    NULLIF(btrim(p_data->>'address'), ''), NULLIF(btrim(p_data->>'contact_email'), ''),
    NULLIF(btrim(p_data->>'maps_url'), ''))
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, logo_url=EXCLUDED.logo_url,
    instagram=EXCLUDED.instagram, website=EXCLUDED.website, city_code=EXCLUDED.city_code,
    active=EXCLUDED.active, whatsapp=EXCLUDED.whatsapp, phone=EXCLUDED.phone,
    address=EXCLUDED.address, contact_email=EXCLUDED.contact_email, maps_url=EXCLUDED.maps_url
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.buky_sponsor_redemptions(p_sponsor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.buky_sponsor_members m
    JOIN public.buky_sponsors s ON s.id=m.sponsor_id AND s.active
    WHERE m.sponsor_id=p_sponsor_id AND m.user_id=auth.uid() AND m.revoked_at IS NULL)
    AND NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('date', x.date,
    'prize', x.prize, 'initials', x.initials, 'username', x.username,
    'status', x.status) ORDER BY x.date DESC)
    FROM (SELECT coalesce(r.redeemed_at,r.delivered_at,r.drawn_at) AS date,
      k.title AS prize,
      (SELECT string_agg(upper(left(part,1)), '') FROM unnest(regexp_split_to_array(btrim(u.name), '\s+')) AS part) AS initials,
      u.nickname AS username,
      CASE WHEN r.delivery_status='delivered' THEN 'resgatado'
           WHEN r.delivery_status='expired' OR r.redeem_deadline < now() THEN 'vencido'
           ELSE 'pendente' END AS status
    FROM public.buky_raffle_results r
    JOIN public.buky_coupons k ON k.id=r.coupon_id
    JOIN public.users u ON u.id=r.user_id
    WHERE k.sponsor_id=p_sponsor_id AND r.delivery_status <> 'standby'
    ORDER BY coalesce(r.redeemed_at,r.delivered_at,r.drawn_at) DESC LIMIT 100) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_buky_sponsor_team(p_sponsor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id,
    'name', u.name, 'email', u.email, 'role', m.role,
    'revoked_at', m.revoked_at,
    'status', CASE WHEN m.revoked_at IS NOT NULL THEN 'revogado'
      WHEN au.id IS NULL OR au.last_sign_in_at IS NULL THEN 'convidado' ELSE 'ativo' END)
    ORDER BY m.created_at)
    FROM public.buky_sponsor_members m
    JOIN public.users u ON u.id=m.user_id
    LEFT JOIN auth.users au ON au.id=m.user_id
    WHERE m.sponsor_id=p_sponsor_id), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.buky_sponsor_contact(uuid),
  public.buky_sponsor_own_data(uuid), public.buky_my_sponsor_access(),
  public.buky_sponsor_owner_dashboard(uuid),
  public.buky_sponsor_update_own_data(uuid,jsonb),
  public.admin_buky_sponsors(), public.admin_buky_sponsor_save(uuid,jsonb),
  public.buky_sponsor_redemptions(uuid), public.admin_buky_sponsor_team(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buky_sponsor_contact(uuid),
  public.buky_sponsor_own_data(uuid), public.buky_my_sponsor_access(),
  public.buky_sponsor_owner_dashboard(uuid),
  public.buky_sponsor_update_own_data(uuid,jsonb),
  public.admin_buky_sponsors(), public.admin_buky_sponsor_save(uuid,jsonb),
  public.buky_sponsor_redemptions(uuid), public.admin_buky_sponsor_team(uuid)
  TO authenticated;
COMMIT;
