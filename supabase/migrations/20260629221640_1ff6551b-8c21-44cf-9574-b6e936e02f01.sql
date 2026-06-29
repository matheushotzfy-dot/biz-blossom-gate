
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM public, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS app_private.encryption_keys (
  name text PRIMARY KEY,
  key  bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.encryption_keys FROM public, anon, authenticated, service_role;

INSERT INTO app_private.encryption_keys(name, key)
VALUES ('field_v1', extensions.gen_random_bytes(32))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION app_private.get_key(_name text)
RETURNS bytea LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app_private AS $$
  SELECT key FROM app_private.encryption_keys WHERE name = _name;
$$;
REVOKE ALL ON FUNCTION app_private.get_key(text) FROM public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.encrypt_field(_plain text)
RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, app_private, extensions AS $$
DECLARE _k bytea;
BEGIN
  IF _plain IS NULL OR length(trim(_plain)) = 0 THEN RETURN NULL; END IF;
  _k := app_private.get_key('field_v1');
  IF _k IS NULL THEN RAISE EXCEPTION 'encryption key not configured'; END IF;
  RETURN extensions.pgp_sym_encrypt(_plain, encode(_k, 'hex'), 'cipher-algo=aes256');
END;
$$;
REVOKE ALL ON FUNCTION public.encrypt_field(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_field(text) TO service_role;

CREATE OR REPLACE FUNCTION public.decrypt_field(_cipher bytea)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, app_private, extensions AS $$
DECLARE _k bytea;
BEGIN
  IF _cipher IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(_cipher, encode(app_private.get_key('field_v1'), 'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.decrypt_field(bytea) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_field(bytea) TO service_role;

CREATE OR REPLACE FUNCTION public.mask_tail(_v text, _keep int DEFAULT 4)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _v IS NULL OR length(_v) = 0 THEN NULL
    WHEN length(_v) <= _keep THEN repeat('*', length(_v))
    ELSE repeat('*', length(_v) - _keep) || right(_v, _keep)
  END;
$$;

CREATE OR REPLACE FUNCTION public.mask_pix(_kind text, _v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _v IS NULL THEN NULL
    WHEN _kind = 'email' THEN regexp_replace(_v, '([^@]{1,2})[^@]*@', '\1***@')
    WHEN _kind IN ('cpf','document') THEN
      CASE WHEN length(regexp_replace(_v,'\D','','g')) >= 11
        THEN left(regexp_replace(_v,'\D','','g'),3) || '.***.***-' || right(regexp_replace(_v,'\D','','g'),2)
        ELSE public.mask_tail(_v,2) END
    WHEN _kind = 'cnpj' THEN
      left(regexp_replace(_v,'\D','','g'),2) || '.***.***/****-' || right(regexp_replace(_v,'\D','','g'),2)
    WHEN _kind = 'phone' THEN
      '(' || left(regexp_replace(_v,'\D','','g'),2) || ') *****-' || right(regexp_replace(_v,'\D','','g'),4)
    ELSE public.mask_tail(_v, 4)
  END;
$$;

-- ============ pix_keys ============
ALTER TABLE public.pix_keys
  ADD COLUMN IF NOT EXISTS key_value_enc bytea,
  ADD COLUMN IF NOT EXISTS key_value_masked text;
ALTER TABLE public.pix_keys ALTER COLUMN key_value DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.pix_keys_encrypt_tg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key_value IS NOT NULL AND length(trim(NEW.key_value)) > 0 THEN
    NEW.key_value_enc := public.encrypt_field(NEW.key_value);
    NEW.key_value_masked := public.mask_pix(COALESCE(NEW.key_type,'other'), NEW.key_value);
    NEW.key_value := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pix_keys_encrypt ON public.pix_keys;
CREATE TRIGGER trg_pix_keys_encrypt
  BEFORE INSERT OR UPDATE OF key_value ON public.pix_keys
  FOR EACH ROW EXECUTE FUNCTION public.pix_keys_encrypt_tg();

UPDATE public.pix_keys
SET key_value_enc = public.encrypt_field(key_value),
    key_value_masked = public.mask_pix(COALESCE(key_type,'other'), key_value),
    key_value = NULL
WHERE key_value IS NOT NULL AND key_value_enc IS NULL;

REVOKE SELECT (key_value) ON public.pix_keys FROM anon, authenticated;
REVOKE SELECT (key_value_enc) ON public.pix_keys FROM anon, authenticated;

-- ============ bank_accounts ============
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS account_number_enc bytea,
  ADD COLUMN IF NOT EXISTS account_number_masked text,
  ADD COLUMN IF NOT EXISTS holder_document_enc bytea,
  ADD COLUMN IF NOT EXISTS holder_document_masked text;
ALTER TABLE public.bank_accounts ALTER COLUMN account_number DROP NOT NULL;
ALTER TABLE public.bank_accounts ALTER COLUMN holder_document DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.bank_accounts_encrypt_tg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_number IS NOT NULL AND length(trim(NEW.account_number)) > 0 THEN
    NEW.account_number_enc := public.encrypt_field(NEW.account_number);
    NEW.account_number_masked := public.mask_tail(NEW.account_number, 4);
    NEW.account_number := NULL;
  END IF;
  IF NEW.holder_document IS NOT NULL AND length(trim(NEW.holder_document)) > 0 THEN
    NEW.holder_document_enc := public.encrypt_field(NEW.holder_document);
    NEW.holder_document_masked := public.mask_pix(
      CASE WHEN length(regexp_replace(NEW.holder_document,'\D','','g')) > 11 THEN 'cnpj' ELSE 'cpf' END,
      NEW.holder_document);
    NEW.holder_document := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bank_accounts_encrypt ON public.bank_accounts;
CREATE TRIGGER trg_bank_accounts_encrypt
  BEFORE INSERT OR UPDATE OF account_number, holder_document ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.bank_accounts_encrypt_tg();

UPDATE public.bank_accounts
SET account_number_enc = public.encrypt_field(account_number),
    account_number_masked = public.mask_tail(account_number, 4),
    account_number = NULL
WHERE account_number IS NOT NULL AND account_number_enc IS NULL;

UPDATE public.bank_accounts
SET holder_document_enc = public.encrypt_field(holder_document),
    holder_document_masked = public.mask_pix(
      CASE WHEN length(regexp_replace(holder_document,'\D','','g')) > 11 THEN 'cnpj' ELSE 'cpf' END,
      holder_document),
    holder_document = NULL
WHERE holder_document IS NOT NULL AND holder_document_enc IS NULL;

REVOKE SELECT (account_number) ON public.bank_accounts FROM anon, authenticated;
REVOKE SELECT (account_number_enc) ON public.bank_accounts FROM anon, authenticated;
REVOKE SELECT (holder_document) ON public.bank_accounts FROM anon, authenticated;
REVOKE SELECT (holder_document_enc) ON public.bank_accounts FROM anon, authenticated;

-- ============ profiles.pix_key ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_key_enc bytea,
  ADD COLUMN IF NOT EXISTS pix_key_masked text;

CREATE OR REPLACE FUNCTION public.profiles_pix_encrypt_tg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pix_key IS NOT NULL AND length(trim(NEW.pix_key)) > 0 THEN
    NEW.pix_key_enc := public.encrypt_field(NEW.pix_key);
    NEW.pix_key_masked := public.mask_pix(COALESCE(NEW.pix_key_type,'other'), NEW.pix_key);
    NEW.pix_key := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_profiles_pix_encrypt ON public.profiles;
CREATE TRIGGER trg_profiles_pix_encrypt
  BEFORE INSERT OR UPDATE OF pix_key ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_pix_encrypt_tg();

UPDATE public.profiles
SET pix_key_enc = public.encrypt_field(pix_key),
    pix_key_masked = public.mask_pix(COALESCE(pix_key_type,'other'), pix_key),
    pix_key = NULL
WHERE pix_key IS NOT NULL AND pix_key_enc IS NULL;

REVOKE SELECT (pix_key) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (pix_key_enc) ON public.profiles FROM anon, authenticated;
