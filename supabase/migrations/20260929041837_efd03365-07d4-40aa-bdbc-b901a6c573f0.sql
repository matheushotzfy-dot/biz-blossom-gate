ALTER VIEW public.products_public SET (security_invoker = true);

DROP POLICY IF EXISTS public_can_view_active_products ON public.products;
CREATE POLICY public_can_view_active_products
ON public.products
FOR SELECT
TO anon
USING (status = 'active' AND deleted_at IS NULL);

REVOKE ALL ON public.products FROM anon;
GRANT SELECT (
  id, name, description, price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  checkout_theme, created_at, support_email, display_name, delivery_type,
  affiliate_enabled, affiliate_commission, deleted_at, user_id
) ON public.products TO anon;

GRANT SELECT (user_id, pix_enabled, boleto_enabled, credit_card_enabled)
ON public.profiles TO anon;

DROP POLICY IF EXISTS public_can_read_payment_permissions ON public.profiles;
CREATE POLICY public_can_read_payment_permissions
ON public.profiles
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = profiles.user_id
      AND p.status = 'active'
      AND p.deleted_at IS NULL
  )
);
