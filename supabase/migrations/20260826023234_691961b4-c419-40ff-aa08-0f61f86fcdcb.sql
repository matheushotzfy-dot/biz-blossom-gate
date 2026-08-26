DELETE FROM public.admin_2fa_codes;

ALTER TABLE public.admin_2fa_codes
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN code_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_2fa_codes_temp_token_key
  ON public.admin_2fa_codes (temp_token)
  WHERE temp_token IS NOT NULL;