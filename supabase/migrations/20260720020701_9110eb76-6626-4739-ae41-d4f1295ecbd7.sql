DROP POLICY IF EXISTS "pl_covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "pl_covers_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "pl_covers_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "pl_covers_owner_delete" ON storage.objects;

CREATE POLICY "pl_covers_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'payment-link-covers');

CREATE POLICY "pl_covers_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-link-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pl_covers_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-link-covers' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'payment-link-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pl_covers_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-link-covers' AND auth.uid()::text = (storage.foldername(name))[1]);