
-- 1) Restrict fees SELECT to admins only
DROP POLICY IF EXISTS "Anyone can view fees" ON public.fees;
CREATE POLICY "Admins can view fees"
ON public.fees FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Harden checkout-banners storage policies with strict filename validation
DROP POLICY IF EXISTS "Users can upload own checkout banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own checkout banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own checkout banners" ON storage.objects;

CREATE POLICY "Users can upload own checkout banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 1
  AND storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(desktop|mobile)\.(png|jpg|jpeg|webp|gif)$'
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = substring(storage.filename(objects.name) from '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  )
);

CREATE POLICY "Users can update own checkout banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 1
  AND storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(desktop|mobile)\.(png|jpg|jpeg|webp|gif)$'
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = substring(storage.filename(objects.name) from '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  )
);

CREATE POLICY "Users can delete own checkout banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 1
  AND storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(desktop|mobile)\.(png|jpg|jpeg|webp|gif)$'
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = substring(storage.filename(objects.name) from '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  )
);
