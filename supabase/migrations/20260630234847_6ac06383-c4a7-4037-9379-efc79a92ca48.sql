CREATE OR REPLACE FUNCTION public.enforce_account_status_on_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _frozen boolean;
BEGIN
  SELECT account_status, balance_frozen INTO _status, _frozen
    FROM public.profiles WHERE user_id = NEW.user_id;

  IF _status = 'blocked' THEN
    RAISE EXCEPTION 'Conta bloqueada — não é possível criar produtos';
  END IF;
  IF _status = 'rejected' THEN
    RAISE EXCEPTION 'KYC rejeitado — regularize seus dados antes de criar produtos';
  END IF;
  IF COALESCE(_status, 'pending') NOT IN ('approved', 'active') THEN
    RAISE EXCEPTION 'KYC pendente — aguarde a aprovação para criar produtos';
  END IF;
  IF _frozen = true THEN
    RAISE EXCEPTION 'Conta congelada — criação de produtos suspensa';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_account_status_on_product() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_account_status_on_product ON public.products;
CREATE TRIGGER trg_enforce_account_status_on_product
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_account_status_on_product();