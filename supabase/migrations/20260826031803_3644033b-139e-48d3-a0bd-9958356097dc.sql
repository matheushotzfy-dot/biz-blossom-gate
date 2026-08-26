-- Encrypt profile CPF/CNPJ at rest and keep only masked values readable.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document_number_enc bytea,
  ADD COLUMN IF NOT EXISTS document_number_masked text,
  ADD COLUMN IF NOT EXISTS document_number_fingerprint text;

CREATE OR REPLACE FUNCTION public.profiles_document_encrypt_tg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE
  _normalized text;
  _key_hex text;
BEGIN
  IF NEW.document_number IS NOT NULL AND btrim(NEW.document_number) <> '' THEN
    _normalized := regexp_replace(NEW.document_number, '\D', '', 'g');
    IF length(_normalized) NOT IN (11, 14) THEN
      RAISE EXCEPTION 'invalid document number';
    END IF;
    _key_hex := encode(app_private.get_key('field_v1'), 'hex');
    NEW.document_number_enc := extensions.pgp_sym_encrypt(_normalized, _key_hex, 'cipher-algo=aes256');
    NEW.document_number_masked := public.mask_pix(CASE WHEN length(_normalized) = 14 THEN 'cnpj' ELSE 'cpf' END, _normalized);
    NEW.document_number_fingerprint := encode(extensions.hmac(convert_to(_normalized, 'UTF8'), app_private.get_key('field_v1'), 'sha256'), 'hex');
    NEW.document_number := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_document_encrypt ON public.profiles;
CREATE TRIGGER trg_profiles_document_encrypt
BEFORE INSERT OR UPDATE OF document_number ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_document_encrypt_tg();

UPDATE public.profiles
SET document_number_enc = extensions.pgp_sym_encrypt(
      regexp_replace(document_number, '\D', '', 'g'),
      encode(app_private.get_key('field_v1'), 'hex'),
      'cipher-algo=aes256'
    ),
    document_number_masked = public.mask_pix(
      CASE WHEN length(regexp_replace(document_number, '\D', '', 'g')) = 14 THEN 'cnpj' ELSE 'cpf' END,
      regexp_replace(document_number, '\D', '', 'g')
    ),
    document_number_fingerprint = encode(
      extensions.hmac(convert_to(regexp_replace(document_number, '\D', '', 'g'), 'UTF8'), app_private.get_key('field_v1'), 'sha256'),
      'hex'
    ),
    document_number = NULL
WHERE document_number IS NOT NULL AND btrim(document_number) <> '';

DROP INDEX IF EXISTS public.idx_profiles_document_unique;
DROP INDEX IF EXISTS public.idx_profiles_unique_document;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_document_fingerprint_unique
ON public.profiles(document_number_fingerprint)
WHERE document_number_fingerprint IS NOT NULL;

REVOKE SELECT (document_number, document_number_enc, document_number_fingerprint)
ON public.profiles FROM anon, authenticated;

-- API key hash versioning and automatic expiry.
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS hash_version text NOT NULL DEFAULT 'sha256';
ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_hash_version_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_hash_version_check CHECK (hash_version IN ('sha256', 'hmac-sha256'));

UPDATE public.api_keys
SET expires_at = COALESCE(expires_at, now() + interval '180 days')
WHERE is_active = true AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.api_keys_security_defaults_tg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.expires_at := COALESCE(NEW.expires_at, now() + interval '90 days');
  NEW.hash_version := COALESCE(NULLIF(NEW.hash_version, ''), 'hmac-sha256');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_api_keys_security_defaults ON public.api_keys;
CREATE TRIGGER trg_api_keys_security_defaults
BEFORE INSERT ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.api_keys_security_defaults_tg();

CREATE OR REPLACE FUNCTION public.verify_api_secret_v2(_prefix text, _hmac_hash text, _legacy_hash text)
RETURNS TABLE (api_key_id uuid, user_id uuid, permissions text[], ip_allowlist text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT k.id, k.user_id, k.permissions, k.ip_allowlist
  FROM public.api_keys k
  WHERE k.secret_key_prefix = _prefix
    AND (
      (k.hash_version = 'hmac-sha256' AND k.secret_key_hash = _hmac_hash)
      OR (k.hash_version = 'sha256' AND k.secret_key_hash = _legacy_hash)
    )
    AND k.is_active = true
    AND k.revoked_at IS NULL
    AND k.expires_at > now()
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_api_secret_v2(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_api_secret_v2(text, text, text) TO service_role;

-- Admin PII reveals: fail-closed rate limiting + immutable audit event.
CREATE OR REPLACE FUNCTION public.admin_reveal_pix_keys(_user_id uuid)
RETURNS TABLE (id uuid, key_type text, key_value text, is_default boolean, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE _allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT rl.allowed INTO _allowed FROM public.bump_rate_limit('admin_pii_reveal:' || auth.uid()::text, 600, 30) rl LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'pii_reveal_blocked', 'pix_keys', _user_id::text, jsonb_build_object('reason', 'rate_limit'));
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'pix_keys', _user_id::text, jsonb_build_object('fields', jsonb_build_array('key_value')));
  RETURN QUERY SELECT p.id, p.key_type,
    COALESCE(extensions.pgp_sym_decrypt(p.key_value_enc, encode(app_private.get_key('field_v1'),'hex')), p.key_value),
    p.is_default, p.created_at FROM public.pix_keys p WHERE p.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_pix_keys(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_pix_keys(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reveal_bank_accounts(_user_id uuid)
RETURNS TABLE (id uuid, bank_code text, bank_name text, agency text, account_number text, account_type text, holder_name text, holder_document text, is_default boolean, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE _allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT rl.allowed INTO _allowed FROM public.bump_rate_limit('admin_pii_reveal:' || auth.uid()::text, 600, 30) rl LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'pii_reveal_blocked', 'bank_accounts', _user_id::text, jsonb_build_object('reason', 'rate_limit'));
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'bank_accounts', _user_id::text, jsonb_build_object('fields', jsonb_build_array('account_number','holder_document')));
  RETURN QUERY SELECT b.id, b.bank_code, b.bank_name, b.agency,
    COALESCE(extensions.pgp_sym_decrypt(b.account_number_enc, encode(app_private.get_key('field_v1'),'hex')), b.account_number),
    b.account_type, b.holder_name,
    COALESCE(extensions.pgp_sym_decrypt(b.holder_document_enc, encode(app_private.get_key('field_v1'),'hex')), b.holder_document),
    b.is_default, b.created_at FROM public.bank_accounts b WHERE b.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_bank_accounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_bank_accounts(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reveal_profile(_user_id uuid)
RETURNS TABLE (user_id uuid, document_number text, pix_key text, pix_key_type text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE _allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT rl.allowed INTO _allowed FROM public.bump_rate_limit('admin_pii_reveal:' || auth.uid()::text, 600, 30) rl LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'pii_reveal_blocked', 'profile', _user_id::text, jsonb_build_object('reason', 'rate_limit'));
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'profile', _user_id::text, jsonb_build_object('fields', jsonb_build_array('document_number','pix_key')));
  RETURN QUERY SELECT p.user_id,
    COALESCE(extensions.pgp_sym_decrypt(p.document_number_enc, encode(app_private.get_key('field_v1'),'hex')), p.document_number),
    COALESCE(extensions.pgp_sym_decrypt(p.pix_key_enc, encode(app_private.get_key('field_v1'),'hex')), p.pix_key),
    p.pix_key_type FROM public.profiles p WHERE p.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_profile(uuid) TO authenticated, service_role;