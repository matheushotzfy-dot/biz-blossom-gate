REVOKE EXECUTE ON FUNCTION public.get_global_payment_toggles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_payment_toggles() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_public_payment_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_link(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.increment_payment_link_clicks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_payment_link_clicks(text) TO anon, authenticated, service_role;