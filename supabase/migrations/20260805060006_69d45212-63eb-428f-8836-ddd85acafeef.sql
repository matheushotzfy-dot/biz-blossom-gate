-- 1) Lock down internal SECURITY DEFINER functions (not used by frontend)
REVOKE EXECUTE ON FUNCTION public.admin_decrypt_field(bytea) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reveal_bank_accounts(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_financial_ledger_for_completed_tx(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_card_release_days(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ledger_integrity_report() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_goal_progress(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_staff_commission_balance(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_support_access(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_visible_acquirers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_failover_acquirer(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_anticipation(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_commission_pct(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_commission_staff(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_global_payment_toggles() FROM anon, authenticated;

-- 2) Trigger-only functions must never be callable directly
REVOKE EXECUTE ON FUNCTION public.validate_integration_url() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_withdrawal_amount() FROM anon, authenticated, public;

-- 3) Anonymous role: only the genuinely public checkout helpers stay reachable
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT IN ('get_public_payment_link', 'increment_payment_link_clicks')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- 4) Make sure backend/service paths keep full access
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND pg_get_function_result(p.oid) <> 'trigger'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;