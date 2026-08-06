DROP POLICY IF EXISTS "pl_covers_public_read" ON storage.objects;

CREATE POLICY "pl_covers_read_linked_or_owner"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'payment-link-covers'
  AND (
    (auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1])
    OR EXISTS (
      SELECT 1
      FROM public.payment_links pl
      WHERE pl.is_active = true
        AND pl.cover_url LIKE '%' || name
    )
  )
);