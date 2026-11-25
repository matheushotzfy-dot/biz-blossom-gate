-- Auditoria de segurança (#63): três furos encontrados com ataque simulado como usuário comum logado.
--
-- 1) api_keys: qualquer usuário logado criava a própria chave direto na tabela, com `permissions`
--    arbitrárias (ex.: '*', 'admin') e um hash escolhido por ele. Chave só nasce na função de borda
--    `generate-api-key` (service_role). Também não deixa mais ampliar `permissions` depois de criada.
-- 2) profiles: `document_number_enc`, `document_number_masked` e `document_number_fingerprint` podiam ser
--    sobrescritos pelo dono (burlava a trava de CPF/CNPJ duplicado e o CPF mascarado que o admin vê), e o
--    `document_number` podia ser trocado a qualquer momento: como o valor em claro é sempre zerado pelo
--    trigger de cifra, a conferência antiga (`OLD.document_number IS NOT NULL`) nunca valia.
--    O mesmo vale para `pix_key_enc` (cifrado gravado direto, sem passar pelo trigger).
-- 3) get_product_link_status / get_public_products: o LIKE tratava "_" do slug como curinga e podia
--    devolver outro produto; agora o final do endereço tem que ser idêntico.

-- ── 1) Chaves de API ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create own api_keys" ON public.api_keys;
REVOKE INSERT ON public.api_keys FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.guard_api_keys_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'api_keys_created_by_server' USING ERRCODE = 'insufficient_privilege';
END $function$;

CREATE OR REPLACE FUNCTION public.guard_api_keys_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.public_key IS DISTINCT FROM OLD.public_key
     OR NEW.secret_key_hash IS DISTINCT FROM OLD.secret_key_hash
     OR NEW.secret_key_prefix IS DISTINCT FROM OLD.secret_key_prefix
     OR NEW.hash_version IS DISTINCT FROM OLD.hash_version
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.last_used_at IS DISTINCT FROM OLD.last_used_at THEN
    RAISE EXCEPTION 'api_key_immutable_fields';
  END IF;
  -- O dono só pode estreitar o que a chave faz, nunca ampliar.
  IF NEW.permissions IS DISTINCT FROM OLD.permissions
     AND (NEW.permissions IS NULL OR OLD.permissions IS NULL OR NOT (NEW.permissions <@ OLD.permissions)) THEN
    RAISE EXCEPTION 'api_key_permissions_cannot_grow';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS NULL OR NEW.is_active) THEN
    RAISE EXCEPTION 'api_key_revoked_permanently';
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at
     AND (NEW.expires_at IS NULL OR (OLD.expires_at IS NOT NULL AND NEW.expires_at > OLD.expires_at)) THEN
    RAISE EXCEPTION 'api_key_expiry_cannot_extend';
  END IF;
  RETURN NEW;
END $function$;

-- ── 2) Perfil: documento e chave Pix ─────────────────────────────────────────────────────────
-- Esta função roda ANTES dos triggers de cifra (ordem alfabética: trg_guard_… < trg_profiles_…).
-- Por isso ela devolve as colunas derivadas ao valor antigo e deixa o trigger de cifra recalcular
-- só quando o dono manda um `document_number`/`pix_key` em claro, que é a única origem permitida.
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_caller, 'admin'::app_role) OR public.has_role(_caller, 'manager'::app_role) THEN RETURN NEW; END IF;
  NEW.id := OLD.id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
  IF current_setting('app.kyc_submit', true) = 'on'
     AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review' THEN
    NULL;
  ELSIF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida' USING ERRCODE='insufficient_privilege', HINT='profile_restricted_field';
  END IF;
  IF NEW.frozen IS DISTINCT FROM OLD.frozen
     OR NEW.balance_frozen IS DISTINCT FROM OLD.balance_frozen
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason
     OR (NEW.address_locked IS DISTINCT FROM OLD.address_locked
         AND NOT (COALESCE(OLD.address_locked, false) = false AND NEW.address_locked = true))
     OR NEW.boleto_enabled IS DISTINCT FROM OLD.boleto_enabled
     OR NEW.credit_card_enabled IS DISTINCT FROM OLD.credit_card_enabled
     OR NEW.acquirer_id IS DISTINCT FROM OLD.acquirer_id
     OR NEW.seller_type IS DISTINCT FROM OLD.seller_type
     OR NEW.staff_role_type IS DISTINCT FROM OLD.staff_role_type
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.created_by_admin IS DISTINCT FROM OLD.created_by_admin
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida' USING ERRCODE='insufficient_privilege', HINT='profile_restricted_field';
  END IF;
  NEW.email := OLD.email; NEW.last_ip := OLD.last_ip; NEW.last_login_at := OLD.last_login_at;
  IF COALESCE(OLD.address_locked, false) = true THEN
    IF NEW.street IS DISTINCT FROM OLD.street OR NEW.street_number IS DISTINCT FROM OLD.street_number
       OR NEW.complement IS DISTINCT FROM OLD.complement OR NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
       OR NEW.city IS DISTINCT FROM OLD.city OR NEW.state IS DISTINCT FROM OLD.state OR NEW.zip_code IS DISTINCT FROM OLD.zip_code THEN
      RAISE EXCEPTION 'Endereço travado: contate o suporte para alterar' USING ERRCODE='insufficient_privilege', HINT='address_locked';
    END IF;
  END IF;

  -- Documento: depois de cadastrado, só suporte/admin altera. O valor em claro nunca fica guardado
  -- (o trigger de cifra o zera), então a trava olha para o cifrado.
  IF OLD.document_number_enc IS NOT NULL THEN
    IF NEW.document_number IS NOT NULL AND btrim(NEW.document_number) <> '' THEN
      RAISE EXCEPTION 'Documento já cadastrado não pode ser alterado' USING ERRCODE='insufficient_privilege', HINT='document_locked';
    END IF;
    NEW.document_type := OLD.document_type;
  END IF;
  -- Colunas derivadas só nascem dos triggers de cifra.
  NEW.document_number_enc := OLD.document_number_enc;
  NEW.document_number_masked := OLD.document_number_masked;
  NEW.document_number_fingerprint := OLD.document_number_fingerprint;
  NEW.pix_key_enc := OLD.pix_key_enc;
  NEW.pix_key_masked := OLD.pix_key_masked;
  RETURN NEW;
END $function$;

-- ── 3) Slug com "_" não vira curinga ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.get_product_link_status(_slug text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.status FROM public.products p
  WHERE _slug ~ '^[A-Za-z0-9_-]{1,64}$' AND p.deleted_at IS NULL
    AND (right(p.checkout_url, length('/pay/' || _slug)) = '/pay/' || _slug
         OR right(p.checkout_url, length('/checkout/' || _slug)) = '/checkout/' || _slug
         OR p.checkout_url = _slug)
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_public_products(_slug text DEFAULT NULL::text, _ids uuid[] DEFAULT NULL::uuid[])
RETURNS SETOF public_product_catalog
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
 SELECT c.* FROM public.public_product_catalog c WHERE CASE
  WHEN _slug IS NOT NULL THEN trim(_slug) ~ '^[A-Za-z0-9_-]{1,64}$' AND (
        c.checkout_url = trim(_slug) OR c.checkout_url = '/' || trim(_slug)
     OR right(c.checkout_url, length('/pay/' || trim(_slug))) = '/pay/' || trim(_slug)
     OR right(c.checkout_url, length('/checkout/' || trim(_slug))) = '/checkout/' || trim(_slug))
  WHEN _ids IS NOT NULL AND cardinality(_ids) BETWEEN 1 AND 20 THEN c.id=ANY(_ids)
  ELSE false END
 ORDER BY c.product_created_at DESC LIMIT CASE WHEN _slug IS NOT NULL THEN 1 ELSE 20 END;
$function$;
