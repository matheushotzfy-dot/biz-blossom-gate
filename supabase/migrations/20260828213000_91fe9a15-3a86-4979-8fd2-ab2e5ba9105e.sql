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
  _old_was_paid boolean := COALESCE(OLD.status IN ('approved', 'paid', 'completed'), false);
  _new_is_paid boolean := NEW.status IN ('approved', 'paid', 'completed');
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.refunded_amount IS NOT DISTINCT FROM NEW.refunded_amount THEN RETURN NEW; END IF;
  IF NEW.is_simulated = true THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  _current_balance := public.calculate_ledger_balance(NEW.user_id);

  IF _new_is_paid AND NOT _old_was_paid THEN
    _idem_key := 'tx_credit_' || NEW.id;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'credit',NEW.net_amount,_current_balance+NEW.net_amount,'Venda aprovada',_idem_key);
      _current_balance := _current_balance + NEW.net_amount;
      IF NEW.fee_amount > 0 THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'fee',NEW.fee_amount,_current_balance,'Taxa da plataforma','tx_fee_'||NEW.id);
      END IF;
      IF NEW.retained_amount > 0 THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'retained',NEW.retained_amount,_current_balance-NEW.retained_amount,'Valor retido (segurança)','tx_retained_'||NEW.id);
        _current_balance := _current_balance - NEW.retained_amount;
      END IF;
    END IF;
    PERFORM public.apply_transaction_splits(NEW.id);
  END IF;

  IF NEW.status = 'refunded' AND _old_was_paid THEN
    IF NEW.retained_amount > 0 AND NEW.retention_released = false THEN
      _idem_key := 'tx_retrelease_'||NEW.id;
      IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem_key) THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'retention_release',NEW.retained_amount,_current_balance+NEW.retained_amount,'Liberação de retenção (reembolso)',_idem_key);
        _current_balance := _current_balance + NEW.retained_amount;
        UPDATE public.transactions SET retention_released = true WHERE id = NEW.id;
      END IF;
    END IF;
    _refund_delta := COALESCE(NEW.refunded_amount, NEW.amount) - COALESCE(OLD.refunded_amount,0);
    IF _refund_delta <= 0 THEN _refund_delta := NEW.amount - COALESCE(OLD.refunded_amount,0); END IF;
    _net_refund := ROUND((_refund_delta / NULLIF(NEW.amount,0)) * NEW.net_amount, 2);
    _refund_total := COALESCE(NEW.refunded_amount, NEW.amount);
    _idem_key := 'tx_refund_'||NEW.id||'_'||_refund_total::text;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,
        CASE WHEN NEW.refunded_amount < NEW.amount THEN 'Reembolso parcial processado' ELSE 'Reembolso processado' END,_idem_key);
    END IF;
    IF NEW.refunded_amount >= NEW.amount OR NEW.refunded_amount = 0 THEN PERFORM public.reverse_transaction_splits(NEW.id); END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND _new_is_paid AND NEW.refunded_amount > COALESCE(OLD.refunded_amount,0) THEN
    _refund_delta := NEW.refunded_amount - COALESCE(OLD.refunded_amount,0);
    _net_refund := ROUND((_refund_delta / NULLIF(NEW.amount,0)) * NEW.net_amount, 2);
    _idem_key := 'tx_refund_'||NEW.id||'_'||NEW.refunded_amount::text;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'refund',_net_refund,_current_balance-_net_refund,'Reembolso parcial processado',_idem_key);
    END IF;
  END IF;

  IF NEW.status = 'chargeback' AND _old_was_paid THEN
    IF NEW.retained_amount > 0 AND NEW.retention_released = false THEN
      _idem_key := 'tx_retrelease_'||NEW.id;
      IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem_key) THEN
        INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
        VALUES (NEW.user_id,NEW.id,'retention_release',NEW.retained_amount,_current_balance+NEW.retained_amount,'Liberação de retenção (chargeback)',_idem_key);
        _current_balance := _current_balance + NEW.retained_amount;
        UPDATE public.transactions SET retention_released = true WHERE id = NEW.id;
      END IF;
    END IF;
    _idem_key := 'tx_chargeback_'||NEW.id;
    IF NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = _idem_key) THEN
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (NEW.user_id,NEW.id,'chargeback',NEW.net_amount,_current_balance-NEW.net_amount,'Chargeback recebido',_idem_key);
    END IF;
    PERFORM public.reverse_transaction_splits(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.ledger_on_transaction_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_on_transaction_change() TO service_role;