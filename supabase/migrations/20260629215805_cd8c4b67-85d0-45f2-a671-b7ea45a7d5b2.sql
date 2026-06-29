-- Blindagem contra mass-assignment em public.profiles
-- Bloqueia que sellers alterem colunas sensíveis via UPDATE direto (PostgREST/Supabase JS)
-- Admin/manager continuam podendo via has_role()

CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  -- service_role / triggers internos (sem auth.uid) passam
  IF _caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin e manager podem alterar qualquer campo
  IF public.has_role(_caller, 'admin'::app_role)
     OR public.has_role(_caller, 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Para qualquer outro usuário (inclusive o dono do profile),
  -- bloquear alterações em colunas administrativas/sensíveis.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Não é permitido alterar user_id do perfil';
  END IF;

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

  -- Se endereço está travado, sellers não podem alterar endereço
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

  -- Documento (CPF/CNPJ) só pode ser definido uma vez por seller
  IF OLD.document_number IS NOT NULL
     AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
    RAISE EXCEPTION 'Documento já cadastrado não pode ser alterado'
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'document_locked';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_self_update();