
-- 1. Rebuild products_public to include affiliate marketing fields and theme
DROP VIEW IF EXISTS public.products_public;

CREATE VIEW public.products_public
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  description,
  price,
  status,
  image_url,
  checkout_url,
  checkout_pix_enabled,
  checkout_boleto_enabled,
  checkout_credit_card_enabled,
  checkout_timer_enabled,
  checkout_timer_minutes,
  checkout_social_proof,
  checkout_guarantee_enabled,
  checkout_address_required,
  checkout_email_confirm,
  checkout_button_color,
  checkout_banner_desktop_url,
  checkout_banner_mobile_url,
  checkout_theme,
  created_at,
  support_email,
  display_name,
  delivery_type,
  affiliate_enabled,
  affiliate_commission
FROM public.products
WHERE status = 'active';

GRANT SELECT ON public.products_public TO anon, authenticated;

-- 2. Drop overly broad policy that leaks all internal product fields to any authenticated user
DROP POLICY IF EXISTS "Authenticated can view active products" ON public.products;

-- 3. Allow authenticated users to read product rows ONLY for products they have a legitimate
--    business relationship with. Browsing/marketplace consumers must use products_public.

CREATE POLICY "Affiliates view linked products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.affiliate_links al
    WHERE al.product_id = products.id
      AND al.affiliate_user_id = auth.uid()
  )
);

CREATE POLICY "Co-producers view co-produced products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.co_productions cp
    WHERE cp.product_id = products.id
      AND cp.co_producer_user_id = auth.uid()
      AND cp.status = 'accepted'
  )
);

CREATE POLICY "Buyers view purchased products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.product_id = products.id
      AND t.user_id = auth.uid()
  )
);

-- 4. Secure RPC for marketplace: returns owner of an active, affiliate-enabled product only
CREATE OR REPLACE FUNCTION public.get_affiliate_product_owner(_product_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.products
  WHERE id = _product_id
    AND status = 'active'
    AND affiliate_enabled = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_affiliate_product_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_affiliate_product_owner(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_affiliate_product_owner(uuid) TO authenticated;

-- 5. Tighten course-content storage SELECT policies: enforce strict path structure
--    Path expected: <owner_user_id>/<course_id>/...
DROP POLICY IF EXISTS "Course content viewable by owner or enrolled students" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users with course access can view content" ON storage.objects;

CREATE POLICY "Course content readable by owner, admin or enrolled student"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-content'
  AND array_length(storage.foldername(name), 1) >= 2
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.courses c ON c.id = ua.course_id
      WHERE ua.user_id = auth.uid()
        AND ua.status = 'active'
        AND c.is_published = true
        AND c.id::text = (storage.foldername(name))[2]
        AND c.user_id::text = (storage.foldername(name))[1]
    )
  )
);
