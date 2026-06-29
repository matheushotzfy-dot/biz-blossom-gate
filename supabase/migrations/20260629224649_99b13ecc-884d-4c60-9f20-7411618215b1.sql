
-- 1. Estender CHECK de entry_type
ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_entry_type_check;
ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'credit','debit','fee','refund','chargeback','withdrawal','withdrawal_reversal',
    'adjustment_credit','adjustment_debit','retained','retention_release',
    'split_debit','split_credit','split_reversal_debit','split_reversal_credit',
    'affiliate_debit','affiliate_credit','affiliate_reversal_debit','affiliate_reversal_credit'
  ]));

-- 2. Função única e atômica que processa todos os splits de uma transação
CREATE OR REPLACE FUNCTION public.apply_transaction_splits(_tx_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx RECORD;
  _coprod RECORD;
  _afflink RECORD;
  _split numeric;
  _bal_co numeric;
  _bal_owner numeric;
  _bal_aff numeric;
  _bal_sell numeric;
  _comm numeric;
BEGIN
  SELECT id, product_id, user_id, net_amount, amount, status, is_simulated
    INTO _tx FROM transactions WHERE id = _tx_id;
  IF NOT FOUND OR _tx.is_simulated OR _tx.status <> 'completed' OR _tx.product_id IS NULL THEN
    RETURN;
  END IF;

  -- Coprodução
  SELECT id, co_producer_user_id, owner_user_id, split_percentage
    INTO _coprod FROM co_productions
    WHERE product_id = _tx.product_id AND status = 'accepted' LIMIT 1;

  IF FOUND AND _coprod.co_producer_user_id IS NOT NULL THEN
    _split := ROUND(_tx.net_amount * _coprod.split_percentage / 100.0, 2);
    IF _split > 0 AND NOT EXISTS (
      SELECT 1 FROM financial_ledger WHERE idempotency_key = 'split_c_'||_tx_id||'_'||_coprod.id
    ) THEN
      PERFORM pg_advisory_xact_lock(hashtext(_coprod.co_producer_user_id::text));
      PERFORM pg_advisory_xact_lock(hashtext(_coprod.owner_user_id::text));
      _bal_co := get_ledger_balance(_coprod.co_producer_user_id);
      _bal_owner := get_ledger_balance(_coprod.owner_user_id);
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (_coprod.co_producer_user_id,_tx_id,'split_credit',_split,_bal_co+_split,
                'Coprodução: '||_coprod.split_percentage||'% da venda','split_c_'||_tx_id||'_'||_coprod.id);
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (_coprod.owner_user_id,_tx_id,'split_debit',_split,_bal_owner-_split,
                'Repasse coprodução: '||_coprod.split_percentage||'%','split_d_'||_tx_id||'_'||_coprod.id);
    END IF;
  END IF;

  -- Afiliado (primeiro link ativo até checkout enviar affiliate_link_id)
  SELECT id, affiliate_user_id, owner_user_id, commission_pct
    INTO _afflink FROM affiliate_links
    WHERE product_id = _tx.product_id AND is_active = true AND owner_user_id = _tx.user_id
    ORDER BY created_at ASC LIMIT 1;

  IF FOUND AND _afflink.affiliate_user_id IS NOT NULL THEN
    _comm := ROUND(_tx.net_amount * _afflink.commission_pct / 100.0, 2);
    IF _comm > 0 AND NOT EXISTS (
      SELECT 1 FROM financial_ledger WHERE idempotency_key = 'aff_c_'||_tx_id||'_'||_afflink.id
    ) THEN
      PERFORM pg_advisory_xact_lock(hashtext(_afflink.affiliate_user_id::text));
      PERFORM pg_advisory_xact_lock(hashtext(_tx.user_id::text));
      _bal_aff := get_ledger_balance(_afflink.affiliate_user_id);
      _bal_sell := get_ledger_balance(_tx.user_id);
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (_afflink.affiliate_user_id,_tx_id,'affiliate_credit',_comm,_bal_aff+_comm,
                'Comissão afiliado: '||_afflink.commission_pct||'%','aff_c_'||_tx_id||'_'||_afflink.id);
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (_tx.user_id,_tx_id,'affiliate_debit',_comm,_bal_sell-_comm,
                'Repasse comissão afiliado: '||_afflink.commission_pct||'%','aff_d_'||_tx_id||'_'||_afflink.id);

      INSERT INTO affiliate_sales(affiliate_link_id,affiliate_user_id,seller_user_id,product_id,transaction_id,sale_amount,commission_pct,commission_amount,status)
        VALUES (_afflink.id,_afflink.affiliate_user_id,_tx.user_id,_tx.product_id,_tx_id,_tx.amount,_afflink.commission_pct,_comm,'approved')
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- 3. Função de reversão (refund/chargeback)
CREATE OR REPLACE FUNCTION public.reverse_transaction_splits(_tx_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entry RECORD;
  _bal numeric;
  _rev_key text;
  _rev_type text;
BEGIN
  -- Para cada split_credit/affiliate_credit já lançado para esta tx, criar reversão idempotente
  FOR _entry IN
    SELECT * FROM financial_ledger
    WHERE transaction_id = _tx_id
      AND entry_type IN ('split_credit','split_debit','affiliate_credit','affiliate_debit')
  LOOP
    _rev_key := 'rev_'||_entry.idempotency_key;
    IF EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _rev_key) THEN CONTINUE; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(_entry.user_id::text));
    _bal := get_ledger_balance(_entry.user_id);

    -- Inverte: credit vira debit, debit vira credit
    IF _entry.entry_type = 'split_credit' THEN
      _rev_type := 'split_reversal_debit'; _bal := _bal - _entry.amount;
    ELSIF _entry.entry_type = 'split_debit' THEN
      _rev_type := 'split_reversal_credit'; _bal := _bal + _entry.amount;
    ELSIF _entry.entry_type = 'affiliate_credit' THEN
      _rev_type := 'affiliate_reversal_debit'; _bal := _bal - _entry.amount;
    ELSE
      _rev_type := 'affiliate_reversal_credit'; _bal := _bal + _entry.amount;
    END IF;

    INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_entry.user_id,_tx_id,_rev_type,_entry.amount,_bal,
              'Estorno: '||_entry.description, _rev_key);
  END LOOP;

  -- Marcar affiliate_sales como reembolsado
  UPDATE affiliate_sales SET status = 'refunded'
    WHERE transaction_id = _tx_id AND status = 'approved';
END;
$$;

-- 4. Hook no trigger principal: ao completar chama apply, ao refund/chargeback chama reverse
CREATE OR REPLACE FUNCTION public.ledger_on_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_balance numeric;
  _idem_key text;
  _refund_delta numeric;
  _net_refund numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.refunded_amount IS NOT DISTINCT FROM NEW.refunded_amount THEN
    RETURN NEW;
  END IF;

  IF NEW.is_simulated = true THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := get_ledger_balance(NEW.user_id);

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    _idem_key := 'tx_credit_' || NEW.id;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'credit',NEW.net_amount,_current_balance+NEW.net_amount,'Venda aprovada',_idem_key);
      _current_balance := _current_balance + NEW.net_amount;
      IF NEW.fee_amount > 0 THEN
        INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'fee',NEW.fee_amount,_current_balance,'Taxa da plataforma','tx_fee_'||NEW.id);
      END IF;
      IF NEW.retained_amount > 0 THEN
        INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'retained',NEW.retained_amount,_current_balance-NEW.retained_amount,'Valor retido (segurança)','tx_retained_'||NEW.id);
      END IF;
    END IF;
    -- Splits
    PERFORM apply_transaction_splits(NEW.id);
  END IF;

  IF NEW.status = 'refunded' AND COALESCE(OLD.status,'') = 'completed' THEN
    _refund_delta := COALESCE(NEW.refunded_amount, NEW.amount) - COALESCE(OLD.refunded_amount,0);
    IF _refund_delta <= 0 THEN _refund_delta := NEW.amount - COALESCE(OLD.refunded_amount,0); END IF;
    _net_refund := ROUND((_refund_delta / NULLIF(NEW.amount,0)) * NEW.net_amount, 2);
    _idem_key := 'tx_refund_'||NEW.id||'_'||_refund_delta::text;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,
              CASE WHEN NEW.refunded_amount < NEW.amount THEN 'Reembolso parcial processado' ELSE 'Reembolso processado' END,
              _idem_key);
    END IF;
    -- Reverte splits proporcionalmente só em refund total
    IF NEW.refunded_amount >= NEW.amount OR NEW.refunded_amount = 0 THEN
      PERFORM reverse_transaction_splits(NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed'
     AND NEW.refunded_amount > COALESCE(OLD.refunded_amount,0) THEN
    _refund_delta := NEW.refunded_amount - COALESCE(OLD.refunded_amount,0);
    _net_refund := ROUND((_refund_delta / NULLIF(NEW.amount,0)) * NEW.net_amount, 2);
    _idem_key := 'tx_refund_'||NEW.id||'_'||NEW.refunded_amount::text;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,'Reembolso parcial processado',_idem_key);
    END IF;
  END IF;

  IF NEW.status = 'chargeback' AND OLD.status = 'completed' THEN
    _idem_key := 'tx_chargeback_'||NEW.id;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'chargeback',NEW.net_amount,_current_balance-NEW.net_amount,'Chargeback recebido',_idem_key);
    END IF;
    PERFORM reverse_transaction_splits(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_transaction_splits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_transaction_splits(uuid) FROM PUBLIC, anon, authenticated;
