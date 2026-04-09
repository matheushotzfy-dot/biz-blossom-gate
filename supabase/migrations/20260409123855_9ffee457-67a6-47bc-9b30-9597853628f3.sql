
-- Public function to check for signup conflicts BEFORE creating account
-- Callable by anon (no auth needed), returns conflict field name or empty string
CREATE OR REPLACE FUNCTION public.check_signup_conflicts(
  _email text,
  _document_number text,
  _phone text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check email in profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = lower(trim(_email)) AND email IS NOT NULL AND email != '') THEN
    RETURN 'email';
  END IF;

  -- Check document_number in profiles
  IF _document_number IS NOT NULL AND _document_number != '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE document_number = _document_number) THEN
      RETURN 'document';
    END IF;
  END IF;

  -- Check phone in profiles
  IF _phone IS NOT NULL AND _phone != '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone) THEN
      RETURN 'phone';
    END IF;
  END IF;

  RETURN '';
END;
$$;

-- Grant anon access so unauthenticated users can check before signup
GRANT EXECUTE ON FUNCTION public.check_signup_conflicts(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_signup_conflicts(text, text, text) TO authenticated;
