-- Restrict dispute-evidence uploads/reads to transactions that actually have a dispute for the seller
DROP POLICY IF EXISTS "Sellers upload own dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "Sellers read own dispute evidence" ON storage.objects;

CREATE POLICY "Sellers upload own dispute evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dispute-evidence'
  AND (storage.foldername(name))[1] = 'disputes'
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.user_id = auth.uid()
      AND d.seller_user_id = auth.uid()
  )
);

CREATE POLICY "Sellers read own dispute evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND (storage.foldername(name))[1] = 'disputes'
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.user_id = auth.uid()
      AND d.seller_user_id = auth.uid()
  )
);

-- Document financial_ledger write path: all writes go via SECURITY DEFINER triggers
-- (ledger_on_transaction_change, ledger_on_withdrawal_change, ledger_on_adjustment)
-- or service_role (which bypasses RLS). The restrictive policy below intentionally
-- blocks any direct INSERT from authenticated/anon clients.
COMMENT ON POLICY "service_insert_ledger" ON public.financial_ledger IS
  'Restrictive deny-all for direct INSERT. All writes occur via SECURITY DEFINER triggers or service_role.';

-- Re-assert column-level revoke on quiz_questions.correct_index (defense in depth)
REVOKE SELECT (correct_index) ON public.quiz_questions FROM anon, authenticated;