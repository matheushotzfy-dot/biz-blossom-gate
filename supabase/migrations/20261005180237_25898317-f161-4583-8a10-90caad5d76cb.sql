ALTER TABLE public.app_integrations
  ADD COLUMN IF NOT EXISTS api_key_enc bytea,
  ADD COLUMN IF NOT EXISTS api_key_masked text,
  ADD COLUMN IF NOT EXISTS webhook_secret_enc bytea,
  ADD COLUMN IF NOT EXISTS webhook_url_masked text;

ALTER TABLE public.product_pixels
  ADD COLUMN IF NOT EXISTS api_token_enc bytea,
  ADD COLUMN IF NOT EXISTS api_token_masked text;

CREATE OR REPLACE FUNCTION public.encrypt_app_integration_secrets_tg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
BEGIN
  IF NEW.api_key IS DISTINCT FROM OLD.api_key AND NEW.api_key IS NOT NULL AND btrim(NEW.api_key) <> '' THEN
    NEW.api_key_enc := public.encrypt_field(NEW.api_key);
    NEW.api_key_masked := public.mask_tail(NEW.api_key, 4);
    NEW.api_key := NULL;
  ELSIF TG_OP = 'INSERT' AND NEW.api_key IS NOT NULL AND btrim(NEW.api_key) <> '' THEN
    NEW.api_key_enc := public.encrypt_field(NEW.api_key);
    NEW.api_key_masked := public.mask_tail(NEW.api_key, 4);
    NEW.api_key := NULL;
  END IF;
  IF NEW.webhook_url IS DISTINCT FROM OLD.webhook_url AND NEW.app_name = 'zapi' AND NEW.webhook_url IS NOT NULL AND btrim(NEW.webhook_url) <> '' THEN
    NEW.webhook_secret_enc := public.encrypt_field(NEW.webhook_url);
    NEW.webhook_url_masked := public.mask_tail(NEW.webhook_url, 4);
    NEW.webhook_url := NULL;
  ELSIF TG_OP = 'INSERT' AND NEW.app_name = 'zapi' AND NEW.webhook_url IS NOT NULL AND btrim(NEW.webhook_url) <> '' THEN
    NEW.webhook_secret_enc := public.encrypt_field(NEW.webhook_url);
    NEW.webhook_url_masked := public.mask_tail(NEW.webhook_url, 4);
    NEW.webhook_url := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_product_pixel_secret_tg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.api_token IS DISTINCT FROM OLD.api_token THEN
    IF NEW.api_token IS NOT NULL AND btrim(NEW.api_token) <> '' THEN
      NEW.api_token_enc := public.encrypt_field(NEW.api_token);
      NEW.api_token_masked := public.mask_tail(NEW.api_token, 4);
      NEW.api_token := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_integrations_encrypt_secrets_tg ON public.app_integrations;
CREATE TRIGGER app_integrations_encrypt_secrets_tg
BEFORE INSERT OR UPDATE OF api_key, webhook_url ON public.app_integrations
FOR EACH ROW EXECUTE FUNCTION public.encrypt_app_integration_secrets_tg();

DROP TRIGGER IF EXISTS product_pixels_encrypt_secret_tg ON public.product_pixels;
CREATE TRIGGER product_pixels_encrypt_secret_tg
BEFORE INSERT OR UPDATE OF api_token ON public.product_pixels
FOR EACH ROW EXECUTE FUNCTION public.encrypt_product_pixel_secret_tg();

UPDATE public.app_integrations
SET api_key_enc = CASE WHEN api_key IS NOT NULL THEN public.encrypt_field(api_key) ELSE api_key_enc END,
    api_key_masked = CASE WHEN api_key IS NOT NULL THEN public.mask_tail(api_key, 4) ELSE api_key_masked END,
    webhook_secret_enc = CASE WHEN app_name = 'zapi' AND webhook_url IS NOT NULL THEN public.encrypt_field(webhook_url) ELSE webhook_secret_enc END,
    webhook_url_masked = CASE WHEN app_name = 'zapi' AND webhook_url IS NOT NULL THEN public.mask_tail(webhook_url, 4) ELSE webhook_url_masked END;
UPDATE public.app_integrations SET api_key = NULL WHERE api_key IS NOT NULL;
UPDATE public.app_integrations SET webhook_url = NULL WHERE app_name = 'zapi' AND webhook_url IS NOT NULL;

UPDATE public.product_pixels
SET api_token_enc = CASE WHEN api_token IS NOT NULL THEN public.encrypt_field(api_token) ELSE api_token_enc END,
    api_token_masked = CASE WHEN api_token IS NOT NULL THEN public.mask_tail(api_token, 4) ELSE api_token_masked END;
UPDATE public.product_pixels SET api_token = NULL WHERE api_token IS NOT NULL;

REVOKE SELECT ON public.app_integrations FROM authenticated;
GRANT SELECT (id, user_id, app_name, product_id, api_url, events, is_active, config, created_at, updated_at, api_key_masked, webhook_url_masked) ON public.app_integrations TO authenticated;
GRANT ALL ON public.app_integrations TO service_role;

REVOKE SELECT ON public.product_pixels FROM authenticated;
GRANT SELECT (id, product_id, user_id, platform, pixel_id, domain, events, fire_on_pix_qr, fire_on_boleto, pix_conversion_value, boleto_conversion_value, disable_bump_events, is_active, created_at, api_token_masked) ON public.product_pixels TO authenticated;
GRANT ALL ON public.product_pixels TO service_role;

CREATE OR REPLACE VIEW public.app_integrations_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, app_name, product_id, api_key_masked,
       api_key_enc IS NOT NULL AS has_api_key,
       api_url, webhook_url_masked AS webhook_url,
       events, is_active, config, created_at, updated_at
FROM public.app_integrations
WHERE user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role);

CREATE OR REPLACE VIEW public.product_pixels_safe
WITH (security_invoker = true)
AS
SELECT id, product_id, user_id, platform, pixel_id, api_token_masked,
       api_token_enc IS NOT NULL AS has_api_token,
       domain, events, fire_on_pix_qr, fire_on_boleto,
       pix_conversion_value, boleto_conversion_value,
       disable_bump_events, is_active, created_at
FROM public.product_pixels
WHERE user_id = auth.uid();

GRANT SELECT ON public.app_integrations_safe, public.product_pixels_safe TO authenticated;
GRANT SELECT ON public.app_integrations_safe, public.product_pixels_safe TO service_role;

CREATE OR REPLACE FUNCTION app_private.get_app_integration_for_dispatch(_integration_id uuid)
RETURNS TABLE(id uuid, user_id uuid, app_name text, api_key text, api_url text, webhook_url text, is_active boolean, config jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
  SELECT i.id, i.user_id, i.app_name,
         public.decrypt_field(i.api_key_enc), i.api_url,
         CASE WHEN i.app_name = 'zapi' THEN public.decrypt_field(i.webhook_secret_enc) ELSE i.webhook_url END,
         i.is_active, i.config
  FROM public.app_integrations i
  WHERE i.id = _integration_id
    AND COALESCE(auth.role(), '') = 'service_role';
$$;
REVOKE ALL ON FUNCTION app_private.get_app_integration_for_dispatch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_app_integration_for_dispatch(uuid) TO service_role;

DROP POLICY IF EXISTS "Admins manage permissions" ON public.staff_permissions;
CREATE POLICY "Only admins manage permissions"
ON public.staff_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));