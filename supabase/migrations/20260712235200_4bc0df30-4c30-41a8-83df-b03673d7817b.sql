
DO $$
DECLARE
  f text;
  fn_list text[] := ARRAY[
    'apply_card_release_hold()',
    'apply_commission_payout()',
    'apply_staff_commission_on_dispute()',
    'apply_staff_commission_on_tx()',
    'auto_fill_approved_by()',
    'backfill_financial_ledger_for_completed_tx()',
    'bank_accounts_encrypt_tg()',
    'bump_coupon_usage_on_paid()',
    'check_signup_conflicts()',
    'enforce_manager_fee_limits()',
    'enforce_max_ticket_limit()',
    'enqueue_webhook_on_withdrawal_change()',
    'guard_profile_self_update()',
    'handle_dispute_balance()',
    'log_acquirer_health_change()',
    'log_staff_action()',
    'notify_reward_claim_status_change()',
    'notify_support_ticket_reply()',
    'notify_transaction_paid()',
    'notify_withdrawal_status_change()',
    'pix_keys_encrypt_tg()',
    'profiles_pix_encrypt_tg()',
    'protect_is_simulated()',
    'rate_limit_coupons_insert()',
    'rate_limit_products_insert()',
    'release_due_card_holds()'
  ];
BEGIN
  FOREACH f IN ARRAY fn_list LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip: public.% not found', f;
    END;
  END LOOP;
END $$;
