
-- Revoke EXECUTE on trigger-only functions (triggers run regardless of grants)
REVOKE EXECUTE ON FUNCTION public.enforce_max_api_keys() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_max_pix_keys() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_withdrawal_fee() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.force_pending_on_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.grant_access_on_payment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ledger_on_adjustment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ledger_on_transaction_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ledger_on_withdrawal_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_course_changes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_product_changes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_product_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_withdrawal_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_transaction_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_withdrawal_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rate_limit_withdrawals() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sanitize_dispute() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sanitize_notification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sanitize_seller_note() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_balance_adjustment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_coupon_discount() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_crypto_daily_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_custom_fees() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_notification_rate() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_product_price() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_retention_settings() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_role_assignment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_webhook_url() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_withdrawal() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_withdrawal_balance() FROM anon, authenticated, public;

-- Sensitive RPCs: revoke public callable access
-- Legacy has_role(uuid, app_role) — replaced by current_user_has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;

-- get_ledger_balance: lets any user query ANY user's balance — internal use only
REVOKE EXECUTE ON FUNCTION public.get_ledger_balance(uuid) FROM anon, authenticated, public;

-- Fraud/security helpers — internal use by edge functions only
REVOKE EXECUTE ON FUNCTION public.check_blacklist(text, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_velocity(text, text, text) FROM anon, authenticated, public;

-- check_signup_conflicts: needs anon (used during signup) but not authenticated
REVOKE EXECUTE ON FUNCTION public.check_signup_conflicts(text, text, text) FROM authenticated, public;
-- (anon retains access for signup form)
