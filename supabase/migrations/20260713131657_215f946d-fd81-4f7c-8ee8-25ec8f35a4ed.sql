CREATE OR REPLACE VIEW public.webhook_configs_safe
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  wc.id,
  wc.user_id,
  wc.url,
  wc.events,
  wc.is_active,
  wc.created_at,
  wc.updated_at,
  NULL::text AS secret_masked
FROM public.webhook_configs wc;

ALTER VIEW public.webhook_configs_safe SET (security_invoker = true);

REVOKE SELECT ON public.webhook_configs FROM authenticated;
GRANT SELECT (id, user_id, url, events, is_active, created_at, updated_at) ON public.webhook_configs TO authenticated;
GRANT SELECT ON public.webhook_configs_safe TO authenticated;
GRANT ALL ON public.webhook_configs TO service_role;
GRANT ALL ON public.webhook_configs_safe TO service_role;