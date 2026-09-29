CREATE OR REPLACE FUNCTION public.get_public_products(
  _slug text DEFAULT NULL,
  _ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  price numeric,
  status text,
  image_url text,
  checkout_url text,
  checkout_pix_enabled boolean,
  checkout_boleto_enabled boolean,
  checkout_credit_card_enabled boolean,
  checkout_timer_enabled boolean,
  checkout_timer_minutes integer,
  checkout_social_proof boolean,
  checkout_guarantee_enabled boolean,
  checkout_address_required boolean,
  checkout_email_confirm boolean,
  checkout_button_color text,
  checkout_banner_desktop_url text,
  checkout_banner_mobile_url text,
  checkout_theme text,
  created_at timestamptz,
  support_email text,
  display_name text,
  delivery_type text,
  affiliate_enabled boolean,
  affiliate_commission numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _safe_slug text := trim(COALESCE(_slug, ''));
BEGIN
  IF _slug IS NULL AND (_ids IS NULL OR cardinality(_ids) = 0) THEN
    RETURN;
  END IF;
  IF _slug IS NOT NULL AND (_safe_slug = '' OR _safe_slug !~ '^[A-Za-z0-9_-]+$') THEN
    RETURN;
  END IF;
  IF _ids IS NOT NULL AND cardinality(_ids) > 20 THEN
    RAISE EXCEPTION 'No máximo 20 produtos podem ser consultados';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.description, p.price, p.status, p.image_url, p.checkout_url,
         COALESCE(p.checkout_pix_enabled, false) AND COALESCE(pr.pix_enabled, false),
         COALESCE(p.checkout_boleto_enabled, false) AND COALESCE(pr.boleto_enabled, false),
         COALESCE(p.checkout_credit_card_enabled, false) AND COALESCE(pr.credit_card_enabled, false),
         p.checkout_timer_enabled, p.checkout_timer_minutes, p.checkout_social_proof,
         p.checkout_guarantee_enabled, p.checkout_address_required, p.checkout_email_confirm,
         p.checkout_button_color, p.checkout_banner_desktop_url, p.checkout_banner_mobile_url,
         p.checkout_theme, p.created_at, p.support_email, p.display_name, p.delivery_type,
         p.affiliate_enabled, p.affiliate_commission
  FROM public.products p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.status = 'active' AND p.deleted_at IS NULL
    AND (
      (_slug IS NOT NULL AND (
        p.checkout_url = _safe_slug OR p.checkout_url = '/' || _safe_slug OR
        p.checkout_url LIKE '%/pay/' || _safe_slug OR p.checkout_url LIKE '%/checkout/' || _safe_slug
      ))
      OR (_ids IS NOT NULL AND p.id = ANY(_ids))
    )
  ORDER BY p.created_at DESC
  LIMIT CASE WHEN _slug IS NOT NULL THEN 1 ELSE 20 END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_products(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_products(text, uuid[]) TO anon, authenticated, service_role;

REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.products_public FROM anon;
DROP POLICY IF EXISTS public_can_view_active_products ON public.products;
DROP POLICY IF EXISTS public_can_read_payment_permissions ON public.profiles;