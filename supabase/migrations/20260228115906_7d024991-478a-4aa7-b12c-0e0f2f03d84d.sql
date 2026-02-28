
-- Create a safe view for webhook_configs that masks the secret
CREATE OR REPLACE VIEW public.webhook_configs_safe
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  url,
  events,
  is_active,
  created_at,
  updated_at,
  CASE WHEN secret IS NOT NULL THEN '••••' || RIGHT(secret, 4) ELSE NULL END AS secret_masked
FROM public.webhook_configs;
