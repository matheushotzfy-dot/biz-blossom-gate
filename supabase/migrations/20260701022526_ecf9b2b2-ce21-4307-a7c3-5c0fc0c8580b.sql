
-- 1) Scope notifications admin policy to authenticated role
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Tie checkout-banners storage policies to product ownership
DROP POLICY IF EXISTS "Users can upload own checkout banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own checkout banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own checkout banners" ON storage.objects;

CREATE POLICY "Users can upload own checkout banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND p.id::text = split_part(split_part(name, '/', 2), '-', 1)
  )
);

CREATE POLICY "Users can update own checkout banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND p.id::text = split_part(split_part(name, '/', 2), '-', 1)
  )
);

CREATE POLICY "Users can delete own checkout banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND p.id::text = split_part(split_part(name, '/', 2), '-', 1)
  )
);

-- 3) Remove email-based product visibility to prevent spoofing via email change.
-- Buyers access their purchases through transactions/orders, not products directly.
DROP POLICY IF EXISTS "Buyers view purchased products" ON public.products;
