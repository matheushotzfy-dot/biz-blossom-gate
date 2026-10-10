ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_popup_snoozed_until timestamptz;

CREATE OR REPLACE FUNCTION app_private.snooze_my_kyc_popup()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE _until timestamptz := now() + interval '3 days';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  UPDATE public.profiles SET kyc_popup_snoozed_until = _until, updated_at = now()
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN _until;
END;
$$;
REVOKE ALL ON FUNCTION app_private.snooze_my_kyc_popup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.snooze_my_kyc_popup() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.snooze_my_kyc_popup()
RETURNS timestamptz
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$ SELECT app_private.snooze_my_kyc_popup(); $$;
REVOKE ALL ON FUNCTION public.snooze_my_kyc_popup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snooze_my_kyc_popup() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.signup_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  salt text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signup_codes_user ON public.signup_verification_codes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_codes_email ON public.signup_verification_codes (email, created_at DESC);
GRANT ALL ON public.signup_verification_codes TO service_role;
ALTER TABLE public.signup_verification_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.signup_verification_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);