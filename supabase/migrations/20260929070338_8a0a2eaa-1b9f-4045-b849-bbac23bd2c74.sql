-- 1) Manual-approval settings (default: everything manual)
INSERT INTO public.platform_settings(key, value)
VALUES ('manual_approval', '{"refunds":true,"med":true,"withdrawals":true,"acquirer_auto_intake":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Refund confirmation queue
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  debited_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (debited_amount >= 0),
  reason text NOT NULL,
  requested_by uuid NOT NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('seller','admin','manager','employee')),
  tx_status_before text,
  status text NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation','confirmed','reverted')),
  proof_ref text,
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refund_requests_status_idx ON public.refund_requests(status, created_at DESC);
CREATE INDEX refund_requests_seller_idx ON public.refund_requests(seller_user_id, created_at DESC);
CREATE INDEX refund_requests_tx_idx ON public.refund_requests(transaction_id);

GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers read own refund requests" ON public.refund_requests
  FOR SELECT TO authenticated USING (seller_user_id = auth.uid());
CREATE POLICY "Admins read all refund requests" ON public.refund_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER refund_requests_touch BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper: register queue item after a refund was recorded
CREATE OR REPLACE FUNCTION app_private.enqueue_refund(_tx uuid, _amount numeric, _reason text, _by uuid, _role text, _status_before text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _seller uuid; _debited numeric; _id uuid;
BEGIN
  SELECT user_id INTO _seller FROM public.transactions WHERE id = _tx;
  SELECT COALESCE(SUM(amount),0) INTO _debited FROM public.financial_ledger
   WHERE transaction_id = _tx AND entry_type = 'refund' AND created_at >= now();
  IF _debited = 0 THEN
    SELECT ROUND((_amount / NULLIF(amount,0)) * COALESCE(net_amount, amount), 2) INTO _debited FROM public.transactions WHERE id = _tx;
  END IF;
  INSERT INTO public.refund_requests(transaction_id, seller_user_id, amount, debited_amount, reason, requested_by, requested_role, tx_status_before)
  VALUES (_tx, _seller, ROUND(_amount,2), COALESCE(_debited,0), left(btrim(_reason),1000), _by, _role, _status_before)
  RETURNING id INTO _id;
  UPDATE public.transactions SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('refund_payout_status','pending_confirmation','refund_request_id',_id) WHERE id = _tx;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION app_private.enqueue_refund(uuid,numeric,text,uuid,text,text) FROM PUBLIC, anon, authenticated;

-- 3) Seller refund: debits now + goes to owner queue
CREATE OR REPLACE FUNCTION app_private.seller_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _uid uuid := auth.uid(); _tx public.transactions%ROWTYPE; _amt numeric := ROUND(COALESCE(_amount,0),2);
        _net numeric; _bal numeric; _res jsonb; _recent int; _req uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'informe o motivo do reembolso'; END IF;
  IF _amt <= 0 THEN RAISE EXCEPTION 'valor inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_uid::text));
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND OR _tx.user_id <> _uid THEN RAISE EXCEPTION 'venda não encontrada'; END IF;
  IF COALESCE(_tx.is_simulated,false) THEN RAISE EXCEPTION 'venda simulada'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND COALESCE(account_status,'active') IN ('frozen','banned','suspended')) THEN RAISE EXCEPTION 'conta bloqueada'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed','partially_refunded') THEN RAISE EXCEPTION 'esta venda não pode ser reembolsada'; END IF;
  IF EXISTS (SELECT 1 FROM public.disputes WHERE transaction_id = _transaction_id AND status IN ('open','in_review')) THEN RAISE EXCEPTION 'venda em análise (MED) não pode ser reembolsada'; END IF;
  IF EXISTS (SELECT 1 FROM public.refund_requests WHERE transaction_id = _transaction_id AND status = 'pending_confirmation') THEN RAISE EXCEPTION 'já existe um reembolso aguardando confirmação para esta venda'; END IF;
  IF _amt > _tx.amount - COALESCE(_tx.refunded_amount,0) THEN RAISE EXCEPTION 'valor maior que o restante da venda'; END IF;
  SELECT count(*) INTO _recent FROM public.financial_ledger WHERE user_id = _uid AND entry_type = 'refund' AND created_at > now() - interval '1 hour';
  IF _recent >= 30 THEN RAISE EXCEPTION 'muitos reembolsos em sequência, tente mais tarde'; END IF;
  _net := ROUND((_amt / _tx.amount) * COALESCE(_tx.net_amount,_tx.amount), 2);
  _bal := public.calculate_ledger_balance(_uid);
  IF _bal < _net THEN RAISE EXCEPTION 'saldo insuficiente para reembolsar (necessário R$ %)', to_char(_net,'FM999999990.00'); END IF;
  _res := public.record_transaction_refund(_transaction_id, _amt, _reason, _uid);
  UPDATE public.transactions SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('last_refund_by','seller') WHERE id = _transaction_id;
  _req := app_private.enqueue_refund(_transaction_id, _amt, _reason, _uid, 'seller', _tx.status);
  IF NOT (_res->>'partial')::boolean THEN PERFORM app_private.revoke_access_for_tx(_transaction_id); END IF;
  RETURN _res || jsonb_build_object('debited', _net, 'request_id', _req, 'payout_status','pending_confirmation');
END $function$;

-- 4) Admin/support refund: same queue
CREATE OR REPLACE FUNCTION app_private.admin_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _admin uuid := app_private.assert_admin(); _res jsonb; _before text; _req uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.refund_requests WHERE transaction_id = _transaction_id AND status = 'pending_confirmation') THEN
    RAISE EXCEPTION 'já existe um reembolso aguardando confirmação para esta venda';
  END IF;
  SELECT status INTO _before FROM public.transactions WHERE id = _transaction_id;
  _res := public.record_transaction_refund(_transaction_id, ROUND(_amount,2), _reason, _admin);
  _req := app_private.enqueue_refund(_transaction_id, _amount, _reason, _admin, 'admin', _before);
  IF NOT (_res->>'partial')::boolean THEN PERFORM app_private.revoke_access_for_tx(_transaction_id); END IF;
  PERFORM app_private.admin_audit(_admin,'transaction_refund','transaction',_transaction_id::text,
    jsonb_build_object('amount',_amount,'reason',left(_reason,500),'request_id',_req) || _res);
  RETURN _res || jsonb_build_object('request_id',_req);
END $function$;

-- 5) Owner decides: confirmed (money returned to buyer) or reverted (not returned -> credit seller back)
CREATE OR REPLACE FUNCTION app_private.admin_decide_refund(_request_id uuid, _outcome text, _note text, _proof text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _admin uuid := app_private.assert_admin(); _r public.refund_requests%ROWTYPE; _bal numeric;
BEGIN
  IF _outcome NOT IN ('confirmed','reverted') THEN RAISE EXCEPTION 'decisão inválida'; END IF;
  IF _outcome = 'reverted' AND (_note IS NULL OR length(btrim(_note)) < 5) THEN RAISE EXCEPTION 'informe o motivo (mín. 5 caracteres)'; END IF;
  SELECT * INTO _r FROM public.refund_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido não encontrado'; END IF;
  IF _r.status <> 'pending_confirmation' THEN RAISE EXCEPTION 'pedido já decidido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_r.seller_user_id::text));

  IF _outcome = 'reverted' THEN
    PERFORM 1 FROM public.transactions WHERE id = _r.transaction_id FOR UPDATE;
    IF _r.debited_amount > 0 THEN
      _bal := public.calculate_ledger_balance(_r.seller_user_id) + _r.debited_amount;
      INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (_r.seller_user_id, _r.transaction_id, 'adjustment_credit', _r.debited_amount, _bal,
              'Reembolso não efetivado — saldo devolvido: ' || left(btrim(_note),300), 'refund_revert:' || _r.id);
    END IF;
    UPDATE public.transactions
       SET refunded_amount = GREATEST(0, ROUND(COALESCE(refunded_amount,0) - _r.amount, 2)),
           status = CASE WHEN status = 'refunded' THEN COALESCE(_r.tx_status_before, 'paid') ELSE status END,
           metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('refund_payout_status','reverted'),
           updated_at = now()
     WHERE id = _r.transaction_id;
  ELSE
    UPDATE public.transactions
       SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('refund_payout_status','confirmed','refund_confirmed_at',now()),
           updated_at = now()
     WHERE id = _r.transaction_id;
  END IF;

  UPDATE public.refund_requests
     SET status = _outcome, decision_note = NULLIF(left(btrim(COALESCE(_note,'')),1000),''),
         proof_ref = NULLIF(left(btrim(COALESCE(_proof,'')),500),''), decided_by = _admin, decided_at = now()
   WHERE id = _request_id;

  PERFORM app_private.admin_audit(_admin, 'refund_' || _outcome, 'refund_request', _request_id::text,
    jsonb_build_object('transaction_id',_r.transaction_id,'amount',_r.amount,'debited',_r.debited_amount,'note',_note));
  RETURN jsonb_build_object('status', _outcome, 'credited_back', CASE WHEN _outcome='reverted' THEN _r.debited_amount ELSE 0 END);
END $$;
REVOKE ALL ON FUNCTION app_private.admin_decide_refund(uuid,text,text,text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_decide_refund(_request_id uuid, _outcome text, _note text DEFAULT NULL, _proof text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public','app_private' AS $$
BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_decide_refund(_request_id,_outcome,_note,_proof); END $$;
REVOKE ALL ON FUNCTION public.admin_decide_refund(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_refund(uuid,text,text,text) TO authenticated;

-- 6) Admin list with seller + tx info
CREATE OR REPLACE FUNCTION app_private.admin_list_refund_requests(_status text, _limit int, _offset int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _admin uuid := app_private.assert_admin(); _total int; _rows jsonb;
BEGIN
  SELECT count(*) INTO _total FROM public.refund_requests r WHERE _status IS NULL OR r.status = _status;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO _rows FROM (
    SELECT jsonb_build_object('id',r.id,'created_at',r.created_at,'status',r.status,'amount',r.amount,'debited_amount',r.debited_amount,
      'reason',r.reason,'requested_role',r.requested_role,'decision_note',r.decision_note,'proof_ref',r.proof_ref,'decided_at',r.decided_at,
      'transaction_id',r.transaction_id,'tx_amount',t.amount,'payment_method',t.payment_method,'customer_name',t.customer_name,'customer_email',t.customer_email,
      'seller_name',p.full_name,'seller_email',p.email) x
    FROM public.refund_requests r
    JOIN public.transactions t ON t.id = r.transaction_id
    LEFT JOIN public.profiles p ON p.id = r.seller_user_id
    WHERE _status IS NULL OR r.status = _status
    ORDER BY r.created_at DESC LIMIT LEAST(GREATEST(_limit,1),100) OFFSET GREATEST(_offset,0)) s;
  RETURN jsonb_build_object('total',_total,'rows',_rows);
END $$;
REVOKE ALL ON FUNCTION app_private.admin_list_refund_requests(text,int,int) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.admin_list_refund_requests(_status text DEFAULT 'pending_confirmation', _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public','app_private' AS $$ SELECT app_private.admin_list_refund_requests(_status,_limit,_offset) $$;
REVOKE ALL ON FUNCTION public.admin_list_refund_requests(text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_refund_requests(text,int,int) TO authenticated;

-- 7) Manual-approval settings (admin only)
CREATE OR REPLACE FUNCTION app_private.admin_set_manual_approval(_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _admin uuid := app_private.assert_admin(); _clean jsonb;
BEGIN
  _clean := jsonb_build_object(
    'refunds', COALESCE((_value->>'refunds')::boolean, true),
    'med', COALESCE((_value->>'med')::boolean, true),
    'withdrawals', COALESCE((_value->>'withdrawals')::boolean, true),
    'acquirer_auto_intake', COALESCE((_value->>'acquirer_auto_intake')::boolean, false));
  INSERT INTO public.platform_settings(key,value,updated_by) VALUES ('manual_approval',_clean,_admin)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = _admin, updated_at = now();
  PERFORM app_private.admin_audit(_admin,'manual_approval_changed','platform_settings','manual_approval',_clean);
  RETURN _clean;
END $$;
REVOKE ALL ON FUNCTION app_private.admin_set_manual_approval(jsonb) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.admin_set_manual_approval(_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public','app_private' AS $$
BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_manual_approval(_value); END $$;
REVOKE ALL ON FUNCTION public.admin_set_manual_approval(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_manual_approval(jsonb) TO authenticated;