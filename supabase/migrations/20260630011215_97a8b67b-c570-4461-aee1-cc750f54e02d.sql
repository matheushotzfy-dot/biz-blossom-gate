CREATE OR REPLACE FUNCTION public.validate_balance_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _available numeric;
BEGIN
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF NEW.amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum'; END IF;
  IF NEW.type NOT IN ('credit', 'debit') THEN RAISE EXCEPTION 'Invalid type'; END IF;
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 3 THEN RAISE EXCEPTION 'Reason required (min 3 chars)'; END IF;
  IF length(NEW.reason) > 1000 THEN RAISE EXCEPTION 'Reason too long (max 1000 chars)'; END IF;

  -- Block debits that would push the ledger negative (single source of truth)
  IF NEW.type = 'debit' THEN
    _available := public.get_ledger_balance(NEW.user_id);
    IF NEW.amount > _available THEN
      RAISE EXCEPTION 'Débito excede saldo disponível. Disponível: R$ %, tentado: R$ %',
        ROUND(_available, 2), ROUND(NEW.amount, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;