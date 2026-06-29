-- 1) Extend ledger entry types to include anticipation fee
ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_entry_type_check;
ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'credit','debit','fee','refund','chargeback','withdrawal','withdrawal_reversal',
    'adjustment_credit','adjustment_debit','retained','retention_release',
    'split_debit','split_credit','split_reversal_debit','split_reversal_credit',
    'affiliate_debit','affiliate_credit','affiliate_reversal_debit','affiliate_reversal_credit',
    'anticipation_fee'
  ]));

-- 2) Anticipations table
CREATE TABLE IF NOT EXISTS public.anticipations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_days integer NOT NULL CHECK (max_days BETWEEN 1 AND 365),
  tx_count integer NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed','reversed')),
  idempotency_key text NOT NULL UNIQUE,
  transaction_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anticipations TO authenticated;
GRANT ALL    ON public.anticipations TO service_role;

ALTER TABLE public.anticipations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own anticipations"
  ON public.anticipations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all anticipations"
  ON public.anticipations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_anticipations_user ON public.anticipations(user_id, created_at DESC);

CREATE TRIGGER trg_anticipations_updated_at
  BEFORE UPDATE ON public.anticipations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RPC: request_anticipation
CREATE OR REPLACE FUNCTION public.request_anticipation(
  _user_id uuid,
  _max_days integer,
  _idempotency_key text
)
RETURNS public.anticipations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.anticipations;
  _tx record;
  _bal numeric;
  _gross numeric := 0;
  _fee_total numeric := 0;
  _net_total numeric := 0;
  _tx_ids uuid[] := '{}';
  _days_left integer;
  _fee numeric;
  _multiplier numeric;
  _row public.anticipations;
  _idem text;
BEGIN
  IF _user_id IS NULL OR _idempotency_key IS NULL OR _max_days IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes';
  END IF;

  -- Idempotency: return existing record if already processed
  SELECT * INTO _existing FROM public.anticipations WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text));

  FOR _tx IN
    SELECT id, retained_amount, retained_until
    FROM public.transactions
    WHERE user_id = _user_id
      AND status = 'completed'
      AND is_simulated = false
      AND retention_released = false
      AND retained_amount > 0
      AND retained_until IS NOT NULL
      AND retained_until > now()
      AND retained_until <= now() + (_max_days || ' days')::interval
    ORDER BY retained_until ASC
    FOR UPDATE
  LOOP
    _days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_tx.retained_until - now())) / 86400)::int);
    _multiplier := LEAST(_days_left::numeric / 15.0, 1.0);
    _fee := ROUND(_tx.retained_amount * 0.025 * _multiplier, 2);

    -- Release retention (credit)
    _bal := public.get_ledger_balance(_user_id);
    _idem := 'antc_release_' || _tx.id || '_' || _idempotency_key;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem) THEN
      INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (_user_id, _tx.id, 'retention_release', _tx.retained_amount, _bal + _tx.retained_amount,
              'Antecipação: liberação de retenção', _idem);
      _bal := _bal + _tx.retained_amount;
    END IF;

    -- Charge anticipation fee (debit)
    IF _fee > 0 THEN
      _idem := 'antc_fee_' || _tx.id || '_' || _idempotency_key;
      IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem) THEN
        INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (_user_id, _tx.id, 'anticipation_fee', _fee, _bal - _fee,
                'Antecipação: taxa pro-rata', _idem);
      END IF;
    END IF;

    UPDATE public.transactions
      SET retention_released = true
      WHERE id = _tx.id;

    _gross := _gross + _tx.retained_amount;
    _fee_total := _fee_total + _fee;
    _net_total := _net_total + (_tx.retained_amount - _fee);
    _tx_ids := _tx_ids || _tx.id;
  END LOOP;

  INSERT INTO public.anticipations(user_id, max_days, tx_count, gross_amount, fee_amount, net_amount, status, idempotency_key, transaction_ids)
  VALUES (_user_id, _max_days, COALESCE(array_length(_tx_ids,1),0), _gross, _fee_total, _net_total,
          CASE WHEN COALESCE(array_length(_tx_ids,1),0) = 0 THEN 'failed' ELSE 'completed' END,
          _idempotency_key, _tx_ids)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_anticipation(uuid,integer,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_anticipation(uuid,integer,text) TO authenticated, service_role;