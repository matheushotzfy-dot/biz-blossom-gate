CREATE OR REPLACE FUNCTION public.apply_transaction_splits(_tx_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  INTO _tx FROM public.transactions WHERE id = _tx_id;
  IF NOT FOUND OR _tx.is_simulated OR _tx.status NOT IN ('approved','paid','completed') OR _tx.product_id IS NULL THEN RETURN; END IF;

  SELECT id, co_producer_user_id, owner_user_id, split_percentage
  INTO _coprod FROM public.co_productions
  WHERE product_id = _tx.product_id AND status = 'accepted' LIMIT 1;

  IF FOUND AND _coprod.co_producer_user_id IS NOT NULL THEN
    _split := LEAST(ROUND(_tx.net_amount * _coprod.split_percentage / 100.0, 2), _tx.net_amount);
    IF _split > 0 AND NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key='split_c_'||_tx_id||'_'||_coprod.id) THEN
      PERFORM pg_advisory_xact_lock(hashtext(_coprod.co_producer_user_id::text));
      PERFORM pg_advisory_xact_lock(hashtext(_coprod.owner_user_id::text));
      _bal_co := public.calculate_ledger_balance(_coprod.co_producer_user_id);
      _bal_owner := public.calculate_ledger_balance(_coprod.owner_user_id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_coprod.co_producer_user_id,_tx_id,'split_credit',_split,_bal_co+_split,'Coprodução: '||_coprod.split_percentage||'% da venda','split_c_'||_tx_id||'_'||_coprod.id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_coprod.owner_user_id,_tx_id,'split_debit',_split,_bal_owner-_split,'Repasse coprodução: '||_coprod.split_percentage||'%','split_d_'||_tx_id||'_'||_coprod.id);
    END IF;
  END IF;

  _afflink := NULL;
  IF _tx.affiliate_link_id IS NOT NULL THEN
    SELECT id, affiliate_user_id, owner_user_id, commission_pct
    INTO _afflink FROM public.affiliate_links
    WHERE id=_tx.affiliate_link_id AND is_active=true AND owner_user_id=_tx.user_id AND product_id=_tx.product_id;
  END IF;

  IF _afflink.affiliate_user_id IS NOT NULL THEN
    _comm := ROUND(_tx.net_amount * _afflink.commission_pct / 100.0, 2);
    _max_affiliate := GREATEST(_tx.net_amount-_split,0);
    _comm := LEAST(_comm,_max_affiliate);
    IF _comm > 0 AND NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key='aff_c_'||_tx_id||'_'||_afflink.id) THEN
      PERFORM pg_advisory_xact_lock(hashtext(_afflink.affiliate_user_id::text));
      PERFORM pg_advisory_xact_lock(hashtext(_tx.user_id::text));
      _bal_aff := public.calculate_ledger_balance(_afflink.affiliate_user_id);
      _bal_sell := public.calculate_ledger_balance(_tx.user_id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_afflink.affiliate_user_id,_tx_id,'affiliate_credit',_comm,_bal_aff+_comm,'Comissão afiliado: '||_afflink.commission_pct||'%','aff_c_'||_tx_id||'_'||_afflink.id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_tx.user_id,_tx_id,'affiliate_debit',_comm,_bal_sell-_comm,'Repasse comissão afiliado: '||_afflink.commission_pct||'%','aff_d_'||_tx_id||'_'||_afflink.id);
      INSERT INTO public.affiliate_sales(affiliate_link_id,affiliate_user_id,seller_user_id,product_id,transaction_id,sale_amount,commission_pct,commission_amount,status)
      VALUES (_afflink.id,_afflink.affiliate_user_id,_tx.user_id,_tx.product_id,_tx.id,_tx.amount,_afflink.commission_pct,_comm,'approved')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_transaction_splits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_transaction_splits(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ledger_on_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance numeric;
  _idem_key text;
  _refund_delta numeric;
  _net_refund numeric;
  _refund_total numeric;
  _old_was_paid boolean := COALESCE(OLD.status IN ('approved','paid','completed'),false);
  _new_is_paid boolean := NEW.status IN ('approved','paid','completed');
BEGIN
  IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.refunded_amount IS NOT DISTINCT FROM NEW.refunded_amount THEN RETURN NEW; END IF;
  IF NEW.is_simulated THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := public.calculate_ledger_balance(NEW.user_id);

  IF _new_is_paid AND NOT _old_was_paid THEN
    _idem_key := 'tx_credit_'||NEW.id;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key=_idem_key) THEN
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES(NEW.user_id,NEW.id,'credit',NEW.net_amount,_current_balance+NEW.net_amount,'Venda aprovada',_idem_key);
      _current_balance := _current_balance+NEW.net_amount;
      IF NEW.fee_amount>0 THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES(NEW.user_id,NEW.id,'fee',NEW.fee_amount,_current_balance,'Taxa da plataforma','tx_fee_'||NEW.id);
      END IF;
      IF NEW.retained_amount>0 THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES(NEW.user_id,NEW.id,'retained',NEW.retained_amount,_current_balance-NEW.retained_amount,'Valor retido (segurança)','tx_retained_'||NEW.id);
        _current_balance := _current_balance-NEW.retained_amount;
      END IF;
    END IF;
    PERFORM public.apply_transaction_splits(NEW.id);
  END IF;

  IF NEW.status='refunded' AND _old_was_paid THEN
    IF NEW.retained_amount>0 AND NOT NEW.retention_released THEN
      _idem_key := 'tx_retrelease_'||NEW.id;
      IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key=_idem_key) THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES(NEW.user_id,NEW.id,'retention_release',NEW.retained_amount,_current_balance+NEW.retained_amount,'Liberação de retenção (reembolso)',_idem_key);
        _current_balance := _current_balance+NEW.retained_amount;
        NEW.retention_released := true;
      END IF;
    END IF;
    _refund_total := COALESCE(NULLIF(NEW.refunded_amount,0),NEW.amount);
    _refund_delta := _refund_total-COALESCE(OLD.refunded_amount,0);
    IF _refund_delta>0 THEN
      _net_refund := ROUND((_refund_delta/NULLIF(NEW.amount,0))*NEW.net_amount,2);
      _idem_key := 'tx_refund_'||NEW.id||'_'||to_char(_refund_total,'FM999999999990.00');
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES(NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,'Reembolso processado',_idem_key)
      ON CONFLICT(idempotency_key) DO NOTHING;
    END IF;
    IF _refund_total>=NEW.amount THEN PERFORM public.reverse_transaction_splits(NEW.id); END IF;
  ELSIF TG_OP='UPDATE' AND _new_is_paid AND NEW.refunded_amount>COALESCE(OLD.refunded_amount,0) THEN
    _refund_delta := NEW.refunded_amount-COALESCE(OLD.refunded_amount,0);
    _net_refund := ROUND((_refund_delta/NULLIF(NEW.amount,0))*NEW.net_amount,2);
    _idem_key := 'tx_refund_'||NEW.id||'_'||to_char(NEW.refunded_amount,'FM999999999990.00');
    INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
    VALUES(NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,'Reembolso parcial processado',_idem_key)
    ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;

  IF NEW.status IN ('chargeback','chargedback','charged_back') AND _old_was_paid THEN
    IF NEW.retained_amount>0 AND NOT NEW.retention_released THEN
      _idem_key := 'tx_retrelease_'||NEW.id;
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES(NEW.user_id,NEW.id,'retention_release',NEW.retained_amount,_current_balance+NEW.retained_amount,'Liberação de retenção (chargeback)',_idem_key)
      ON CONFLICT(idempotency_key) DO NOTHING;
      NEW.retention_released := true;
    END IF;
    _idem_key := 'tx_chargeback_'||NEW.id;
    INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
    VALUES(NEW.user_id,NEW.id,'chargeback',NEW.net_amount,_current_balance-NEW.net_amount,'Chargeback recebido',_idem_key)
    ON CONFLICT(idempotency_key) DO NOTHING;
    PERFORM public.reverse_transaction_splits(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ledger_on_transaction_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_on_transaction_change() TO service_role;