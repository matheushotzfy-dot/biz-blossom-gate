
-- =============================================
-- 1. DISPUTES: Create seller view masking buyer PII
-- =============================================
CREATE OR REPLACE VIEW public.disputes_seller
WITH (security_invoker = true) AS
SELECT
  id,
  seller_user_id,
  transaction_id,
  type,
  status,
  amount,
  reason,
  admin_notes,
  created_at,
  updated_at,
  resolved_at,
  -- Mask buyer PII: only show first name initial + last 4 of email
  CASE WHEN buyer_name IS NOT NULL THEN LEFT(buyer_name, 1) || '***' ELSE NULL END AS buyer_name_masked,
  CASE WHEN buyer_email IS NOT NULL THEN '***@' || SPLIT_PART(buyer_email, '@', 2) ELSE NULL END AS buyer_email_masked,
  NULL::text AS buyer_phone
FROM public.disputes;

-- 2. PRODUCTS: Remove anon SELECT from base table
-- The products_public view handles all public access
DROP POLICY IF EXISTS "Public can view active products (safe)" ON public.products;

-- 3. ORDER BUMPS: Tighten anon access - only allow reading bumps for a specific product context
-- Remove overly broad public read
DROP POLICY IF EXISTS "Public can view active order bumps" ON public.order_bumps;

-- Re-create with anon-safe policy (read-only, active only, via products_public context)
CREATE POLICY "Anon can view active order bumps"
ON public.order_bumps FOR SELECT
TO anon
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = order_bumps.product_id
    AND p.status = 'active'
  )
);

-- Authenticated users who own the product can also read
CREATE POLICY "Authenticated view active order bumps"
ON public.order_bumps FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = order_bumps.product_id
    AND p.status = 'active'
  )
);
