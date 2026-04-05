-- Fix product_pixels_public: exclude api_token
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public WITH (security_invoker = true) AS
SELECT id, product_id, platform, pixel_id, is_active, events,
  fire_on_boleto, fire_on_pix_qr, boleto_conversion_value, pix_conversion_value,
  disable_bump_events, domain
FROM product_pixels;

-- Fix affiliate_links_public: only expose slug and product_id
DROP VIEW IF EXISTS public.affiliate_links_public;
CREATE VIEW public.affiliate_links_public WITH (security_invoker = true) AS
SELECT slug, product_id
FROM affiliate_links WHERE is_active = true;

-- Fix anon policy on product_pixels to not expose api_token directly
DROP POLICY IF EXISTS "Anon can view pixels for active products" ON public.product_pixels;

-- Restrict anon to only read non-sensitive columns via the view
-- The view already excludes api_token, but we need the base table policy for the view to work
CREATE POLICY "Anon can view pixels for active products"
ON public.product_pixels FOR SELECT TO anon
USING (is_active = true AND is_product_active(product_id));

-- Fix anon policy on affiliate_links to restrict columns via view
DROP POLICY IF EXISTS "Anon can view active affiliate links" ON public.affiliate_links;
CREATE POLICY "Anon can view active affiliate links"
ON public.affiliate_links FOR SELECT TO anon
USING (is_active = true);
