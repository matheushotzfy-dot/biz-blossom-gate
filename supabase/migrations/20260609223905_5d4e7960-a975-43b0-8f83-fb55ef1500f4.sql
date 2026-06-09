
-- Add card release schedule (D+N) to retention settings
ALTER TABLE public.retention_settings
  ADD COLUMN IF NOT EXISTS card_release_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.retention_settings
  DROP CONSTRAINT IF EXISTS retention_settings_card_release_days_check;
ALTER TABLE public.retention_settings
  ADD CONSTRAINT retention_settings_card_release_days_check
  CHECK (card_release_days IN (1, 7, 15, 30));

-- Set default global value to D+7 if currently 0/null
UPDATE public.retention_settings
SET card_release_days = 7
WHERE card_release_days IS NULL OR card_release_days = 0;

-- Resolver: returns the effective card release days for a user (per-seller override -> global -> default 7)
CREATE OR REPLACE FUNCTION public.get_card_release_days(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT card_release_days FROM public.retention_settings WHERE user_id = _user_id LIMIT 1),
    (SELECT card_release_days FROM public.retention_settings WHERE user_id IS NULL LIMIT 1),
    7
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_card_release_days(uuid) TO authenticated, service_role;

-- When a credit_card transaction is created/updated, set retained_amount/retained_until
-- to hold net_amount until release window passes. This is independent from retention_pct
-- (which can stack as an additional security reserve).
CREATE OR REPLACE FUNCTION public.apply_card_release_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days integer;
BEGIN
  IF NEW.payment_method = 'credit_card'
     AND COALESCE(NEW.is_simulated, false) = false
     AND NEW.retention_released = false
  THEN
    _days := public.get_card_release_days(NEW.user_id);
    -- Only set if not already explicitly retained (preserve manual values)
    IF COALESCE(NEW.retained_amount, 0) = 0 THEN
      NEW.retained_amount := COALESCE(NEW.net_amount, 0);
    END IF;
    IF NEW.retained_until IS NULL THEN
      NEW.retained_until := COALESCE(NEW.created_at, now()) + (_days || ' days')::interval;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_card_release_hold ON public.transactions;
CREATE TRIGGER trg_apply_card_release_hold
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_card_release_hold();

-- Periodic release: marks transactions retention_released=true once retained_until passed,
-- and writes a 'retention_release' ledger entry crediting the held amount back to balance.
CREATE OR REPLACE FUNCTION public.release_due_card_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx record;
  _bal numeric;
  _count integer := 0;
  _idem text;
BEGIN
  FOR _tx IN
    SELECT id, user_id, retained_amount
    FROM public.transactions
    WHERE status = 'completed'
      AND retention_released = false
      AND retained_amount > 0
      AND retained_until IS NOT NULL
      AND retained_until <= now()
    ORDER BY retained_until ASC
    LIMIT 500
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(_tx.user_id::text));
    _idem := 'tx_retrelease_' || _tx.id;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem) THEN
      _bal := public.get_ledger_balance(_tx.user_id);
      INSERT INTO public.financial_ledger
        (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES
        (_tx.user_id, _tx.id, 'retention_release', _tx.retained_amount,
         _bal + _tx.retained_amount, 'Liberação de retenção (cartão)', _idem);
    END IF;
    UPDATE public.transactions
      SET retention_released = true
      WHERE id = _tx.id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_due_card_holds() TO service_role;
