-- Fix deny_anon policies on products: convert from PERMISSIVE/false (no-op) to RESTRICTIVE/false (real deny)
DROP POLICY IF EXISTS "deny_anon_select_products" ON public.products;
DROP POLICY IF EXISTS "deny_anon_update_products" ON public.products;
DROP POLICY IF EXISTS "deny_anon_delete_products" ON public.products;
DROP POLICY IF EXISTS "deny_anon_all_affiliate_sales" ON public.affiliate_sales;
DROP POLICY IF EXISTS "deny_anon_all_co_productions" ON public.co_productions;

CREATE POLICY "deny_anon_select_products" ON public.products AS RESTRICTIVE FOR SELECT TO anon USING (false);
CREATE POLICY "deny_anon_update_products" ON public.products AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_products" ON public.products AS RESTRICTIVE FOR DELETE TO anon USING (false);
CREATE POLICY "deny_anon_all_affiliate_sales" ON public.affiliate_sales AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_all_co_productions" ON public.co_productions AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);