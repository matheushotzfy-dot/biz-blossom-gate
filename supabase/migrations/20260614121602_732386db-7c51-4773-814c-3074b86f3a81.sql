
-- MED / Chargeback workflow: auto debit on dispute open, refund/release on resolution

CREATE OR REPLACE FUNCTION public.handle_dispute_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric;
  v_current_balance numeric;
  v_tx_status text;
BEGIN
  -- ON INSERT: open dispute -> debit seller's available balance
  IF TG_OP = 'INSERT' THEN
    -- Lock seller row to avoid race
    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));

    SELECT net_amount, status INTO v_net, v_tx_status
      FROM public.transactions WHERE id = NEW.transaction_id FOR UPDATE;

    IF v_net IS NULL THEN v_net := NEW.amount; END IF;

    -- Mark transaction as disputed (keep historic, do not lose data)
    UPDATE public.transactions
       SET status = 'disputed', updated_at = now()
     WHERE id = NEW.transaction_id;

    -- Compute current balance from ledger
    SELECT COALESCE(SUM(amount),0) INTO v_current_balance
      FROM public.financial_ledger WHERE user_id = NEW.seller_user_id;

    -- Insert ledger debit (negative amount)
    INSERT INTO public.financial_ledger (
      user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key
    ) VALUES (
      NEW.seller_user_id, NEW.transaction_id, 'dispute_hold', -v_net,
      v_current_balance - v_net,
      'MED aberto - valor bloqueado',
      'dispute_open_' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    -- Notify seller
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.seller_user_id, 'dispute_opened', 'MED solicitado',
      'Um MED foi aberto na transação ' || substring(NEW.transaction_id::text, 1, 8) || '. Valor bloqueado até decisão.',
      '/financeiro?tab=disputas'
    );

    RETURN NEW;
  END IF;

  -- ON UPDATE: resolution
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));

    SELECT net_amount INTO v_net FROM public.transactions WHERE id = NEW.transaction_id;
    IF v_net IS NULL THEN v_net := NEW.amount; END IF;

    SELECT COALESCE(SUM(amount),0) INTO v_current_balance
      FROM public.financial_ledger WHERE user_id = NEW.seller_user_id;

    -- WON: return funds, mark tx as paid again
    IF NEW.status IN ('won', 'resolved_seller') THEN
      INSERT INTO public.financial_ledger (
        user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key
      ) VALUES (
        NEW.seller_user_id, NEW.transaction_id, 'dispute_won', v_net,
        v_current_balance + v_net, 'MED ganho - valor devolvido',
        'dispute_won_' || NEW.id::text
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      UPDATE public.transactions SET status = 'approved', updated_at = now() WHERE id = NEW.transaction_id;

      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_won', 'MED ganho!',
        'Você ganhou o MED. Valor devolvido ao saldo.', '/financeiro?tab=disputas');

    -- LOST: keep debit, mark refunded permanently
    ELSIF NEW.status IN ('lost', 'resolved_buyer', 'chargeback') THEN
      UPDATE public.transactions SET status = 'chargeback', updated_at = now() WHERE id = NEW.transaction_id;

      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_lost', 'MED perdido',
        'O MED foi concluído contra você. Valor não será devolvido.', '/financeiro?tab=disputas');
    END IF;

    IF NEW.status IN ('won','lost','resolved_seller','resolved_buyer','chargeback') AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_balance_ins ON public.disputes;
DROP TRIGGER IF EXISTS trg_dispute_balance_upd ON public.disputes;

CREATE TRIGGER trg_dispute_balance_ins
  AFTER INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.handle_dispute_balance();

CREATE TRIGGER trg_dispute_balance_upd
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.handle_dispute_balance();
