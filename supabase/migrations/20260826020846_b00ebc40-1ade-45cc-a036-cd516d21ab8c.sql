-- Fechamento dos gaps residuais do Bloco 2

ALTER TABLE public.idempotency_keys
  ALTER COLUMN response DROP NOT NULL,
  ALTER COLUMN response DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.apply_staff_commission_on_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff uuid;
  _pct numeric;
  _amount numeric;
  _bal numeric;
  _idem text;
  _seller uuid;
  _net numeric;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'resolved_buyer' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.type, '') NOT IN ('medpix','pre_med_pix','refund','chargeback') THEN
    RETURN NEW;
  END IF;

  SELECT user_id, net_amount INTO _seller, _net
  FROM public.transactions
  WHERE id = NEW.transaction_id
  LIMIT 1;
  IF _seller IS NULL OR COALESCE(_net, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  _staff := public.resolve_commission_staff(_seller);
  IF _staff IS NULL THEN RETURN NEW; END IF;

  _pct := public.resolve_commission_pct(_staff, _seller);
  IF COALESCE(_pct, 0) <= 0 THEN RETURN NEW; END IF;

  _idem := 'comm_med_' || NEW.id || '_' || _staff;
  IF EXISTS (SELECT 1 FROM public.staff_commissions_ledger WHERE idempotency_key = _idem) THEN
    RETURN NEW;
  END IF;

  _amount := -ROUND((_net * _pct / 100)::numeric, 2);
  PERFORM pg_advisory_xact_lock(hashtext(_staff::text));
  _bal := public.get_staff_commission_balance(_staff);

  INSERT INTO public.staff_commissions_ledger
    (staff_user_id, seller_user_id, transaction_id, dispute_id, type, base_amount,
     pct, amount, balance_after, description, idempotency_key)
  VALUES
    (_staff, _seller, NEW.transaction_id, NEW.id, 'clawback_med', _net,
     _pct, _amount, _bal + _amount, 'MED resolvido: comissão revertida', _idem);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_staff_commission_on_dispute() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_staff_commission_on_dispute() TO service_role;

CREATE OR REPLACE FUNCTION public.protect_financial_ledger_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger is append-only; % is not allowed', TG_OP;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_financial_ledger_immutability() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_financial_ledger_immutability() TO service_role;

DROP TRIGGER IF EXISTS trg_protect_financial_ledger_immutability ON public.financial_ledger;
CREATE TRIGGER trg_protect_financial_ledger_immutability
BEFORE UPDATE OR DELETE ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.protect_financial_ledger_immutability();