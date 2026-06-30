CREATE OR REPLACE FUNCTION public.enforce_kyc_on_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _frozen boolean;
BEGIN
  SELECT account_status, frozen INTO _status, _frozen
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF _frozen IS TRUE THEN
    RAISE EXCEPTION 'Conta congelada. Saques bloqueados.';
  END IF;

  IF COALESCE(_status, 'pending') <> 'approved' THEN
    RAISE EXCEPTION 'KYC pendente. Complete a verificação de identidade antes de solicitar saques.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kyc_on_withdrawal ON public.withdrawals;
CREATE TRIGGER trg_enforce_kyc_on_withdrawal
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_kyc_on_withdrawal();

REVOKE ALL ON FUNCTION public.enforce_kyc_on_withdrawal() FROM PUBLIC, anon, authenticated;