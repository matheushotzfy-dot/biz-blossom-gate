
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS affiliate_link_id uuid REFERENCES public.affiliate_links(id);

CREATE INDEX IF NOT EXISTS idx_transactions_affiliate_link
  ON public.transactions(affiliate_link_id) WHERE affiliate_link_id IS NOT NULL;

-- Atualizar apply_transaction_splits para priorizar tx.affiliate_link_id
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
  SELECT id, product_id, user_id, net_amount, amount, status, is_simulated, affiliate_link_id
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

  -- Afiliado: prioriza o link que veio na transação
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
$$;

REVOKE EXECUTE ON FUNCTION public.apply_transaction_splits(uuid) FROM PUBLIC, anon, authenticated;
