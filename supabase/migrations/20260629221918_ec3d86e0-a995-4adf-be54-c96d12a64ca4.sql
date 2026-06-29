
-- =========================================================
-- Admin decryption RPCs (admin sees full plaintext, others see masked)
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_decrypt_field(_cipher bytea)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE
  _k bytea;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _cipher IS NULL THEN RETURN NULL; END IF;
  _k := app_private.get_key('field_v1');
  RETURN extensions.pgp_sym_decrypt(_cipher, encode(_k, 'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_decrypt_field(bytea) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_decrypt_field(bytea) TO authenticated, service_role;

-- Reveal all PIX keys of a seller in plaintext (admin only)
CREATE OR REPLACE FUNCTION public.admin_reveal_pix_keys(_user_id uuid)
RETURNS TABLE (id uuid, key_type text, key_value text, is_default boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_private, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT p.id, p.key_type,
         COALESCE(extensions.pgp_sym_decrypt(p.key_value_enc, encode(app_private.get_key('field_v1'),'hex')), p.key_value),
         p.is_default, p.created_at
  FROM public.pix_keys p
  WHERE p.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_pix_keys(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_pix_keys(uuid) TO authenticated, service_role;

-- Reveal bank accounts in plaintext (admin only)
CREATE OR REPLACE FUNCTION public.admin_reveal_bank_accounts(_user_id uuid)
RETURNS TABLE (
  id uuid, bank_code text, bank_name text, agency text,
  account_number text, account_type text, holder_name text, holder_document text,
  is_default boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_private, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT b.id, b.bank_code, b.bank_name, b.agency,
         COALESCE(extensions.pgp_sym_decrypt(b.account_number_enc, encode(app_private.get_key('field_v1'),'hex')), b.account_number),
         b.account_type, b.holder_name,
         COALESCE(extensions.pgp_sym_decrypt(b.holder_document_enc, encode(app_private.get_key('field_v1'),'hex')), b.holder_document),
         b.is_default, b.created_at
  FROM public.bank_accounts b
  WHERE b.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_bank_accounts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_bank_accounts(uuid) TO authenticated, service_role;

-- Reveal profile sensitive fields (document_number, pix_key) in plaintext
CREATE OR REPLACE FUNCTION public.admin_reveal_profile(_user_id uuid)
RETURNS TABLE (user_id uuid, document_number text, pix_key text, pix_key_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_private, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT p.user_id,
         COALESCE(extensions.pgp_sym_decrypt(p.document_number_enc, encode(app_private.get_key('field_v1'),'hex')), p.document_number),
         COALESCE(extensions.pgp_sym_decrypt(p.pix_key_enc, encode(app_private.get_key('field_v1'),'hex')), p.pix_key),
         p.pix_key_type
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reveal_profile(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveal_profile(uuid) TO authenticated, service_role;

-- =========================================================
-- Withdrawal failure diagnostics
-- =========================================================
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS acquirer_response jsonb,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

COMMENT ON COLUMN public.withdrawals.failure_code IS 'Short machine-readable failure code (e.g. invalid_pix_key, bank_refused, insufficient_funds)';
COMMENT ON COLUMN public.withdrawals.acquirer_response IS 'Full raw response from the acquirer for admin diagnostics';
