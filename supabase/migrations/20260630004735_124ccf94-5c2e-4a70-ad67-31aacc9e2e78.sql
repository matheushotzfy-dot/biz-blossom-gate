
-- =========================================================
-- M1+M2: Server-side admin actions with atomic audit trail
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_freeze_account(_user_id uuid, _freeze boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
     SET balance_frozen = _freeze
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    _caller,
    CASE WHEN _freeze THEN 'freeze_balance' ELSE 'unfreeze_balance' END,
    'profile',
    _user_id::text,
    jsonb_build_object('freeze', _freeze, 'reason', _reason)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_freeze_account(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_freeze_account(uuid, boolean, text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_approve_kyc(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
     SET account_status = 'approved',
         kyc_rejection_reason = NULL
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    _caller,
    'approve_kyc',
    'profile',
    _user_id::text,
    jsonb_build_object('new_status', 'approved')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_approve_kyc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_reject_kyc(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _r text := COALESCE(NULLIF(btrim(_reason), ''), 'sem motivo informado');
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
     SET account_status = 'rejected',
         kyc_rejection_reason = _r
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    _caller,
    'reject_kyc',
    'profile',
    _user_id::text,
    jsonb_build_object('reason', _r)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reject_kyc(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(uuid, text) TO authenticated, service_role;


-- =========================================================
-- M4: Log PII reveal events (LGPD)
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_reveal_pix_keys(_user_id uuid)
RETURNS TABLE (id uuid, key_type text, key_value text, is_default boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_private, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'pix_keys', _user_id::text,
          jsonb_build_object('fields', jsonb_build_array('key_value')));

  RETURN QUERY
  SELECT p.id, p.key_type,
         COALESCE(extensions.pgp_sym_decrypt(p.key_value_enc, encode(app_private.get_key('field_v1'),'hex')), p.key_value),
         p.is_default, p.created_at
  FROM public.pix_keys p
  WHERE p.user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reveal_profile(_user_id uuid)
RETURNS TABLE (user_id uuid, document_number text, pix_key text, pix_key_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_private, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'profile', _user_id::text,
          jsonb_build_object('fields', jsonb_build_array('document_number','pix_key')));

  RETURN QUERY
  SELECT p.user_id,
         COALESCE(extensions.pgp_sym_decrypt(p.document_number_enc, encode(app_private.get_key('field_v1'),'hex')), p.document_number),
         COALESCE(extensions.pgp_sym_decrypt(p.pix_key_enc, encode(app_private.get_key('field_v1'),'hex')), p.pix_key),
         p.pix_key_type
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;

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

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'pii_reveal', 'bank_accounts', _user_id::text,
          jsonb_build_object('fields', jsonb_build_array('account_number','holder_document')));

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
