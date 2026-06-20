
-- 1) Sellers can view their own disputes
CREATE POLICY "Sellers can view their own disputes"
ON public.disputes
FOR SELECT
TO authenticated
USING (seller_user_id = auth.uid());

-- 2) Sellers can read their own withdrawal-proof files (path: withdrawals/{withdrawal_id}/...)
CREATE POLICY "Sellers read own withdrawal proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'withdrawal-proofs'
  AND EXISTS (
    SELECT 1 FROM public.withdrawals w
    WHERE w.user_id = auth.uid()
      AND (
        position(w.id::text in storage.objects.name) > 0
      )
  )
);

-- 3) Pin search_path on prevent_audit_mutation
ALTER FUNCTION public.prevent_audit_mutation() SET search_path = public;
