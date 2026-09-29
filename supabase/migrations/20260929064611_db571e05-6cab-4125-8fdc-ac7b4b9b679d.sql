ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS external_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS disputes_external_ref_uniq ON public.disputes(external_ref) WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_active_per_tx ON public.disputes(transaction_id) WHERE status IN ('open','in_review');

-- Balance effects of a dispute, with exact hold/release amounts
CREATE OR REPLACE FUNCTION public.handle_dispute_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _hold numeric; _held numeric; _bal numeric; _ins integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));
    SELECT * INTO _tx FROM public.transactions WHERE id = NEW.transaction_id AND user_id = NEW.seller_user_id FOR UPDATE;
    IF NOT FOUND OR COALESCE(_tx.amount,0) <= 0 THEN RAISE EXCEPTION 'Transação inválida para abertura de disputa'; END IF;
    _hold := ROUND(COALESCE(_tx.net_amount,_tx.amount) * (_tx.amount - COALESCE(_tx.refunded_amount,0)) / _tx.amount, 2);
    IF _hold <= 0 THEN RAISE EXCEPTION 'Venda já totalmente reembolsada'; END IF;
    _bal := public.calculate_ledger_balance(NEW.seller_user_id);
    INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES (NEW.seller_user_id, NEW.transaction_id, 'dispute_hold', _hold, _bal - _hold,
            CASE WHEN NEW.type IN ('medpix','pre_med_pix') THEN 'MED PIX - valor congelado em análise' ELSE 'Disputa - valor congelado em análise' END,
            'dispute_open_' || NEW.id)
    ON CONFLICT (idempotency_key) DO NOTHING;
    GET DIAGNOSTICS _ins = ROW_COUNT;
    UPDATE public.transactions SET status = 'disputed', updated_at = now() WHERE id = NEW.transaction_id AND status <> 'disputed';
    IF _ins > 0 THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_opened',
        CASE WHEN NEW.type IN ('medpix','pre_med_pix') THEN 'MED PIX - transação em análise' ELSE 'Disputa - transação em análise' END,
        'A venda ' || substring(NEW.transaction_id::text,1,8) || ' está em análise. R$ ' || to_char(_hold,'FM999999990.00') || ' congelados até a decisão.',
        '/financeiro?tab=disputas');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Immutable money fields
    IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id OR NEW.seller_user_id IS DISTINCT FROM OLD.seller_user_id
       OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'Dados financeiros da disputa não podem ser alterados';
    END IF;
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
    IF OLD.status IN ('resolved_seller','resolved_buyer','closed') THEN RAISE EXCEPTION 'Disputa já encerrada não pode ser alterada'; END IF;
    IF NEW.status = 'closed' THEN RAISE EXCEPTION 'Use a decisão (seller ou cliente) para encerrar'; END IF;
    IF NEW.status NOT IN ('resolved_seller','resolved_buyer') THEN RETURN NEW; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));
    SELECT * INTO _tx FROM public.transactions WHERE id = NEW.transaction_id FOR UPDATE;
    SELECT amount INTO _held FROM public.financial_ledger WHERE idempotency_key = 'dispute_open_' || NEW.id;
    _bal := public.calculate_ledger_balance(NEW.seller_user_id);

    IF NEW.status = 'resolved_seller' THEN
      IF COALESCE(_held,0) > 0 THEN
        INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (NEW.seller_user_id, NEW.transaction_id, 'dispute_release', _held, _bal + _held, 'Análise encerrada a favor do seller - valor devolvido', 'dispute_release_' || NEW.id)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      UPDATE public.transactions SET status = 'approved', updated_at = now() WHERE id = NEW.transaction_id AND status = 'disputed';
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_won', 'Análise encerrada a seu favor', 'O valor congelado voltou para o seu saldo.', '/financeiro?tab=disputas');
    ELSE
      -- Buyer won: hold stays as the definitive debit. Release security retention so it isn't charged twice.
      IF COALESCE(_tx.retained_amount,0) > 0 AND NOT COALESCE(_tx.retention_released,false) THEN
        INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (NEW.seller_user_id, NEW.transaction_id, 'retention_release', _tx.retained_amount, _bal + _tx.retained_amount, 'Liberação de retenção (MED encerrado)', 'tx_retrelease_' || NEW.transaction_id)
        ON CONFLICT (idempotency_key) DO NOTHING;
        UPDATE public.transactions SET retention_released = true WHERE id = NEW.transaction_id;
      END IF;
      UPDATE public.transactions SET status = 'chargeback', updated_at = now() WHERE id = NEW.transaction_id AND status = 'disputed';
      PERFORM public.reverse_transaction_splits(NEW.transaction_id);
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.seller_user_id, 'dispute_lost', 'Análise encerrada a favor do cliente', 'O valor congelado da venda foi removido do seu saldo.', '/financeiro?tab=disputas');
    END IF;
    IF NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

-- Core opener shared by admin and acquirer intake
CREATE OR REPLACE FUNCTION app_private.open_dispute_core(_transaction_id uuid, _type text, _reason text, _deadline_days integer, _actor uuid, _external_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tx public.transactions%ROWTYPE; _id uuid;
BEGIN
  IF _type NOT IN ('medpix','pre_med_pix','refund','chargeback') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'motivo obrigatório'; END IF;
  IF _external_ref IS NOT NULL THEN
    SELECT id INTO _id FROM public.disputes WHERE external_ref = _external_ref;
    IF FOUND THEN RETURN _id; END IF;
  END IF;
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'venda não encontrada'; END IF;
  IF COALESCE(_tx.is_simulated,false) THEN RAISE EXCEPTION 'venda simulada'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed') THEN RAISE EXCEPTION 'venda não está paga'; END IF;
  IF _type IN ('medpix','pre_med_pix') AND lower(COALESCE(_tx.payment_method,'')) <> 'pix' THEN RAISE EXCEPTION 'MED PIX só vale para vendas PIX'; END IF;
  IF _type = 'chargeback' AND lower(COALESCE(_tx.payment_method,'')) NOT IN ('credit_card','card','cartao') THEN RAISE EXCEPTION 'chargeback só vale para vendas no cartão'; END IF;
  IF COALESCE(_tx.refunded_amount,0) >= _tx.amount THEN RAISE EXCEPTION 'venda já totalmente reembolsada'; END IF;
  IF EXISTS (SELECT 1 FROM public.disputes WHERE transaction_id = _transaction_id AND status IN ('open','in_review')) THEN
    RAISE EXCEPTION 'já existe análise aberta para esta venda';
  END IF;
  INSERT INTO public.disputes(transaction_id, seller_user_id, buyer_name, buyer_email, buyer_phone, type, status, reason, amount, admin_user_id, response_deadline, external_ref)
  VALUES (_transaction_id, _tx.user_id, _tx.customer_name, _tx.customer_email, _tx.customer_phone, _type, 'open', left(btrim(_reason),1000),
          _tx.amount - COALESCE(_tx.refunded_amount,0), _actor, now() + make_interval(days => GREATEST(1, LEAST(COALESCE(_deadline_days,7),30))), _external_ref)
  RETURNING id INTO _id;
  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note) VALUES (_id, _actor, 'opened', left(btrim(_reason),1000));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION app_private.open_dispute_core(uuid,text,text,integer,uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.admin_open_dispute(_transaction_id uuid, _type text, _reason text, _deadline_days integer DEFAULT 7)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _admin uuid := app_private.assert_admin(); _id uuid;
BEGIN
  _id := app_private.open_dispute_core(_transaction_id, _type, _reason, _deadline_days, _admin, NULL);
  PERFORM app_private.admin_audit(_admin,'dispute_open','dispute',_id::text, jsonb_build_object('transaction_id',_transaction_id,'type',_type));
  RETURN _id;
END $$;

-- Acquirer intake (server only)
CREATE OR REPLACE FUNCTION public.system_open_med(_transaction_id uuid, _external_ref text, _reason text, _deadline_days integer DEFAULT 7)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') AND COALESCE(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'service role only'; END IF;
  IF _external_ref IS NULL OR length(btrim(_external_ref)) < 3 THEN RAISE EXCEPTION 'referência externa obrigatória'; END IF;
  RETURN app_private.open_dispute_core(_transaction_id, 'medpix', COALESCE(NULLIF(btrim(_reason),''),'MED PIX notificado pela adquirente'), _deadline_days, NULL, btrim(_external_ref));
END $$;
REVOKE ALL ON FUNCTION public.system_open_med(uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_open_med(uuid,text,text,integer) TO service_role;

-- Seller-issued refund
CREATE OR REPLACE FUNCTION app_private.seller_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _tx public.transactions%ROWTYPE; _amt numeric := ROUND(COALESCE(_amount,0),2);
        _net numeric; _bal numeric; _res jsonb; _recent int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'informe o motivo do reembolso'; END IF;
  IF _amt <= 0 THEN RAISE EXCEPTION 'valor inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_uid::text));
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND OR _tx.user_id <> _uid THEN RAISE EXCEPTION 'venda não encontrada'; END IF;
  IF COALESCE(_tx.is_simulated,false) THEN RAISE EXCEPTION 'venda simulada'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND COALESCE(account_status,'active') IN ('frozen','banned','suspended')) THEN RAISE EXCEPTION 'conta bloqueada'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed') THEN RAISE EXCEPTION 'esta venda não pode ser reembolsada'; END IF;
  IF EXISTS (SELECT 1 FROM public.disputes WHERE transaction_id = _transaction_id AND status IN ('open','in_review')) THEN RAISE EXCEPTION 'venda em análise (MED) não pode ser reembolsada'; END IF;
  IF _amt > _tx.amount - COALESCE(_tx.refunded_amount,0) THEN RAISE EXCEPTION 'valor maior que o restante da venda'; END IF;
  SELECT count(*) INTO _recent FROM public.financial_ledger WHERE user_id = _uid AND entry_type = 'refund' AND created_at > now() - interval '1 hour';
  IF _recent >= 30 THEN RAISE EXCEPTION 'muitos reembolsos em sequência, tente mais tarde'; END IF;
  _net := ROUND((_amt / _tx.amount) * COALESCE(_tx.net_amount,_tx.amount), 2);
  _bal := public.calculate_ledger_balance(_uid);
  IF _bal < _net THEN RAISE EXCEPTION 'saldo insuficiente para reembolsar (necessário R$ %)', to_char(_net,'FM999999990.00'); END IF;
  _res := public.record_transaction_refund(_transaction_id, _amt, _reason, _uid);
  UPDATE public.transactions SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('last_refund_by','seller','refund_payout_status','pending_acquirer') WHERE id = _transaction_id;
  IF NOT (_res->>'partial')::boolean THEN PERFORM app_private.revoke_access_for_tx(_transaction_id); END IF;
  RETURN _res || jsonb_build_object('debited', _net);
END $$;
REVOKE ALL ON FUNCTION app_private.seller_refund_transaction(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.seller_refund_transaction(uuid,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO 'public','app_private'
AS $$ SELECT app_private.seller_refund_transaction($1,$2,$3) $$;
REVOKE ALL ON FUNCTION public.seller_refund_transaction(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_refund_transaction(uuid,numeric,text) TO authenticated;