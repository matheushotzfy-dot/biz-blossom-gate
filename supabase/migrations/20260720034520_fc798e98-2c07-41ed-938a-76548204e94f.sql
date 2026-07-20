
-- 1. Colunas novas
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS acquirer_id UUID REFERENCES public.acquirers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquirer_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_acquirer_id ON public.transactions(acquirer_id);

-- 2. Trigger de cálculo automático
CREATE OR REPLACE FUNCTION public.compute_acquirer_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acq_pct NUMERIC;
  acq_fixed NUMERIC;
BEGIN
  -- Se ainda não temos adquirente definida, tenta resolver pelo perfil do seller
  IF NEW.acquirer_id IS NULL THEN
    SELECT p.acquirer_id INTO NEW.acquirer_id
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1;
  END IF;

  -- Só calcula quando temos adquirente E quando o custo ainda não foi setado manualmente
  IF NEW.acquirer_id IS NOT NULL AND (NEW.acquirer_fee_amount IS NULL OR NEW.acquirer_fee_amount = 0) THEN
    SELECT COALESCE(a.transaction_fee_percentage, 0), COALESCE(a.transaction_fee_fixed, 0)
      INTO acq_pct, acq_fixed
    FROM public.acquirers a
    WHERE a.id = NEW.acquirer_id;

    IF acq_pct IS NOT NULL THEN
      NEW.acquirer_fee_amount := ROUND(((NEW.amount * acq_pct / 100.0) + acq_fixed)::numeric, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_acquirer_fee ON public.transactions;
CREATE TRIGGER trg_compute_acquirer_fee
  BEFORE INSERT OR UPDATE OF status, amount, acquirer_id ON public.transactions
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'completed', 'paid'))
  EXECUTE FUNCTION public.compute_acquirer_fee();

-- 3. Backfill retroativo
UPDATE public.transactions t
SET acquirer_id = p.acquirer_id
FROM public.profiles p
WHERE t.user_id = p.user_id
  AND t.acquirer_id IS NULL
  AND p.acquirer_id IS NOT NULL;

UPDATE public.transactions t
SET acquirer_fee_amount = ROUND(((t.amount * COALESCE(a.transaction_fee_percentage, 0) / 100.0) + COALESCE(a.transaction_fee_fixed, 0))::numeric, 2)
FROM public.acquirers a
WHERE t.acquirer_id = a.id
  AND t.status IN ('approved', 'completed', 'paid')
  AND (t.acquirer_fee_amount IS NULL OR t.acquirer_fee_amount = 0);
