
CREATE POLICY "Admins manage dispute-evidence"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers read own dispute evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND (storage.foldername(name))[1] = 'disputes'
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Sellers upload own dispute evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dispute-evidence'
  AND (storage.foldername(name))[1] = 'disputes'
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.user_id = auth.uid()
  )
);
