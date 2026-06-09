
CREATE OR REPLACE FUNCTION public.enforce_manager_fee_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limits record;
BEGIN
  IF auth.uid() IS NULL OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NOT has_role(auth.uid(), 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT min_transaction_percentage, min_transaction_fixed, min_withdrawal_fee
    INTO _limits
  FROM public.manager_fee_limits
  ORDER BY created_at DESC
  LIMIT 1;

  IF _limits IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.transaction_percentage IS NOT NULL AND NEW.transaction_percentage < _limits.min_transaction_percentage THEN
    RAISE EXCEPTION 'Taxa percentual abaixo do mínimo permitido para gerentes (%)', _limits.min_transaction_percentage;
  END IF;
  IF NEW.transaction_fixed IS NOT NULL AND NEW.transaction_fixed < _limits.min_transaction_fixed THEN
    RAISE EXCEPTION 'Taxa fixa abaixo do mínimo permitido para gerentes (R$ %)', _limits.min_transaction_fixed;
  END IF;
  IF NEW.withdrawal_fee IS NOT NULL AND NEW.withdrawal_fee < _limits.min_withdrawal_fee THEN
    RAISE EXCEPTION 'Taxa de saque abaixo do mínimo permitido para gerentes (R$ %)', _limits.min_withdrawal_fee;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_manager_fee_limits ON public.custom_user_fees;
CREATE TRIGGER trg_enforce_manager_fee_limits
  BEFORE INSERT OR UPDATE ON public.custom_user_fees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_manager_fee_limits();
