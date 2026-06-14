
DROP POLICY IF EXISTS "Admins read withdrawal proofs" ON storage.objects;
CREATE POLICY "Admins read withdrawal proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'withdrawal-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins write withdrawal proofs" ON storage.objects;
CREATE POLICY "Admins write withdrawal proofs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'withdrawal-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins update withdrawal proofs" ON storage.objects;
CREATE POLICY "Admins update withdrawal proofs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'withdrawal-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins delete withdrawal proofs" ON storage.objects;
CREATE POLICY "Admins delete withdrawal proofs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'withdrawal-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins read dispute evidence" ON storage.objects;
CREATE POLICY "Admins read dispute evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins write dispute evidence" ON storage.objects;
CREATE POLICY "Admins write dispute evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins update dispute evidence" ON storage.objects;
CREATE POLICY "Admins update dispute evidence" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins delete dispute evidence" ON storage.objects;
CREATE POLICY "Admins delete dispute evidence" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role));
