
-- =====================================================
-- 1. LEDGER IMUTÁVEL (append-only, fonte única de verdade)
-- =====================================================
CREATE TABLE public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id),
  withdrawal_id uuid REFERENCES public.withdrawals(id),
  adjustment_id uuid REFERENCES public.balance_adjustments(id),
  entry_type text NOT NULL CHECK (entry_type IN ('credit', 'debit', 'fee', 'refund', 'chargeback', 'withdrawal', 'withdrawal_reversal', 'adjustment_credit', 'adjustment_debit', 'retained', 'retention_release')),
  amount numeric NOT NULL CHECK (amount > 0),
  balance_after numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast balance lookups
CREATE INDEX idx_ledger_user_created ON public.financial_ledger(user_id, created_at DESC);
CREATE INDEX idx_ledger_idempotency ON public.financial_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ledger_transaction ON public.financial_ledger(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_ledger_withdrawal ON public.financial_ledger(withdrawal_id) WHERE withdrawal_id IS NOT NULL;

-- RLS: Immutable — no updates, no deletes
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.financial_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all ledger" ON public.financial_ledger
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_update_ledger" ON public.financial_ledger
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "deny_delete_ledger" ON public.financial_ledger
  FOR DELETE TO authenticated USING (false);

CREATE POLICY "deny_anon_all_ledger" ON public.financial_ledger
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Only service_role (triggers) can insert
CREATE POLICY "service_insert_ledger" ON public.financial_ledger
  FOR INSERT TO authenticated WITH CHECK (false);

-- =====================================================
-- 2. FUNÇÃO: Calcular saldo a partir do ledger
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_ledger_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM public.financial_ledger 
     WHERE user_id = _user_id 
     ORDER BY created_at DESC, id DESC 
     LIMIT 1),
    0
  );
$$;

-- =====================================================
-- 3. TRIGGER: Auto-create ledger entries on transaction status change
-- =====================================================
CREATE OR REPLACE FUNCTION public.ledger_on_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance numeric;
  _idem_key text;
BEGIN
  -- Only act on status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip simulated transactions
  IF NEW.is_simulated = true THEN
    RETURN NEW;
  END IF;

  -- Lock user row for atomic balance calculation
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  _current_balance := get_ledger_balance(NEW.user_id);

  -- Payment completed → credit net_amount to seller
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    _idem_key := 'tx_credit_' || NEW.id;
    
    -- Check idempotency
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      -- Credit entry (net amount after fees)
      INSERT INTO financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (NEW.user_id, NEW.id, 'credit', NEW.net_amount, _current_balance + NEW.net_amount, 
              'Venda aprovada', _idem_key);
      
      _current_balance := _current_balance + NEW.net_amount;

      -- Fee entry (informational)
      IF NEW.fee_amount > 0 THEN
        INSERT INTO financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (NEW.user_id, NEW.id, 'fee', NEW.fee_amount, _current_balance, 
                'Taxa da plataforma', 'tx_fee_' || NEW.id);
      END IF;

      -- Retained amount entry
      IF NEW.retained_amount > 0 THEN
        INSERT INTO financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (NEW.user_id, NEW.id, 'retained', NEW.retained_amount, _current_balance - NEW.retained_amount, 
                'Valor retido (segurança)', 'tx_retained_' || NEW.id);
        _current_balance := _current_balance - NEW.retained_amount;
      END IF;
    END IF;
  END IF;

  -- Refund → debit from seller
  IF NEW.status = 'refunded' AND OLD.status = 'completed' THEN
    _idem_key := 'tx_refund_' || NEW.id;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (NEW.user_id, NEW.id, 'refund', NEW.net_amount, _current_balance - NEW.net_amount, 
              'Reembolso processado', _idem_key);
    END IF;
  END IF;

  -- Chargeback → debit from seller
  IF NEW.status = 'chargeback' AND OLD.status = 'completed' THEN
    _idem_key := 'tx_chargeback_' || NEW.id;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (NEW.user_id, NEW.id, 'chargeback', NEW.net_amount, _current_balance - NEW.net_amount, 
              'Chargeback recebido', _idem_key);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledger_on_transaction
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_transaction_change();

-- =====================================================
-- 4. TRIGGER: Auto-create ledger entries on withdrawal status change
-- =====================================================
CREATE OR REPLACE FUNCTION public.ledger_on_withdrawal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance numeric;
  _idem_key text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := get_ledger_balance(NEW.user_id);

  -- New withdrawal → debit
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    _idem_key := 'wd_debit_' || NEW.id;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger (user_id, withdrawal_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (NEW.user_id, NEW.id, 'withdrawal', NEW.amount, _current_balance - NEW.amount, 
              'Saque solicitado', _idem_key);
    END IF;
  END IF;

  -- Withdrawal rejected → reversal (credit back)
  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    _idem_key := 'wd_reversal_' || NEW.id;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger (user_id, withdrawal_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (NEW.user_id, NEW.id, 'withdrawal_reversal', NEW.amount, _current_balance + NEW.amount, 
              'Saque rejeitado - valor devolvido', _idem_key);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledger_on_withdrawal
  AFTER INSERT OR UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_withdrawal_change();

-- =====================================================
-- 5. TRIGGER: Auto-create ledger entries on balance adjustments
-- =====================================================
CREATE OR REPLACE FUNCTION public.ledger_on_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance numeric;
  _idem_key text;
  _entry_type text;
  _new_balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := get_ledger_balance(NEW.user_id);

  _idem_key := 'adj_' || NEW.id;
  
  IF NEW.type = 'credit' THEN
    _entry_type := 'adjustment_credit';
    _new_balance := _current_balance + NEW.amount;
  ELSE
    _entry_type := 'adjustment_debit';
    _new_balance := _current_balance - NEW.amount;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
    INSERT INTO financial_ledger (user_id, adjustment_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES (NEW.user_id, NEW.id, _entry_type, NEW.amount, _new_balance, 
            'Ajuste manual: ' || left(NEW.reason, 100), _idem_key);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledger_on_adjustment
  AFTER INSERT ON public.balance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_adjustment();

-- =====================================================
-- 6. IDEMPOTENCY TABLE for edge functions
-- =====================================================
CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_idempotency_key ON public.idempotency_keys(key);
CREATE INDEX idx_idempotency_expires ON public.idempotency_keys(expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_idempotency" ON public.idempotency_keys
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_anon_idempotency" ON public.idempotency_keys
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- =====================================================
-- 7. UPDATE withdrawal balance check to use ledger
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_withdrawal_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _available numeric;
BEGIN
  -- Use ledger as single source of truth
  _available := get_ledger_balance(NEW.user_id);
  
  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;
  RETURN NEW;
END;
$$;
