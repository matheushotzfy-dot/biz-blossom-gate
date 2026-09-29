REVOKE ALL ON FUNCTION public.enforce_seller_payment_methods() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propagate_seller_payment_method_blocks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_seller_payment_methods() TO service_role;
GRANT EXECUTE ON FUNCTION public.propagate_seller_payment_method_blocks() TO service_role;