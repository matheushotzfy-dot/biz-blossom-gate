
-- ============================================================
-- SECURITY FIX ROUND 2: Protect courses, modules, lessons, order_bumps
-- ============================================================

-- CRITICAL: courses - deny anon, only authenticated users see published courses
CREATE POLICY "deny_anon_all_courses" ON public.courses
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- CRITICAL: modules - deny anon access
CREATE POLICY "deny_anon_all_modules" ON public.modules
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- CRITICAL: lessons - deny anon access (prevents free access to paid content)
CREATE POLICY "deny_anon_all_lessons" ON public.lessons
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: order_bumps - deny anon access
CREATE POLICY "deny_anon_all_order_bumps" ON public.order_bumps
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- CRITICAL: Hide user_id from products public view by recreating it without user_id
-- Note: We can't easily alter the view's RLS but we can add a restrictive policy
-- to the base products table to block anon from seeing user_id
-- Actually, products needs to remain publicly readable for checkout pages.
-- The fix is to ensure the public view doesn't expose user_id.
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public AS
  SELECT 
    id, name, description, price, image_url, status,
    checkout_url, checkout_pix_enabled, checkout_credit_card_enabled,
    checkout_boleto_enabled, checkout_button_color, checkout_timer_enabled,
    checkout_timer_minutes, checkout_social_proof, checkout_guarantee_enabled,
    checkout_email_confirm, checkout_address_required,
    checkout_banner_desktop_url, checkout_banner_mobile_url,
    created_at
  FROM public.products
  WHERE status = 'active';

-- Grant access to the new view
GRANT SELECT ON public.products_public TO anon;
GRANT SELECT ON public.products_public TO authenticated;
