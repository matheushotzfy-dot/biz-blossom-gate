
CREATE OR REPLACE FUNCTION public.force_pending_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status != 'pending' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_withdrawals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pending_count integer;
BEGIN
  SELECT COUNT(*) INTO _pending_count
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status = 'pending';
  IF _pending_count >= 3 THEN
    RAISE EXCEPTION 'Máximo de 3 saques pendentes por vez';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_withdrawals_trigger ON public.withdrawals;
CREATE TRIGGER rate_limit_withdrawals_trigger
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_withdrawals();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'withdrawals' 
    AND policyname = 'Users can insert own withdrawals'
  ) THEN
    CREATE POLICY "Users can insert own withdrawals"
    ON public.withdrawals
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_pending 
ON public.withdrawals(user_id) WHERE status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'withdrawals_amount_positive' 
    AND conrelid = 'public.withdrawals'::regclass
  ) THEN
    ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_amount_positive CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transactions_amount_positive' 
    AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_completed_net
ON public.transactions(user_id, status) WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status_amount
ON public.withdrawals(user_id, status)
