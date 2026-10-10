ALTER VIEW public.app_integrations_safe SET (security_invoker = false);
ALTER VIEW public.product_pixels_safe SET (security_invoker = false);
CREATE OR REPLACE VIEW public.webhook_configs_safe WITH (security_barrier = true, security_invoker = false) AS
 SELECT id, user_id, url, events, is_active, created_at, updated_at, NULL::text AS secret_masked
 FROM public.webhook_configs wc
 WHERE wc.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role);
ALTER VIEW public.app_integrations_safe SET (security_barrier = true);
ALTER VIEW public.product_pixels_safe SET (security_barrier = true);
REVOKE ALL ON public.app_integrations_safe, public.product_pixels_safe, public.webhook_configs_safe FROM anon;
GRANT SELECT ON public.app_integrations_safe, public.product_pixels_safe, public.webhook_configs_safe TO authenticated;