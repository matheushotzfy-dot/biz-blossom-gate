DROP POLICY IF EXISTS race_assets_read_authenticated ON storage.objects;
CREATE POLICY race_assets_read_owner_or_admin
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'race-assets'
  AND auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()::text
    OR app_private.has_role(auth.uid(), 'admin'::public.app_role)
  )
);