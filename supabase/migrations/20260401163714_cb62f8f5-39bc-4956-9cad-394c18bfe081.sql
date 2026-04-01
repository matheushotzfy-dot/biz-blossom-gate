
-- =============================================
-- 1. admin_2fa_codes: deny all client access
-- =============================================
ALTER TABLE public.admin_2fa_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_select_2fa_codes"
ON public.admin_2fa_codes FOR SELECT
TO authenticated, anon
USING (false);

CREATE POLICY "deny_insert_2fa_codes"
ON public.admin_2fa_codes FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "deny_update_2fa_codes"
ON public.admin_2fa_codes FOR UPDATE
TO authenticated, anon
USING (false);

CREATE POLICY "deny_delete_2fa_codes"
ON public.admin_2fa_codes FOR DELETE
TO authenticated, anon
USING (false);

-- =============================================
-- 2. Fix Security Definer Views → SECURITY INVOKER
-- =============================================

-- 2a. disputes_seller
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller
WITH (security_invoker = true)
AS
SELECT 
  id,
  seller_user_id,
  transaction_id,
  type,
  status,
  amount,
  reason,
  created_at,
  updated_at,
  resolved_at,
  CASE WHEN buyer_name IS NOT NULL THEN left(buyer_name, 2) || '***' ELSE NULL END AS buyer_name_masked,
  CASE WHEN buyer_email IS NOT NULL THEN left(split_part(buyer_email, '@', 1), 2) || '***@' || split_part(buyer_email, '@', 2) ELSE NULL END AS buyer_email_masked,
  CASE WHEN buyer_phone IS NOT NULL THEN left(buyer_phone, 4) || '****' ELSE NULL END AS buyer_phone_masked
FROM public.disputes
WHERE seller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role);

-- 2b. products_public
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public
WITH (security_invoker = true)
AS
SELECT 
  id, name, description, price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  created_at, support_email, display_name, delivery_type
FROM public.products
WHERE status = 'active';

-- 2c. product_pixels_public  
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public
WITH (security_invoker = true)
AS
SELECT 
  id, product_id, platform, pixel_id, is_active, events,
  fire_on_boleto, fire_on_pix_qr, boleto_conversion_value,
  pix_conversion_value, disable_bump_events, domain
FROM public.product_pixels;

-- 2d. webhook_configs_safe
DROP VIEW IF EXISTS public.webhook_configs_safe;
CREATE VIEW public.webhook_configs_safe
WITH (security_invoker = true)
AS
SELECT 
  id, user_id, url, events, is_active, created_at, updated_at,
  CASE WHEN secret IS NOT NULL THEN left(secret, 4) || '****' ELSE NULL END AS secret_masked
FROM public.webhook_configs
WHERE user_id = auth.uid();

-- =============================================
-- 3. Fix affiliate_links public policy
-- =============================================
DROP POLICY IF EXISTS "Public read active affiliate links" ON public.affiliate_links;

-- Restrict public access to only slug + product_id (needed for checkout resolution)
CREATE POLICY "Public read active affiliate links (restricted)"
ON public.affiliate_links
FOR SELECT
TO anon
USING (is_active = true);

-- Note: The anon role can only see columns exposed through the API.
-- To truly restrict columns, we create a public view:
CREATE OR REPLACE VIEW public.affiliate_links_public
WITH (security_invoker = true)
AS
SELECT slug, product_id
FROM public.affiliate_links
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.affiliate_links_public TO anon, authenticated;
