
CREATE OR REPLACE FUNCTION public.validate_notification_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE recent_count integer;
BEGIN
  IF NEW.created_by IS NOT NULL AND (
       public.has_role(NEW.created_by, 'admin'::app_role)
    OR public.has_role(NEW.created_by, 'manager'::app_role)
  ) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO recent_count
    FROM public.notifications
   WHERE created_by = NEW.created_by
     AND created_at > now() - interval '1 hour';
  IF recent_count >= 50 THEN RAISE EXCEPTION 'Rate limit exceeded'; END IF;
  RETURN NEW;
END; $function$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_agent text;

INSERT INTO public.platform_settings (key, value)
VALUES
  ('payment_methods.pix_enabled_global',         'true'::jsonb),
  ('payment_methods.credit_card_enabled_global', 'true'::jsonb),
  ('payment_methods.boleto_enabled_global',      'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_global_payment_toggles()
RETURNS TABLE (pix boolean, credit_card boolean, boleto boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE((SELECT (value)::text::boolean FROM public.platform_settings WHERE key = 'payment_methods.pix_enabled_global'), true)         AS pix,
    COALESCE((SELECT (value)::text::boolean FROM public.platform_settings WHERE key = 'payment_methods.credit_card_enabled_global'), true) AS credit_card,
    COALESCE((SELECT (value)::text::boolean FROM public.platform_settings WHERE key = 'payment_methods.boleto_enabled_global'), true)      AS boleto;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_payment_toggles() TO anon, authenticated, service_role;
