-- Fix B14: apply_transaction_splits — cap combined coprod+affiliate at net_amount
-- Fix B15: ledger_on_transaction_change — stable refund idempotency key

CREATE OR REPLACE FUNCTION public.apply_transaction_splits(_tx_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tx RECORD;
  _coprod RECORD;
  _afflink RECORD;
  _split numeric := 0;
  _bal_co numeric;
  _bal_owner numeric;
  _bal_aff numeric;
  _bal_sell numeric;
  _comm numeric := 0;
  _max_affiliate numeric;
BEGIN
  SELECT id, product_id, user_id, net_amount, amount, status, is_simulated, affiliate_link_id
    INTO _tx FROM transactions WHERE id = _tx_id;
  IF NOT FOUND OR _tx.is_simulated OR _tx.status <> 'completed' OR _tx.product_id IS NULL THEN
    RETURN;
  END IF;

  -- Coprodução (aplicada primeiro)
  SELECT id, co_producer_user_id, owner_user_id, split_percentage
    INTO _coprod FROM co_productions
    WHERE product_id = _tx.product_id AND status = 'accepted' LIMIT 1;

  IF FOUND AND _coprod.co_producer_user_id IS NOT NULL THEN
    _split := ROUND(_tx.net_amount * _coprod.split_percentage / 100.0, 2);
    -- Guarda-corpo: coprod nunca pode exceder o net_amount da transação
    IF _split > _tx.net_amount THEN
      _split := _tx.net_amount;
    END IF;
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

  -- Afiliado
  IF _tx.affiliate_link_id IS NOT NULL THEN
    SELECT id, affiliate_user_id, owner_user_id, commission_pct
      INTO _afflink FROM affiliate_links
      WHERE id = _tx.affiliate_link_id
        AND is_active = true
        AND owner_user_id = _tx.user_id
        AND product_id = _tx.product_id;
  END IF;

  IF NOT FOUND OR _afflink.affiliate_user_id IS NULL THEN
    _afflink := NULL;
  END IF;

  IF _afflink.affiliate_user_id IS NOT NULL THEN
    _comm := ROUND(_tx.net_amount * _afflink.commission_pct / 100.0, 2);
    -- FIX B14: cap combinado coprod + afiliado no net_amount
    _max_affiliate := GREATEST(_tx.net_amount - _split, 0);
    IF _comm > _max_affiliate THEN
      _comm := _max_affiliate;
      RAISE WARNING 'Affiliate commission capped for tx % (coprod % + aff % > net %)',
        _tx_id, _split, _comm, _tx.net_amount;
    END IF;
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
        VALUES (_afflink.id,_afflink.affiliate_user_id,_tx.user_id,_tx.product_id,_tx.amount,_afflink.commission_pct,_comm,'approved')
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$function$;

-- ============================================================
-- Fix B15: ledger_on_transaction_change idempotency key estável
-- ============================================================
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
  _refund_total numeric;
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
        _current_balance := _current_balance - NEW.retained_amount;
      END IF;
    END IF;
    PERFORM apply_transaction_splits(NEW.id);
  END IF;

  IF NEW.status = 'refunded' AND COALESCE(OLD.status,'') = 'completed' THEN
    IF NEW.retained_amount > 0 AND NEW.retention_released = false THEN
      _idem_key := 'tx_retrelease_'||NEW.id;
      IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
        INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'retention_release',NEW.retained_amount,_current_balance+NEW.retained_amount,'Liberação de retenção (reembolso)',_idem_key);
        _current_balance := _current_balance + NEW.retained_amount;
        UPDATE public.transactions SET retention_released = true WHERE id = NEW.id;
      END IF;
    END IF;

    _refund_delta := COALESCE(NEW.refunded_amount, NEW.amount) - COALESCE(OLD.refunded_amount,0);
    IF _refund_delta <= 0 THEN _refund_delta := NEW.amount - COALESCE(OLD.refunded_amount,0); END IF;
    _net_refund := ROUND((_refund_delta / NULLIF(NEW.amount,0)) * NEW.net_amount, 2);
    -- FIX B15: chave estável baseada no total acumulado, não no delta variável
    _refund_total := COALESCE(NEW.refunded_amount, NEW.amount);
    _idem_key := 'tx_refund_'||NEW.id||'_'||_refund_total::text;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,
              CASE WHEN NEW.refunded_amount < NEW.amount THEN 'Reembolso parcial processado' ELSE 'Reembolso processado' END,
              _idem_key);
    END IF;
    IF NEW.refunded_amount >= NEW.amount OR NEW.refunded_amount = 0 THEN
      PERFORM reverse_transaction_splits(NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed'
     AND NEW.refunded_amount > COALESCE(OLD.refunded_amount,0) THEN
    _refund_delta := NEW.refunded_amount - COALESCE(OLD.refunded_amount,0);
    _net_refund := ROUND((_refund_delta / NULLIF(NEW.amount,0)) * NEW.net_amount, 2);
    -- FIX B15: chave estável baseada no total acumulado
    _idem_key := 'tx_refund_'||NEW.id||'_'||NEW.refunded_amount::text;
    IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,'Reembolso parcial processado',_idem_key);
    END IF;
  END IF;

  IF NEW.status = 'chargeback' AND OLD.status = 'completed' THEN
    IF NEW.retained_amount > 0 AND NEW.retention_released = false THEN
      _idem_key := 'tx_retrelease_'||NEW.id;
      IF NOT EXISTS (SELECT 1 FROM financial_ledger WHERE idempotency_key = _idem_key) THEN
        INSERT INTO financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'retention_release',NEW.retained_amount,_current_balance+NEW.retained_amount,'Liberação de retenção (chargeback)',_idem_key);
        _current_balance := _current_balance + NEW.retained_amount;
        UPDATE public.transactions SET retention_released = true WHERE id = NEW.id;
      END IF;
    END IF;

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