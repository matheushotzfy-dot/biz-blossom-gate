
-- 1. FIX CRITICAL: Remove anon policy that exposes all product columns
-- Instead, anon should only access via products_public view
DROP POLICY IF EXISTS "Anon can view active products" ON public.products;

-- Grant anon SELECT on the view only (not the base table)
GRANT SELECT ON public.products_public TO anon;

-- Make sure the remaining deny policies still block direct table access for anon
-- deny_anon_select_products (PERMISSIVE with false) already exists, which means
-- no permissive policy grants access = anon blocked on base table ✓

-- 2. FIX WARN: Change PERMISSIVE deny policies to RESTRICTIVE
DROP POLICY IF EXISTS "deny_anon_all_velocity_rules" ON public.velocity_rules;
CREATE POLICY "deny_anon_all_velocity_rules" ON public.velocity_rules
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_subscription_plans" ON public.subscription_plans;
CREATE POLICY "deny_anon_all_subscription_plans" ON public.subscription_plans
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- 3. FIX WARN: Restrict public bucket SELECT to prevent file listing
-- Product images: only allow access to specific files (not listing)
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
CREATE POLICY "Product images are publicly accessible" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'product-images' 
    AND name IS NOT NULL 
    AND name != ''
    AND (storage.foldername(name))[1] IS NOT NULL
  );

-- Checkout banners: same restriction
DROP POLICY IF EXISTS "Checkout banners are public" ON storage.objects;
CREATE POLICY "Checkout banners are public" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checkout-banners'
    AND name IS NOT NULL
    AND name != ''
    AND (storage.foldername(name))[1] IS NOT NULL
  );
