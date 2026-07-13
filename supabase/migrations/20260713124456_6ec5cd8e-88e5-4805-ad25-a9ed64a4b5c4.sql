
CREATE OR REPLACE FUNCTION public.admin_unverify_email(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
     SET email_confirmed_at = NULL,
         confirmed_at = NULL
   WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unverify_email(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unverify_email(uuid) TO service_role;
