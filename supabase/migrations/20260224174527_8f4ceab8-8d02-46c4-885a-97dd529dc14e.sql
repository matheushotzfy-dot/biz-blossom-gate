-- SECURITY HARDENING: Revoke public EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_withdrawal_amount() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_withdrawal_amount() TO service_role;

REVOKE EXECUTE ON FUNCTION public.grant_access_on_payment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_access_on_payment() TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_product_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_product_changes() TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_course_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_course_changes() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;