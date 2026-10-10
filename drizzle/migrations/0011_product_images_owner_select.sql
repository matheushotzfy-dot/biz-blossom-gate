CREATE POLICY "Users can read own product images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images' AND (auth.uid())::text = (storage.foldername(name))[1]);