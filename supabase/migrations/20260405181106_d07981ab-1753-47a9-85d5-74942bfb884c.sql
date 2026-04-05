
-- Fix subscriptions: change sellers policy from {public} to {authenticated}
DROP POLICY IF EXISTS "Sellers view own subscriptions" ON public.subscriptions;
CREATE POLICY "Sellers view own subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (auth.uid() = seller_user_id);

-- Add admin access to subscriptions
CREATE POLICY "Admins manage all subscriptions"
ON public.subscriptions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add anon denial policies for subscriptions
CREATE POLICY "deny_anon_all_subscriptions"
ON public.subscriptions FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Fix security definer views by recreating with security_invoker = true
-- products_public
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public WITH (security_invoker = true) AS
SELECT id, name, description, price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  created_at, support_email, display_name, delivery_type
FROM products WHERE status = 'active';

-- product_pixels_public
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public WITH (security_invoker = true) AS
SELECT id, product_id, platform, pixel_id, is_active, events,
  fire_on_boleto, fire_on_pix_qr, boleto_conversion_value, pix_conversion_value,
  disable_bump_events, domain
FROM product_pixels;

-- affiliate_links_public
DROP VIEW IF EXISTS public.affiliate_links_public;
CREATE VIEW public.affiliate_links_public WITH (security_invoker = true) AS
SELECT slug, product_id
FROM affiliate_links WHERE is_active = true;

-- Ensure anon can read active products (needed for checkout)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Anon can view active products') THEN
    CREATE POLICY "Anon can view active products"
    ON public.products FOR SELECT TO anon
    USING (status = 'active');
  END IF;
END $$;

-- Ensure anon can read product_pixels for active products
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_pixels' AND policyname = 'Anon can view pixels for active products') THEN
    CREATE POLICY "Anon can view pixels for active products"
    ON public.product_pixels FOR SELECT TO anon
    USING (is_active = true AND is_product_active(product_id));
  END IF;
END $$;

-- Ensure anon can read active affiliate links
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_links' AND policyname = 'Anon can view active affiliate links') THEN
    CREATE POLICY "Anon can view active affiliate links"
    ON public.affiliate_links FOR SELECT TO anon
    USING (is_active = true);
  END IF;
END $$;
