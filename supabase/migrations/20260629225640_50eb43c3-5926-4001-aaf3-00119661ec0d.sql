CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ledger_balance numeric;
  _retained numeric;
  _pending_withdrawn numeric;
  _available numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  -- Ledger balance already reflects: credits, splits, affiliate, refunds, chargebacks, adjustments, retained debits, retention releases, completed withdrawals.
  _ledger_balance := public.get_ledger_balance(NEW.user_id);

  -- Pending/approved withdrawals not yet reflected in the ledger (ledger only debits when status transitions).
  -- The ledger_on_withdrawal_change trigger writes the 'withdrawal' debit on INSERT regardless of status,
  -- so other pending rows are ALREADY in the ledger. We exclude the current row by id.
  SELECT COALESCE(SUM(w.amount), 0) INTO _pending_withdrawn
  FROM public.withdrawals w
  WHERE w.user_id = NEW.user_id
    AND w.status = 'rejected'
    AND w.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  -- (rejected withdrawals had reversal credits, so ledger balance is correct; nothing to subtract)
  _pending_withdrawn := 0;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor de saque deve ser positivo';
  END IF;

  -- Available = ledger balance (already excludes everything debited).
  _available := _ledger_balance;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the validate trigger fires BEFORE the ledger trigger so we don't debit then reject.
DROP TRIGGER IF EXISTS validate_withdrawal_amount_before_insert ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_amount_before_insert
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_amount();