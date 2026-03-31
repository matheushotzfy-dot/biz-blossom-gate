
-- 1. Make course-content bucket PRIVATE
UPDATE storage.buckets SET public = false WHERE id = 'course-content';

-- 2. Drop the old open SELECT policy on course-content
DROP POLICY IF EXISTS "Public can view course content" ON storage.objects;

-- 3. Create a new policy: only users with active access can read course content
CREATE POLICY "Authenticated users with course access can view content"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-content'
  AND EXISTS (
    SELECT 1 FROM public.user_access ua
    JOIN public.courses c ON c.id = ua.course_id
    WHERE ua.user_id = auth.uid()
      AND ua.status = 'active'
      AND (storage.foldername(name))[1] = c.id::text
  )
);

-- 4. Fix disputes_seller view: recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller
WITH (security_invoker = true)
AS
SELECT 
  d.id,
  d.seller_user_id,
  d.transaction_id,
  d.type,
  d.status,
  d.amount,
  d.reason,
  d.admin_notes,
  d.created_at,
  d.updated_at,
  d.resolved_at,
  CASE WHEN d.buyer_name IS NOT NULL THEN left(d.buyer_name, 2) || '***' ELSE NULL END AS buyer_name_masked,
  CASE WHEN d.buyer_email IS NOT NULL THEN left(split_part(d.buyer_email, '@', 1), 2) || '***@' || split_part(d.buyer_email, '@', 2) ELSE NULL END AS buyer_email_masked,
  CASE WHEN d.buyer_phone IS NOT NULL THEN left(d.buyer_phone, 4) || '****' ELSE NULL END AS buyer_phone_masked
FROM public.disputes d
WHERE d.seller_user_id = auth.uid()
   OR public.has_role(auth.uid(), 'admin'::public.app_role);

-- 5. Fix product_pixels_public view: recreate as SECURITY INVOKER  
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public
WITH (security_invoker = false)
AS
SELECT 
  pp.id,
  pp.product_id,
  pp.platform,
  pp.pixel_id,
  pp.is_active,
  pp.events,
  pp.fire_on_boleto,
  pp.fire_on_pix_qr,
  pp.boleto_conversion_value,
  pp.pix_conversion_value,
  pp.disable_bump_events,
  pp.domain
FROM public.product_pixels pp;

-- 6. Add RLS policy for disputes_seller view access
ALTER VIEW public.disputes_seller SET (security_barrier = true);
