-- 1) Restrict self-update policy to authenticated users only
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) Whitelist-based guard: everything not explicitly editable by the owner
--    is forced back to its previous value; privileged fields raise.
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  -- service_role / internal triggers (no auth.uid) pass through
  IF _caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(_caller, 'admin'::app_role)
     OR public.has_role(_caller, 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Identity columns can never change
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;

  -- Privileged / administrative columns: hard block
  IF NEW.frozen IS DISTINCT FROM OLD.frozen
     OR NEW.balance_frozen IS DISTINCT FROM OLD.balance_frozen
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason
     OR NEW.address_locked IS DISTINCT FROM OLD.address_locked
     OR NEW.boleto_enabled IS DISTINCT FROM OLD.boleto_enabled
     OR NEW.credit_card_enabled IS DISTINCT FROM OLD.credit_card_enabled
     OR NEW.acquirer_id IS DISTINCT FROM OLD.acquirer_id
     OR NEW.seller_type IS DISTINCT FROM OLD.seller_type
     OR NEW.staff_role_type IS DISTINCT FROM OLD.staff_role_type
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.created_by_admin IS DISTINCT FROM OLD.created_by_admin
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
  THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida'
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'profile_restricted_field';
  END IF;

  -- System-managed columns: silently preserved (never user-writable)
  NEW.email := OLD.email;
  NEW.last_ip := OLD.last_ip;
  NEW.last_login_at := OLD.last_login_at;
  NEW.pix_key_masked := OLD.pix_key_masked;
  NEW.pix_key_enc := COALESCE(NEW.pix_key_enc, OLD.pix_key_enc);

  -- Address lock
  IF COALESCE(OLD.address_locked, false) = true THEN
    IF NEW.street IS DISTINCT FROM OLD.street
       OR NEW.street_number IS DISTINCT FROM OLD.street_number
       OR NEW.complement IS DISTINCT FROM OLD.complement
       OR NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
       OR NEW.city IS DISTINCT FROM OLD.city
       OR NEW.state IS DISTINCT FROM OLD.state
       OR NEW.zip_code IS DISTINCT FROM OLD.zip_code
    THEN
      RAISE EXCEPTION 'Endereço travado: contate o suporte para alterar'
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'address_locked';
    END IF;
  END IF;

  -- Document can only be set once
  IF OLD.document_number IS NOT NULL
     AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
    RAISE EXCEPTION 'Documento já cadastrado não pode ser alterado'
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'document_locked';
  END IF;

  RETURN NEW;
END;
$$;