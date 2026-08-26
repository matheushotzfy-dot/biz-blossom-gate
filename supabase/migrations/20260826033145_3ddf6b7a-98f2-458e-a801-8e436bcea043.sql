
REVOKE ALL ON FUNCTION public.enforce_withdrawal_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_late_payment_window() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_sensitive_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_monitoring_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_monitoring_checks() TO service_role;
