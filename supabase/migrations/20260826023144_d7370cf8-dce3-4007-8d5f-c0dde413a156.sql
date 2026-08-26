ALTER TABLE public.admin_2fa_codes
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.admin_2fa_codes
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

CREATE INDEX IF NOT EXISTS admin_2fa_codes_user_id_idx
  ON public.admin_2fa_codes (user_id);

DROP POLICY IF EXISTS "Users can insert own pix keys" ON public.pix_keys;
DROP POLICY IF EXISTS "Users can delete own pix keys" ON public.pix_keys;
DROP POLICY IF EXISTS "Users can insert own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can insert own withdrawals" ON public.withdrawals;

CREATE POLICY "Admins can insert pix keys"
ON public.pix_keys FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete pix keys"
ON public.pix_keys FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert bank accounts"
ON public.bank_accounts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert withdrawals"
ON public.withdrawals FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));