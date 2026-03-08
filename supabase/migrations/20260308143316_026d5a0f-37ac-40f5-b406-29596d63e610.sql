
-- =============================================
-- PENTEST 20K SELLERS: Critical security fixes
-- =============================================

-- VULN 1 (CRITICAL): Users can self-approve KYC via profile UPDATE
-- The "Users can update own profile" policy allows updating account_status
-- Fix: Restrict user self-update to safe columns only via a trigger
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can change these sensitive fields
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.account_status := OLD.account_status;
    NEW.seller_type := OLD.seller_type;
    NEW.admin_notes := OLD.admin_notes;
    NEW.acquirer_id := OLD.acquirer_id;
    NEW.last_ip := OLD.last_ip;
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
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- VULN 2 (CRITICAL): validate_withdrawal_amount ignores balance_adjustments
-- A user with admin-debited balance could still withdraw full earnings
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_earned numeric;
  _total_withdrawn numeric;
  _adjustments numeric;
  _available numeric;
BEGIN
  -- Advisory lock per user to prevent concurrent withdrawal race condition
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  -- Calculate total net earnings from completed transactions
  SELECT COALESCE(SUM(net_amount), 0) INTO _total_earned
  FROM public.transactions
  WHERE user_id = NEW.user_id AND status = 'completed';

  -- Calculate total approved/pending withdrawals (excluding current)
  SELECT COALESCE(SUM(amount), 0) INTO _total_withdrawn
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved') 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Include balance adjustments (credits add, debits subtract)
  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) INTO _adjustments
  FROM public.balance_adjustments
  WHERE user_id = NEW.user_id;

  _available := _total_earned + _adjustments - _total_withdrawn;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor de saque deve ser positivo';
  END IF;

  RETURN NEW;
END;
$$;

-- VULN 3 (HIGH): Revoke EXECUTE on all SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.enforce_max_pix_keys() FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_access_on_payment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_withdrawal_amount() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_product_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_course_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon;

-- VULN 4 (MEDIUM): Prevent negative withdrawal amounts at DB level
ALTER TABLE public.withdrawals ADD CONSTRAINT check_positive_amount CHECK (amount > 0);
ALTER TABLE public.withdrawals ADD CONSTRAINT check_positive_fee CHECK (fee_amount >= 0);

-- VULN 5 (MEDIUM): Prevent negative transaction amounts
ALTER TABLE public.transactions ADD CONSTRAINT check_positive_tx_amount CHECK (amount >= 0);
