DO $$
DECLARE
  r record;
  had_auth boolean;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prokind = 'f'
  LOOP
    had_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');

    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);

    IF had_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    END IF;

    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END $$;

-- Real leak: admin_get_seller_balances was anon+PUBLIC executable. Now restricted to authenticated only.
REVOKE ALL ON FUNCTION public.admin_get_seller_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances() TO service_role;