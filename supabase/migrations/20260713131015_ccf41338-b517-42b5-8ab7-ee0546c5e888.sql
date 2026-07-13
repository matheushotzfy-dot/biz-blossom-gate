ALTER VIEW public.webhook_configs_safe SET (security_invoker = true);
GRANT SELECT ON public.webhook_configs_safe TO authenticated;
GRANT ALL ON public.webhook_configs_safe TO service_role;