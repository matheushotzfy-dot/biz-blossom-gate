CREATE OR REPLACE VIEW public.webhook_configs_safe
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  wc.id,
  wc.user_id,
  wc.url,
  wc.events,
  wc.is_active,
  wc.created_at,
  wc.updated_at,
  CASE
    WHEN wc.secret IS NULL OR wc.secret = '' THEN ''::text
    ELSE 'whsec_'::text || repeat('•'::text, 8) || right(wc.secret, 4)
  END AS secret_masked
FROM public.webhook_configs wc
WHERE wc.user_id = auth.uid()
   OR public.current_user_has_role('admin'::public.app_role);

ALTER VIEW public.webhook_configs_safe SET (security_invoker = false);
GRANT SELECT ON public.webhook_configs_safe TO authenticated;
GRANT ALL ON public.webhook_configs_safe TO service_role;