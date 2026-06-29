
GRANT SELECT (key_value) ON public.pix_keys TO authenticated;
GRANT SELECT (account_number, holder_document) ON public.bank_accounts TO authenticated;
GRANT SELECT (pix_key) ON public.profiles TO authenticated;
-- _enc columns remain revoked
