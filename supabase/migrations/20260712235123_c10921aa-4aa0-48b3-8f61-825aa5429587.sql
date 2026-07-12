
-- Revoke EXECUTE from anon/authenticated/PUBLIC on trigger + cron-only SECURITY DEFINER functions.
-- These are invoked internally (by triggers or pg_cron as postgres) and must not be callable
-- from the PostgREST API surface.

DO $$
DECLARE
  f text;
  fn_list text[] := ARRAY[
    'audit_auto_withdraw_change()',
    'check_auto_withdrawal()',
    'check_db_connections()',
    'check_error_rate()',
    'check_failed_crons()',
    'protect_affiliate_links_update()',
    'protect_auto_withdraw_columns()',
    'protect_co_productions_update()',
    'protect_profiles_privileged_columns()',
    'raise_admin_alert(text, text, text, jsonb)',
    'reconcile_stuck_transactions()',
    'reconcile_stuck_withdrawals()',
    'run_monitoring_checks()',
    'trg_ledger_auto_withdraw()',
    'trg_pix_key_deleted_disable_auto()',
    'trg_profile_status_pause_auto()',
    'validate_auto_withdraw_row()'
  ];
BEGIN
  FOREACH f IN ARRAY fn_list LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip: public.% not found', f;
    END;
  END LOOP;
END $$;

-- Ensure service_role and postgres can still execute (triggers run as table owner; crons as postgres).
DO $$
DECLARE
  f text;
  fn_list text[] := ARRAY[
    'audit_auto_withdraw_change()',
    'check_auto_withdrawal()',
    'check_db_connections()',
    'check_error_rate()',
    'check_failed_crons()',
    'protect_affiliate_links_update()',
    'protect_auto_withdraw_columns()',
    'protect_co_productions_update()',
    'protect_profiles_privileged_columns()',
    'raise_admin_alert(text, text, text, jsonb)',
    'reconcile_stuck_transactions()',
    'reconcile_stuck_withdrawals()',
    'run_monitoring_checks()',
    'trg_ledger_auto_withdraw()',
    'trg_pix_key_deleted_disable_auto()',
    'trg_profile_status_pause_auto()',
    'validate_auto_withdraw_row()'
  ];
BEGIN
  FOREACH f IN ARRAY fn_list LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;
