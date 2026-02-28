
-- FIX REGRESSION: order_bumps and product_pixels need anon SELECT for public checkout
-- Drop the overly aggressive deny-all policies and replace with write-only deny

-- order_bumps: allow anon SELECT (needed for checkout page) but deny writes
DROP POLICY IF EXISTS "deny_anon_all_order_bumps" ON public.order_bumps;
CREATE POLICY "deny_anon_write_order_bumps" ON public.order_bumps
  AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "deny_anon_update_order_bumps" ON public.order_bumps
  AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_order_bumps" ON public.order_bumps
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- product_pixels: allow anon SELECT (needed for checkout pixel tracking) but deny writes
DROP POLICY IF EXISTS "deny_anon_all_product_pixels" ON public.product_pixels;
CREATE POLICY "deny_anon_write_product_pixels" ON public.product_pixels
  AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "deny_anon_update_product_pixels" ON public.product_pixels
  AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_product_pixels" ON public.product_pixels
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- Add permissive SELECT for anon on product_pixels (needed for checkout tracking)
-- Only expose non-sensitive fields via the existing policy structure
CREATE POLICY "anon_read_active_pixels" ON public.product_pixels
  AS PERMISSIVE FOR SELECT TO anon USING (is_active = true);
