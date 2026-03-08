
-- 1. Fix: Block anonymous SELECT on product_pixels (api_token exposure)
CREATE POLICY "deny_anon_select_product_pixels"
ON public.product_pixels
FOR SELECT
TO anon
USING (false);

-- 2. Fix: Remove seller direct access to disputes base table (use view instead)
DROP POLICY IF EXISTS "Sellers can view own disputes" ON public.disputes;

-- 3. Re-create seller dispute access through the masked view only
CREATE POLICY "Sellers view disputes via view only"
ON public.disputes
FOR SELECT
TO authenticated
USING (
  (auth.uid() = seller_user_id) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Enable leaked password protection
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
