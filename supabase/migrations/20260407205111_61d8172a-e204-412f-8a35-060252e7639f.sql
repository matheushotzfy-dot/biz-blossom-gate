-- Critical: Server-side withdrawal validation trigger
CREATE OR REPLACE FUNCTION public.validate_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  available_balance numeric;
  withdrawal_fee numeric := 5.00; -- R$ 5.00 fixed fee
  custom_fee numeric;
BEGIN
  -- Only validate on INSERT
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- 1. Validate amount > 0
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor do saque deve ser maior que zero';
  END IF;

  -- 2. Validate amount is not absurdly large
  IF NEW.amount > 500000 THEN
    RAISE EXCEPTION 'Valor máximo por saque: R$ 500.000,00';
  END IF;

  -- 3. Force status to pending (prevent user from setting status)
  NEW.status := 'pending';
  NEW.processed_at := NULL;

  -- 4. Check for custom withdrawal fee
  SELECT cuf.withdrawal_fee INTO custom_fee
  FROM custom_user_fees cuf
  WHERE cuf.user_id = NEW.user_id
  LIMIT 1;

  IF custom_fee IS NOT NULL THEN
    withdrawal_fee := custom_fee;
  END IF;

  -- 5. Calculate fee and net amount server-side
  NEW.fee_amount := withdrawal_fee;
  NEW.net_amount := NEW.amount - withdrawal_fee;

  IF NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'Valor insuficiente após taxa de saque de R$ %', withdrawal_fee;
  END IF;

  -- 6. Get user's available balance with advisory lock (prevent race condition)
  PERFORM pg_advisory_xact_lock(hashtext('withdrawal_' || NEW.user_id::text));

  SELECT COALESCE(
    (SELECT balance_after FROM financial_ledger 
     WHERE user_id = NEW.user_id 
     ORDER BY created_at DESC LIMIT 1),
    0
  ) INTO available_balance;

  -- Subtract pending withdrawals (not yet processed)
  available_balance := available_balance - COALESCE(
    (SELECT SUM(amount) FROM withdrawals 
     WHERE user_id = NEW.user_id 
     AND status = 'pending'),
    0
  );

  IF NEW.amount > available_balance THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(available_balance, 2);
  END IF;

  -- 7. Prevent manipulation of user_id (must match auth.uid())
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_validate_withdrawal ON public.withdrawals;
CREATE TRIGGER trg_validate_withdrawal
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_withdrawal();

-- Also prevent users from updating their own withdrawals (only admins can)
CREATE POLICY "deny_user_update_withdrawals"
ON public.withdrawals
FOR UPDATE
TO authenticated
USING (false);

-- But admins can still update (already exists via "Admins can update withdrawals")
