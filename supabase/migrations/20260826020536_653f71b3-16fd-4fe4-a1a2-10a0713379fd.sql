-- BLOCO 2: integridade financeira, saldo, saques, disputas e auditoria

-- 1) O ledger mantém valores sempre positivos; o sinal é determinado pelo tipo.
ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_entry_type_check;
ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_entry_type_check CHECK (entry_type IN (
    'credit','debit','fee','refund','chargeback','withdrawal','withdrawal_reversal',
    'adjustment_credit','adjustment_debit','retained','retention_release',
    'split_debit','split_credit','split_reversal_debit','split_reversal_credit',
    'affiliate_debit','affiliate_credit','affiliate_reversal_debit','affiliate_reversal_credit',
    'anticipation_fee','dispute_hold','dispute_release'
  ));

CREATE OR REPLACE FUNCTION public.ledger_entry_effect(_entry_type text, _amount numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _entry_type IN (
      'credit','withdrawal_reversal','adjustment_credit','retention_release',
      'split_credit','split_reversal_credit','affiliate_credit','affiliate_reversal_credit',
      'dispute_release'
    ) THEN COALESCE(_amount, 0)
    WHEN _entry_type IN (
      'debit','refund','chargeback','withdrawal','adjustment_debit','retained',
      'split_debit','split_reversal_debit','affiliate_debit','affiliate_reversal_debit',
      'anticipation_fee','dispute_hold'
    ) THEN -COALESCE(_amount, 0)
    ELSE 0 -- fee é informacional: a venda já entra pelo valor líquido
  END
$$;

REVOKE ALL ON FUNCTION public.ledger_entry_effect(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_entry_effect(text, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_ledger_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(public.ledger_entry_effect(entry_type, amount)), 0)
  FROM public.financial_ledger
  WHERE user_id = _user_id
$$;

REVOKE ALL ON FUNCTION public.calculate_ledger_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_ledger_balance(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ledger_balance(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN public.calculate_ledger_balance(_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_ledger_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ledger_balance(uuid) TO authenticated, service_role;

-- 2) Uma única regra server-side para taxa e dados derivados do saque.
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fee numeric;
  _custom_fee numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount > 500000 THEN
    RAISE EXCEPTION 'Valor de saque inválido (mínimo maior que zero; máximo R$ 500.000,00)';
  END IF;

  IF COALESCE(NEW.withdrawal_type, 'pix') = 'crypto' THEN
    _fee := ROUND((NEW.amount * 0.05) + 5.00, 2);
  ELSE
    SELECT withdrawal_fee INTO _custom_fee
    FROM public.custom_user_fees
    WHERE user_id = NEW.user_id
    LIMIT 1;

    IF _custom_fee IS NOT NULL THEN
      _fee := _custom_fee;
    ELSE
      SELECT value INTO _fee
      FROM public.fees
      WHERE name = 'Taxa de Saque' AND fee_type = 'fixed'
      LIMIT 1;
      _fee := COALESCE(_fee, 5.00);
    END IF;
  END IF;

  IF _fee < 0 THEN
    RAISE EXCEPTION 'Configuração de taxa de saque inválida';
  END IF;

  NEW.fee_amount := ROUND(_fee, 2);
  NEW.net_amount := ROUND(NEW.amount - NEW.fee_amount, 2);
  NEW.status := 'pending';
  NEW.processed_at := NULL;

  IF NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'Valor insuficiente após taxa de saque de R$ %', NEW.fee_amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _available numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Mesma chave utilizada pelos gatilhos do ledger: serializa saldo e saque por seller.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _available := public.calculate_ledger_balance(NEW.user_id);

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_withdrawal_fee ON public.withdrawals;
DROP TRIGGER IF EXISTS enforce_withdrawal_fee_trigger ON public.withdrawals;
DROP TRIGGER IF EXISTS trg_validate_withdrawal ON public.withdrawals;
DROP TRIGGER IF EXISTS trg_validate_withdrawal_balance ON public.withdrawals;
DROP TRIGGER IF EXISTS validate_withdrawal_balance_trigger ON public.withdrawals;
DROP TRIGGER IF EXISTS validate_withdrawal_amount_before_insert ON public.withdrawals;
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON public.withdrawals;
DROP TRIGGER IF EXISTS trg_validate_withdrawal_amount ON public.withdrawals;

CREATE TRIGGER trg_10_enforce_withdrawal_fee
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_fee();

CREATE TRIGGER trg_90_validate_withdrawal
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal();

-- 3) Todos os escritores usam o saldo calculado, sem depender do último UUID/horário.
CREATE OR REPLACE FUNCTION public.ledger_on_withdrawal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance numeric;
  _idem_key text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := public.calculate_ledger_balance(NEW.user_id);

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    _idem_key := 'wd_debit_' || NEW.id;
    INSERT INTO public.financial_ledger
      (user_id, withdrawal_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES
      (NEW.user_id, NEW.id, 'withdrawal', NEW.amount, _current_balance - NEW.amount,
       'Saque solicitado', _idem_key)
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    _idem_key := 'wd_reversal_' || NEW.id;
    INSERT INTO public.financial_ledger
      (user_id, withdrawal_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES
      (NEW.user_id, NEW.id, 'withdrawal_reversal', NEW.amount, _current_balance + NEW.amount,
       'Saque rejeitado - valor devolvido', _idem_key)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_on_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance numeric;
  _entry_type text;
  _new_balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := public.calculate_ledger_balance(NEW.user_id);
  _entry_type := CASE WHEN NEW.type = 'credit' THEN 'adjustment_credit' ELSE 'adjustment_debit' END;
  _new_balance := _current_balance + public.ledger_entry_effect(_entry_type, NEW.amount);

  INSERT INTO public.financial_ledger
    (user_id, adjustment_id, entry_type, amount, balance_after, description, idempotency_key)
  VALUES
    (NEW.user_id, NEW.id, _entry_type, NEW.amount, _new_balance,
     'Ajuste manual: ' || left(NEW.reason, 100), 'adj_' || NEW.id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4) MED/disputa: valores positivos e tipos válidos; abertura e devolução idempotentes.
CREATE OR REPLACE FUNCTION public.handle_dispute_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _net numeric;
  _current_balance numeric;
  _inserted integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));
    SELECT COALESCE(net_amount, amount) INTO _net
    FROM public.transactions
    WHERE id = NEW.transaction_id AND user_id = NEW.seller_user_id
    FOR UPDATE;

    IF NOT FOUND OR _net IS NULL OR _net <= 0 THEN
      RAISE EXCEPTION 'Transação inválida para abertura de disputa';
    END IF;

    _current_balance := public.calculate_ledger_balance(NEW.seller_user_id);
    INSERT INTO public.financial_ledger
      (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES
      (NEW.seller_user_id, NEW.transaction_id, 'dispute_hold', _net,
       _current_balance - _net, 'MED aberto - valor bloqueado', 'dispute_open_' || NEW.id)
    ON CONFLICT (idempotency_key) DO NOTHING;
    GET DIAGNOSTICS _inserted = ROW_COUNT;

    UPDATE public.transactions
    SET status = 'disputed', updated_at = now()
    WHERE id = NEW.transaction_id AND status <> 'disputed';

    IF _inserted > 0 THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_opened', 'MED solicitado',
        'Um MED foi aberto na transação ' || substring(NEW.transaction_id::text, 1, 8) || '. Valor bloqueado até decisão.',
        '/financeiro?tab=disputas');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));
    SELECT COALESCE(net_amount, amount) INTO _net
    FROM public.transactions
    WHERE id = NEW.transaction_id AND user_id = NEW.seller_user_id
    FOR UPDATE;

    IF NOT FOUND OR _net IS NULL OR _net <= 0 THEN
      RAISE EXCEPTION 'Transação inválida para resolução de disputa';
    END IF;

    _current_balance := public.calculate_ledger_balance(NEW.seller_user_id);

    IF NEW.status = 'resolved_seller' THEN
      INSERT INTO public.financial_ledger
        (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES
        (NEW.seller_user_id, NEW.transaction_id, 'dispute_release', _net,
         _current_balance + _net, 'MED ganho - valor devolvido', 'dispute_release_' || NEW.id)
      ON CONFLICT (idempotency_key) DO NOTHING;
      GET DIAGNOSTICS _inserted = ROW_COUNT;

      UPDATE public.transactions SET status = 'approved', updated_at = now()
      WHERE id = NEW.transaction_id;
      IF _inserted > 0 THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.seller_user_id, 'dispute_won', 'MED ganho!',
          'Você ganhou o MED. Valor devolvido ao saldo.', '/financeiro?tab=disputas');
      END IF;
    ELSIF NEW.status = 'resolved_buyer' THEN
      UPDATE public.transactions SET status = 'chargeback', updated_at = now()
      WHERE id = NEW.transaction_id;
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_lost', 'MED perdido',
        'O MED foi concluído contra você. Valor não será devolvido.', '/financeiro?tab=disputas');
    END IF;

    IF NEW.status IN ('resolved_seller','resolved_buyer','closed') AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Auditoria imutável de todo movimento e alerta de saldo devedor.
CREATE OR REPLACE FUNCTION public.audit_financial_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log
    (user_id, actor_role, event_type, endpoint, status_code, metadata)
  VALUES
    (NEW.user_id, COALESCE(auth.jwt()->>'role', current_user), 'financial_ledger_entry',
     'database/financial_ledger', 200,
     jsonb_build_object(
       'ledger_id', NEW.id,
       'transaction_id', NEW.transaction_id,
       'withdrawal_id', NEW.withdrawal_id,
       'adjustment_id', NEW.adjustment_id,
       'entry_type', NEW.entry_type,
       'amount', NEW.amount,
       'balance_after', NEW.balance_after,
       'idempotency_key', NEW.idempotency_key
     ));

  IF NEW.balance_after < 0 AND NEW.entry_type IN
     ('refund','chargeback','dispute_hold','adjustment_debit') THEN
    INSERT INTO public.admin_alerts (kind, severity, message, metadata)
    VALUES ('negative_seller_balance', 'critical',
      'Seller ficou com saldo negativo após evento financeiro obrigatório.',
      jsonb_build_object('user_id', NEW.user_id, 'ledger_id', NEW.id,
                         'entry_type', NEW.entry_type, 'balance_after', NEW.balance_after));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_financial_ledger ON public.financial_ledger;
CREATE TRIGGER trg_audit_financial_ledger
AFTER INSERT ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.audit_financial_ledger_entry();

-- 6) Relatório administrativo de reconciliação.
CREATE OR REPLACE FUNCTION public.get_ledger_integrity_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH calculated AS (
    SELECT user_id,
           COALESCE(SUM(public.ledger_entry_effect(entry_type, amount)), 0) AS calculated_balance
    FROM public.financial_ledger
    GROUP BY user_id
  ), materialized AS (
    SELECT DISTINCT ON (user_id) user_id, balance_after
    FROM public.financial_ledger
    ORDER BY user_id, created_at DESC, id DESC
  )
  SELECT jsonb_build_object(
    'total_completed_tx', (SELECT COUNT(*) FROM public.transactions WHERE status = 'completed'),
    'total_completed_tx_amount', (SELECT COALESCE(SUM(net_amount), 0) FROM public.transactions WHERE status = 'completed'),
    'total_ledger_credit', (SELECT COALESCE(SUM(amount), 0) FROM public.financial_ledger WHERE entry_type = 'credit'),
    'completed_tx_without_ledger', (
      SELECT COUNT(*) FROM public.transactions t
      WHERE t.status = 'completed' AND t.is_simulated = false
        AND NOT EXISTS (SELECT 1 FROM public.financial_ledger f
                        WHERE f.transaction_id = t.id AND f.entry_type = 'credit')
    ),
    'total_withdrawals', (SELECT COALESCE(SUM(amount), 0) FROM public.withdrawals WHERE status IN ('approved','paid','completed','processing')),
    'sellers_with_negative_balance', (SELECT COUNT(*) FROM calculated WHERE calculated_balance < 0),
    'materialized_balance_mismatches', (
      SELECT COUNT(*) FROM calculated c JOIN materialized m USING (user_id)
      WHERE c.calculated_balance IS DISTINCT FROM m.balance_after
    ),
    'checked_at', now()
  ) INTO _result;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ledger_integrity_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ledger_integrity_report() TO service_role;

-- 7) Remove execuções duplicadas, mantendo apenas os gatilhos canônicos.
DROP TRIGGER IF EXISTS grant_access_on_payment_trigger ON public.transactions;
DROP TRIGGER IF EXISTS protect_transaction_status_trigger ON public.transactions;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON public.withdrawals;
DROP TRIGGER IF EXISTS update_disputes_updated_at ON public.disputes;

-- 8) O dono das tabelas também passa pelas regras de acesso; service_role mantém política própria no ledger.
ALTER TABLE public.financial_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals FORCE ROW LEVEL SECURITY;