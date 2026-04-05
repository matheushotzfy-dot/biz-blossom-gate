-- 1) Fix product_pixels_public view: allow anonymous checkout access
ALTER VIEW public.product_pixels_public SET (security_invoker = off);

-- 2) Fix order_bumps: the existing anon SELECT policy uses EXISTS on products which has deny_anon_select
-- We need a SECURITY DEFINER function to check product status without RLS
CREATE OR REPLACE FUNCTION public.is_product_active(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products WHERE id = _product_id AND status = 'active'
  );
$$;

-- Drop the broken anon policy and recreate
DROP POLICY IF EXISTS "Anon can view active order bumps" ON public.order_bumps;
CREATE POLICY "Anon can view active order bumps"
  ON public.order_bumps FOR SELECT TO anon
  USING (is_active = true AND public.is_product_active(product_id));

-- Also fix the authenticated version
DROP POLICY IF EXISTS "Authenticated view active order bumps" ON public.order_bumps;
CREATE POLICY "Authenticated view active order bumps"
  ON public.order_bumps FOR SELECT TO authenticated
  USING (is_active = true AND public.is_product_active(product_id));

-- 3) Sellers can view their own disputes
CREATE POLICY "Sellers can view own disputes"
  ON public.disputes FOR SELECT TO authenticated
  USING (seller_user_id = auth.uid());

-- 4) Subscribers can view their own subscriptions
CREATE POLICY "Subscribers view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (subscriber_user_id = auth.uid());

-- 5) Students can read lesson attachments for enrolled courses
CREATE POLICY "Students can read lesson attachments for enrolled courses"
  ON public.lesson_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
      JOIN public.user_access ua ON ua.course_id = c.id
      WHERE l.id = lesson_attachments.lesson_id
        AND ua.user_id = auth.uid()
        AND ua.status = 'active'
    )
  );

-- 6) Fix course-content storage: drop inconsistent policy and recreate with aligned paths
-- The owner policy uses foldername[1] = user_id AND foldername[2] = course_id (path: /user_id/course_id/file)
-- The student policy uses foldername[1] = course_id (path: /course_id/file)
-- Align both to use: /user_id/course_id/file structure
DROP POLICY IF EXISTS "Authenticated users with course access can view content" ON storage.objects;
CREATE POLICY "Authenticated users with course access can view content"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-content' AND
    EXISTS (
      SELECT 1 FROM public.user_access ua
      JOIN public.courses c ON c.id = ua.course_id
      WHERE ua.user_id = auth.uid()
        AND ua.status = 'active'
        AND (c.id)::text = (storage.foldername(name))[2]
    )
  );