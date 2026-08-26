-- Complementos de compatibilidade e permissões da correção do Bloco 2

CREATE OR REPLACE FUNCTION public.get_ledger_balance(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Chamadas autenticadas só podem consultar o próprio saldo (ou admin).
  -- Chamadas internas/service_role não possuem auth.uid() e usam esta função
  -- exclusivamente por meio dos gatilhos e rotinas financeiras protegidas.
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN public.calculate_ledger_balance(_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_ledger_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ledger_balance(uuid) TO authenticated, service_role;

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
      PERFORM public.reverse_transaction_splits(NEW.transaction_id);
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

-- Funções de gatilho não devem ser RPCs públicas.
REVOKE ALL ON FUNCTION public.enforce_withdrawal_fee() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_withdrawal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_on_withdrawal_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_on_adjustment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_dispute_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_financial_ledger_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_on_transaction_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_withdrawal_fee() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_withdrawal() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_on_withdrawal_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_on_adjustment() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_dispute_balance() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_financial_ledger_entry() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_on_transaction_change() TO service_role;