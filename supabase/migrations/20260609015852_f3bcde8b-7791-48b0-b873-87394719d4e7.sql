CREATE OR REPLACE FUNCTION public.validate_integration_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.api_url IS NOT NULL AND length(trim(NEW.api_url)) > 0 THEN
    IF NOT (NEW.api_url LIKE 'https://%') THEN
      RAISE EXCEPTION 'URL da integração deve usar HTTPS';
    END IF;
    IF NEW.api_url ~* 'https?://(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|\[fc|\[fd)' THEN
      RAISE EXCEPTION 'URL da integração não pode apontar para endereços internos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_integration_url ON public.app_integrations;
CREATE TRIGGER trg_validate_integration_url
  BEFORE INSERT OR UPDATE ON public.app_integrations
  FOR EACH ROW EXECUTE FUNCTION public.validate_integration_url();