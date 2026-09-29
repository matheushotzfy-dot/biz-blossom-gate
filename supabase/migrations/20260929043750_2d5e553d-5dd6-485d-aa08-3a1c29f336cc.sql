REVOKE EXECUTE ON FUNCTION public.mask_acquirer_on_public_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_document_encrypt_tg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mask_acquirer_on_public_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.profiles_document_encrypt_tg() TO service_role;