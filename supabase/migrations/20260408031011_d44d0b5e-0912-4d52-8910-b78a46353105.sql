
-- Fix app_integrations deny policy to RESTRICTIVE
DROP POLICY IF EXISTS "deny_anon_all_app_integrations" ON public.app_integrations;
CREATE POLICY "deny_anon_all_app_integrations" ON public.app_integrations
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- Fix product_pixels deny SELECT to RESTRICTIVE  
DROP POLICY IF EXISTS "deny_anon_select_product_pixels" ON public.product_pixels;
CREATE POLICY "deny_anon_select_product_pixels" ON public.product_pixels
  AS RESTRICTIVE FOR SELECT TO anon USING (false);
