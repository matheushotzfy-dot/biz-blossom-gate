
-- Add balance_frozen and kyc_rejection_reason to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;

-- Update protect_profile_fields to protect balance_frozen
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (auth.uid() IS NULL) full access
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only admins can change these sensitive fields
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.account_status := OLD.account_status;
    NEW.seller_type := OLD.seller_type;
    NEW.admin_notes := OLD.admin_notes;
    NEW.acquirer_id := OLD.acquirer_id;
    NEW.last_ip := OLD.last_ip;
    NEW.balance_frozen := OLD.balance_frozen;
    NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  END IF;
  
  -- Immutable fields after first set (KYC compliance)
  IF OLD.document_number IS NOT NULL AND OLD.document_number != '' THEN
    NEW.document_number := OLD.document_number;
    NEW.document_type := OLD.document_type;
  END IF;
  IF OLD.full_name IS NOT NULL AND OLD.full_name != '' THEN
    NEW.full_name := OLD.full_name;
  END IF;
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    NEW.email := OLD.email;
  END IF;
  IF OLD.phone IS NOT NULL AND OLD.phone != '' THEN
    NEW.phone := OLD.phone;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the trigger is attached
DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Update validate_withdrawal_amount to check balance_frozen
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total_earned numeric;
  _total_withdrawn numeric;
  _adjustments numeric;
  _retained numeric;
  _available numeric;
  _frozen boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  -- Check if balance is frozen
  SELECT COALESCE(balance_frozen, false) INTO _frozen
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  IF _frozen THEN
    RAISE EXCEPTION 'Saldo congelado. Saques bloqueados pelo administrador.';
  END IF;

  -- Total net earnings from completed transactions
  SELECT COALESCE(SUM(net_amount), 0) INTO _total_earned
  FROM public.transactions
  WHERE user_id = NEW.user_id AND status = 'completed';

  -- Subtract retained amounts not yet released
  SELECT COALESCE(SUM(retained_amount), 0) INTO _retained
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND status = 'completed' 
    AND retention_released = false 
    AND retained_amount > 0;

  -- Existing pending/approved withdrawals (exclude self)
  SELECT COALESCE(SUM(amount), 0) INTO _total_withdrawn
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Balance adjustments
  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) INTO _adjustments
  FROM public.balance_adjustments
  WHERE user_id = NEW.user_id;

  _available := _total_earned - _retained + _adjustments - _total_withdrawn;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor de saque deve ser positivo';
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach withdrawal triggers
DROP TRIGGER IF EXISTS trg_validate_withdrawal_amount ON public.withdrawals;
CREATE TRIGGER trg_validate_withdrawal_amount
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_amount();

-- Add index for KYC queue
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
