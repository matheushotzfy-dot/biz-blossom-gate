
REVOKE ALL ON FUNCTION public.verify_api_secret(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_api_key(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_webhook_on_tx_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_api_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_api_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_webhook_on_tx_change() TO service_role;
