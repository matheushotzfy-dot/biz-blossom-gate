REVOKE ALL ON FUNCTION public.check_signup_conflicts(text, text, text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "revenue_races_read_all" ON public.revenue_races;
CREATE POLICY "revenue_races_read_active_or_admin"
ON public.revenue_races FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "revenue_race_prizes_read_all" ON public.revenue_race_prizes;
CREATE POLICY "revenue_race_prizes_read_active_or_admin"
ON public.revenue_race_prizes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.revenue_races r
    WHERE r.id = revenue_race_prizes.race_id AND r.is_active = true
  )
);

DROP POLICY IF EXISTS "race_overrides_read_all" ON public.revenue_race_overrides;
DROP POLICY IF EXISTS "race_overrides_read_authenticated" ON public.revenue_race_overrides;
DROP POLICY IF EXISTS "race_overrides_read_admin" ON public.revenue_race_overrides;
CREATE POLICY "race_overrides_read_admin"
ON public.revenue_race_overrides FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.race_leaderboard(_race_id uuid)
RETURNS TABLE (
  seller_id uuid,
  seller_name text,
  seller_avatar text,
  revenue_cents bigint,
  sales_count bigint,
  rank_position bigint,
  is_manual boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH race AS (
    SELECT starts_at, ends_at
    FROM public.revenue_races
    WHERE id = _race_id
      AND (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role))
  ),
  real_agg AS (
    SELECT t.user_id AS seller_id,
      COALESCE(SUM(t.net_amount)::bigint, 0) AS exact_revenue_cents,
      COUNT(*)::bigint AS exact_sales_count
    FROM public.transactions t, race
    WHERE t.status IN ('completed', 'approved', 'paid')
      AND t.created_at >= race.starts_at
      AND t.created_at <= race.ends_at
      AND t.user_id IS NOT NULL
    GROUP BY t.user_id
  ),
  merged AS (
    SELECT o.seller_id,
      COALESCE(o.display_name, p.nickname, p.full_name, 'Seller') AS seller_name,
      COALESCE(o.avatar_url, p.avatar_url) AS seller_avatar,
      o.revenue_cents AS exact_revenue_cents,
      o.sales_count AS exact_sales_count,
      true AS is_manual,
      o.id::text AS sort_key
    FROM public.revenue_race_overrides o
    LEFT JOIN public.profiles p ON p.user_id = o.seller_id
    WHERE o.race_id = _race_id AND o.seller_id IS NOT NULL AND EXISTS (SELECT 1 FROM race)
    UNION ALL
    SELECT NULL::uuid, o.display_name, o.avatar_url, o.revenue_cents, o.sales_count, true, o.id::text
    FROM public.revenue_race_overrides o
    WHERE o.race_id = _race_id AND o.seller_id IS NULL AND EXISTS (SELECT 1 FROM race)
    UNION ALL
    SELECT a.seller_id,
      COALESCE(p.nickname, p.full_name, 'Seller'),
      p.avatar_url,
      a.exact_revenue_cents,
      a.exact_sales_count,
      false,
      a.seller_id::text
    FROM real_agg a
    LEFT JOIN public.profiles p ON p.user_id = a.seller_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.revenue_race_overrides o2
      WHERE o2.race_id = _race_id AND o2.seller_id = a.seller_id
    )
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY exact_revenue_cents DESC, sort_key)::bigint AS position
    FROM merged
  )
  SELECT seller_id, seller_name, seller_avatar,
    CASE
      WHEN seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
        THEN exact_revenue_cents
      ELSE (exact_revenue_cents / 100000) * 100000
    END AS revenue_cents,
    CASE
      WHEN seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
        THEN exact_sales_count
      ELSE 0::bigint
    END AS sales_count,
    position AS rank_position,
    is_manual
  FROM ranked
  ORDER BY position
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.race_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_leaderboard(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_payment_link_clicks(_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean;
BEGIN
  IF _slug IS NULL OR length(_slug) < 3 OR length(_slug) > 160 THEN RETURN; END IF;
  SELECT allowed INTO _allowed
  FROM public.bump_rate_limit('payment_link_click:' || lower(_slug), 60, 300)
  LIMIT 1;
  IF COALESCE(_allowed, false) THEN
    UPDATE public.payment_links
    SET clicks = COALESCE(clicks, 0) + 1
    WHERE slug = _slug AND is_active = true;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_payment_link_clicks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_payment_link_clicks(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _product_id uuid, _amount numeric)
RETURNS TABLE(valid boolean, coupon_id uuid, discount_amount numeric, discount_type text, discount_value numeric, apply_to_bumps boolean, error text)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _coupon record;
  _discount numeric := 0;
  _allowed boolean;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 OR length(trim(_code)) > 80 OR _amount IS NULL OR _amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  SELECT allowed INTO _allowed
  FROM public.bump_rate_limit('coupon:' || _product_id::text || ':' || md5(lower(trim(_code))), 60, 120)
  LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Tente novamente em instantes'; RETURN;
  END IF;
  SELECT user_id INTO _owner FROM public.products WHERE id = _product_id AND status = 'active' LIMIT 1;
  IF _owner IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  SELECT * INTO _coupon FROM public.coupons
  WHERE user_id = _owner AND upper(code) = upper(trim(_code)) AND is_active = true LIMIT 1;
  IF _coupon IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom expirado'; RETURN;
  END IF;
  IF _coupon.max_uses IS NOT NULL AND _coupon.current_uses >= _coupon.max_uses THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom esgotado'; RETURN;
  END IF;
  IF _coupon.product_id IS NOT NULL AND _coupon.product_id <> _product_id THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  IF _coupon.discount_type = 'percentage' THEN
    _discount := round((_amount * _coupon.discount_value / 100)::numeric, 2);
  ELSE
    _discount := _coupon.discount_value;
  END IF;
  _discount := greatest(least(_discount, _amount - 0.01), 0);
  RETURN QUERY SELECT true, _coupon.id, _discount, _coupon.discount_type, _coupon.discount_value, _coupon.apply_to_bumps, NULL::text;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_coupon(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "pl_covers_read_linked_or_owner" ON storage.objects;
CREATE POLICY "pl_covers_read_linked_or_owner"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'payment-link-covers'
  AND (
    (auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1])
    OR EXISTS (
      SELECT 1 FROM public.payment_links pl
      WHERE pl.is_active = true
        AND right(pl.cover_url, length(storage.objects.name) + 1) = '/' || storage.objects.name
    )
  )
);

DROP POLICY IF EXISTS "Users can upload own KYC docs" ON storage.objects;
CREATE POLICY "Users can upload own KYC docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can view own KYC docs" ON storage.objects;
CREATE POLICY "Users can view own KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can update own KYC docs" ON storage.objects;
CREATE POLICY "Users can update own KYC docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can delete own KYC docs" ON storage.objects;
CREATE POLICY "Users can delete own KYC docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Admins can view all KYC docs" ON storage.objects;
CREATE POLICY "Admins can view all KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.admin_reveal_profile(_user_id uuid)
RETURNS TABLE (user_id uuid, document_number text, pix_key text, pix_key_type text)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'profile', _user_id::text,
    jsonb_build_object('fields', jsonb_build_array('document_number', 'pix_key')));
  RETURN QUERY
  SELECT p.user_id, p.document_number,
    COALESCE(extensions.pgp_sym_decrypt(p.pix_key_enc, encode(app_private.get_key('field_v1'), 'hex')), p.pix_key),
    p.pix_key_type
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_profile(uuid) TO authenticated, service_role;