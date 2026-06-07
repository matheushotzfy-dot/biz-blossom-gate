-- =========================================================
-- 1) webhook_configs: nunca expor coluna `secret` a clientes
-- =========================================================
REVOKE SELECT ON public.webhook_configs FROM anon, authenticated;
GRANT SELECT (id, user_id, url, events, is_active, created_at, updated_at)
  ON public.webhook_configs TO authenticated;
-- INSERT/UPDATE/DELETE continuam permitidos via RLS já existente
GRANT INSERT, UPDATE, DELETE ON public.webhook_configs TO authenticated;
GRANT ALL ON public.webhook_configs TO service_role;

-- =========================================================
-- 2) Revogar EXECUTE de funções SECURITY DEFINER que são
--    apenas triggers/internas (nunca devem ser chamadas via RPC)
-- =========================================================
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    -- Triggers (anti-fraude, validação, sanitização, ledger, notificações)
    'notify_product_status_change()',
    'sanitize_notification()',
    'validate_coupon_discount()',
    'protect_withdrawal_status()',
    'sanitize_lesson_comment()',
    'validate_notification_rate()',
    'validate_balance_adjustment()',
    'notify_withdrawal_status()',
    'ledger_on_withdrawal_change()',
    'force_pending_on_insert()',
    'protect_profile_fields()',
    'enforce_max_pix_keys()',
    'rate_limit_withdrawals()',
    'validate_withdrawal()',
    'validate_role_assignment()',
    'validate_product_price()',
    'sanitize_dispute()',
    'enforce_max_api_keys()',
    'validate_webhook_url()',
    'sanitize_activity_log()',
    'issue_certificate_on_completion()',
    'log_course_changes()',
    'grant_access_on_payment()',
    'validate_retention_settings()',
    'handle_new_user()',
    'enforce_withdrawal_fee()',
    'validate_withdrawal_balance()',
    'protect_transaction_status()',
    'log_product_changes()',
    'sanitize_seller_note()',
    'validate_custom_fees()',
    'enqueue_app_dispatch_on_tx_change()',
    'validate_crypto_daily_limit()',
    'ledger_on_transaction_change()',
    'enqueue_webhook_on_tx_change()',
    'ledger_on_adjustment()',
    'update_updated_at_column()',
    -- Internas (devem rodar apenas via service_role / outras funções)
    'verify_api_secret(text, text)',
    'touch_api_key(uuid)',
    'bump_rate_limit(text, integer, integer)',
    'check_blacklist(text, text, text)',
    'check_velocity(text, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- Mantemos EXECUTE para authenticated nas RPCs legítimas chamadas pelo app:
-- has_role, get_ledger_balance, get_checkout_status, verify_certificate,
-- get_course_analytics, get_quiz_questions_for_student, grade_quiz_attempt,
-- is_product_active, get_affiliate_product_owner, check_signup_conflicts.