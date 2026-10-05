REVOKE ALL ON FUNCTION public.encrypt_app_integration_secrets_tg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_product_pixel_secret_tg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_app_integration_secrets_tg() TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_product_pixel_secret_tg() TO service_role;