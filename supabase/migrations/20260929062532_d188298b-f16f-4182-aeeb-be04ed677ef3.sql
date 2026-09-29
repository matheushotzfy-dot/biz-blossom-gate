
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS response_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS seller_response text,
  ADD COLUMN IF NOT EXISTS seller_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.dispute_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  actor_id uuid,
  event text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispute_events_dispute ON public.dispute_events(dispute_id, created_at);
GRANT SELECT ON public.dispute_events TO authenticated;
GRANT ALL ON public.dispute_events TO service_role;
ALTER TABLE public.dispute_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view dispute events" ON public.dispute_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Sellers view own dispute events" ON public.dispute_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.disputes d WHERE d.id = dispute_id AND d.seller_user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.balance_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  adjustment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bar_status ON public.balance_adjustment_requests(status, created_at DESC);
GRANT SELECT ON public.balance_adjustment_requests TO authenticated;
GRANT ALL ON public.balance_adjustment_requests TO service_role;
ALTER TABLE public.balance_adjustment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view adjustment requests" ON public.balance_adjustment_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.assert_admin() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_audit(_admin uuid, _action text, _entity text, _entity_id text, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs(admin_user_id, action, entity_type, entity_id, details)
  VALUES (_admin, _action, _entity, _entity_id, _details);
$$;

-- Open dispute (hold is applied by existing trigger)
CREATE OR REPLACE FUNCTION app_private.admin_open_dispute(_transaction_id uuid, _type text, _reason text, _deadline_days int DEFAULT 7)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _tx public.transactions%ROWTYPE; _id uuid;
BEGIN
  IF _type NOT IN ('medpix','pre_med_pix','refund','chargeback') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'motivo obrigatório'; END IF;
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'venda não encontrada'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed') THEN RAISE EXCEPTION 'venda não está paga'; END IF;
  IF EXISTS (SELECT 1 FROM public.disputes WHERE transaction_id = _transaction_id AND status IN ('open','in_review')) THEN
    RAISE EXCEPTION 'já existe disputa aberta para esta venda';
  END IF;
  INSERT INTO public.disputes(transaction_id, seller_user_id, buyer_name, buyer_email, buyer_phone, type, status, reason, amount, admin_user_id, response_deadline)
  VALUES (_transaction_id, _tx.user_id, _tx.customer_name, _tx.customer_email, _tx.customer_phone, _type, 'open', left(btrim(_reason),1000),
          _tx.amount, _admin, now() + make_interval(days => GREATEST(1, LEAST(COALESCE(_deadline_days,7),30))))
  RETURNING id INTO _id;
  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note) VALUES (_id, _admin, 'opened', left(btrim(_reason),1000));
  PERFORM app_private.admin_audit(_admin,'dispute_open','dispute',_id::text, jsonb_build_object('transaction_id',_transaction_id,'type',_type));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_resolve_dispute(_dispute_id uuid, _outcome text, _fee numeric DEFAULT 0, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _d public.disputes%ROWTYPE; _bal numeric; _fee_v numeric := ROUND(COALESCE(_fee,0),2);
BEGIN
  IF _outcome NOT IN ('seller','buyer') THEN RAISE EXCEPTION 'resultado inválido'; END IF;
  IF _fee_v < 0 OR _fee_v > 10000 THEN RAISE EXCEPTION 'taxa inválida'; END IF;
  SELECT * INTO _d FROM public.disputes WHERE id = _dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não encontrada'; END IF;
  IF _d.status NOT IN ('open','in_review') THEN RAISE EXCEPTION 'disputa já encerrada'; END IF;

  UPDATE public.disputes SET status = CASE WHEN _outcome='seller' THEN 'resolved_seller' ELSE 'resolved_buyer' END,
    won_by_seller = (_outcome='seller'), admin_user_id = _admin, fee_amount = CASE WHEN _outcome='buyer' THEN _fee_v ELSE 0 END,
    admin_notes = COALESCE(left(_note,2000), admin_notes), resolved_at = now()
  WHERE id = _dispute_id;

  IF _outcome = 'buyer' THEN
    UPDATE public.user_access SET is_active = false WHERE transaction_id = _d.transaction_id;
    IF _fee_v > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext(_d.seller_user_id::text));
      _bal := public.calculate_ledger_balance(_d.seller_user_id);
      INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (_d.seller_user_id, _d.transaction_id, 'debit', _fee_v, _bal - _fee_v, 'Taxa de disputa', 'dispute_fee_'||_dispute_id)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note)
  VALUES (_dispute_id, _admin, CASE WHEN _outcome='seller' THEN 'won_by_seller' ELSE 'lost_by_seller' END, _note);
  PERFORM app_private.admin_audit(_admin,'dispute_resolve','dispute',_dispute_id::text, jsonb_build_object('outcome',_outcome,'fee',_fee_v));
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_set_dispute_review(_dispute_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin();
BEGIN
  UPDATE public.disputes SET status='in_review', admin_user_id=_admin WHERE id=_dispute_id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não está aberta'; END IF;
  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note) VALUES (_dispute_id,_admin,'in_review',_note);
END $$;

CREATE OR REPLACE FUNCTION app_private.seller_respond_dispute(_dispute_id uuid, _response text, _evidence text[] DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.disputes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _response IS NULL OR length(btrim(_response)) < 10 THEN RAISE EXCEPTION 'defesa muito curta'; END IF;
  IF COALESCE(array_length(_evidence,1),0) > 10 THEN RAISE EXCEPTION 'máximo de 10 provas'; END IF;
  SELECT * INTO _d FROM public.disputes WHERE id=_dispute_id AND seller_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não encontrada'; END IF;
  IF _d.status NOT IN ('open','in_review') THEN RAISE EXCEPTION 'disputa encerrada'; END IF;
  IF _d.response_deadline IS NOT NULL AND now() > _d.response_deadline THEN RAISE EXCEPTION 'prazo de defesa encerrado'; END IF;
  UPDATE public.disputes SET seller_response=left(btrim(_response),4000), seller_responded_at=now(),
    evidence_urls = COALESCE(_evidence,'{}'), status='in_review' WHERE id=_dispute_id;
  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note) VALUES (_dispute_id, auth.uid(), 'seller_responded', left(btrim(_response),500));
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _res jsonb;
BEGIN
  _res := public.record_transaction_refund(_transaction_id, ROUND(_amount,2), _reason, _admin);
  IF NOT (_res->>'partial')::boolean THEN
    UPDATE public.user_access SET is_active=false WHERE transaction_id=_transaction_id;
  END IF;
  PERFORM app_private.admin_audit(_admin,'transaction_refund','transaction',_transaction_id::text,
    jsonb_build_object('amount',_amount,'reason',left(_reason,500)) || _res);
  RETURN _res;
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_request_balance_adjustment(_user_id uuid, _type text, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _adj uuid; _req uuid; _threshold numeric := 5000;
BEGIN
  IF _type NOT IN ('credit','debit') OR _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'valores inválidos'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'motivo obrigatório (mín. 5 caracteres)'; END IF;
  IF _amount > _threshold THEN
    INSERT INTO public.balance_adjustment_requests(user_id,type,amount,reason,requested_by)
    VALUES (_user_id,_type,ROUND(_amount,2),left(btrim(_reason),1000),_admin) RETURNING id INTO _req;
    PERFORM app_private.admin_audit(_admin,'balance_adjustment_requested','profile',_user_id::text, jsonb_build_object('request_id',_req,'type',_type,'amount',_amount));
    RETURN jsonb_build_object('status','pending_approval','request_id',_req);
  END IF;
  INSERT INTO public.balance_adjustments(user_id, admin_user_id, amount, type, reason)
  VALUES (_user_id,_admin,ROUND(_amount,2),_type,left(btrim(_reason),1000)) RETURNING id INTO _adj;
  PERFORM app_private.admin_audit(_admin,'balance_adjustment','profile',_user_id::text, jsonb_build_object('adjustment_id',_adj,'type',_type,'amount',_amount));
  RETURN jsonb_build_object('status','applied','adjustment_id',_adj);
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_decide_balance_adjustment(_request_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _r public.balance_adjustment_requests%ROWTYPE; _adj uuid;
BEGIN
  SELECT * INTO _r FROM public.balance_adjustment_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND OR _r.status <> 'pending' THEN RAISE EXCEPTION 'pedido não está pendente'; END IF;
  IF _r.requested_by = _admin THEN RAISE EXCEPTION 'outro administrador precisa aprovar'; END IF;
  IF _approve THEN
    INSERT INTO public.balance_adjustments(user_id, admin_user_id, amount, type, reason)
    VALUES (_r.user_id,_admin,_r.amount,_r.type,_r.reason) RETURNING id INTO _adj;
  END IF;
  UPDATE public.balance_adjustment_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decided_by=_admin, decided_at=now(), adjustment_id=_adj WHERE id=_request_id;
  PERFORM app_private.admin_audit(_admin, CASE WHEN _approve THEN 'balance_adjustment_approved' ELSE 'balance_adjustment_rejected' END,
    'profile', _r.user_id::text, jsonb_build_object('request_id',_request_id,'amount',_r.amount,'type',_r.type));
  RETURN jsonb_build_object('status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, 'adjustment_id', _adj);
END $$;

CREATE OR REPLACE FUNCTION app_private.get_seller_balance_breakdown(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ledger numeric; _held numeric; _retained numeric; _pending_w numeric;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'not authorized'; END IF;
  _ledger := public.calculate_ledger_balance(_user_id);
  SELECT COALESCE(SUM(COALESCE(t.net_amount,t.amount)),0) INTO _held FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id
    WHERE d.seller_user_id=_user_id AND d.status IN ('open','in_review');
  SELECT COALESCE(SUM(retained_amount),0) INTO _retained FROM public.transactions
    WHERE user_id=_user_id AND retained_amount>0 AND NOT COALESCE(retention_released,false) AND status IN ('approved','paid','completed');
  SELECT COALESCE(SUM(amount),0) INTO _pending_w FROM public.withdrawals WHERE user_id=_user_id AND status IN ('pending','processing');
  RETURN jsonb_build_object('available', GREATEST(_ledger,0), 'negative', LEAST(_ledger,0), 'ledger', _ledger,
    'held_disputes', _held, 'retained', _retained, 'pending_withdrawals', _pending_w);
END $$;

CREATE OR REPLACE FUNCTION app_private.get_seller_360(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _s jsonb; _w jsonb; _d jsonb; _age int; _cb_rate numeric; _rf_rate numeric; _risk int;
BEGIN
  SELECT jsonb_build_object(
    'approved_count', COUNT(*) FILTER (WHERE status IN ('approved','paid','completed','refunded','chargeback','disputed')),
    'approved_amount', COALESCE(SUM(amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'net_amount', COALESCE(SUM(net_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'fees_amount', COALESCE(SUM(fee_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'refunded_count', COUNT(*) FILTER (WHERE status='refunded' OR refunded_amount>0),
    'refunded_amount', COALESCE(SUM(refunded_amount),0),
    'chargeback_count', COUNT(*) FILTER (WHERE status IN ('chargeback','disputed')),
    'total_count', COUNT(*),
    'last_30d_amount', COALESCE(SUM(amount) FILTER (WHERE status IN ('approved','paid','completed') AND created_at > now()-interval '30 days'),0),
    'last_sale_at', MAX(created_at) FILTER (WHERE status IN ('approved','paid','completed'))
  ) INTO _s FROM public.transactions WHERE user_id=_user_id AND NOT COALESCE(is_simulated,false);
  SELECT jsonb_build_object('paid', COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','approved','paid')),0),
    'pending', COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','processing')),0),
    'rejected_count', COUNT(*) FILTER (WHERE status IN ('rejected','failed')), 'count', COUNT(*))
  INTO _w FROM public.withdrawals WHERE user_id=_user_id;
  SELECT jsonb_build_object('open', COUNT(*) FILTER (WHERE status IN ('open','in_review')),
    'won', COUNT(*) FILTER (WHERE status='resolved_seller'), 'lost', COUNT(*) FILTER (WHERE status='resolved_buyer'), 'total', COUNT(*))
  INTO _d FROM public.disputes WHERE seller_user_id=_user_id;
  SELECT GREATEST(0, EXTRACT(day FROM now()-created_at))::int INTO _age FROM public.profiles WHERE user_id=_user_id;
  _cb_rate := CASE WHEN (_s->>'approved_count')::numeric > 0 THEN ((_s->>'chargeback_count')::numeric + (_d->>'lost')::numeric) / (_s->>'approved_count')::numeric ELSE 0 END;
  _rf_rate := CASE WHEN (_s->>'approved_count')::numeric > 0 THEN (_s->>'refunded_count')::numeric / (_s->>'approved_count')::numeric ELSE 0 END;
  _risk := LEAST(100, ROUND(LEAST(_cb_rate*100,10)*5 + LEAST(_rf_rate*100,20)*1.5 + CASE WHEN COALESCE(_age,0) < 30 THEN 15 WHEN _age < 90 THEN 5 ELSE 0 END
           + CASE WHEN (_d->>'open')::int > 0 THEN 10 ELSE 0 END)::int);
  RETURN jsonb_build_object('sales', _s, 'withdrawals', _w, 'disputes', _d,
    'balance', app_private.get_seller_balance_breakdown(_user_id),
    'account_age_days', COALESCE(_age,0), 'chargeback_rate', ROUND(_cb_rate*100,2), 'refund_rate', ROUND(_rf_rate*100,2),
    'risk_score', _risk, 'risk_level', CASE WHEN _risk >= 60 THEN 'high' WHEN _risk >= 30 THEN 'medium' ELSE 'low' END);
END $$;

REVOKE ALL ON FUNCTION app_private.assert_admin(), app_private.admin_audit(uuid,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.admin_open_dispute(uuid,text,text,int), app_private.admin_resolve_dispute(uuid,text,numeric,text),
  app_private.admin_set_dispute_review(uuid,text), app_private.seller_respond_dispute(uuid,text,text[]),
  app_private.admin_refund_transaction(uuid,numeric,text), app_private.admin_request_balance_adjustment(uuid,text,numeric,text),
  app_private.admin_decide_balance_adjustment(uuid,boolean), app_private.get_seller_balance_breakdown(uuid), app_private.get_seller_360(uuid)
  TO authenticated;

-- Public SECURITY INVOKER wrappers
CREATE OR REPLACE FUNCTION public.admin_open_dispute(_transaction_id uuid, _type text, _reason text, _deadline_days int DEFAULT 7) RETURNS uuid
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.admin_open_dispute($1,$2,$3,$4) $$;
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_dispute_id uuid, _outcome text, _fee numeric DEFAULT 0, _note text DEFAULT NULL) RETURNS void
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.admin_resolve_dispute($1,$2,$3,$4) $$;
CREATE OR REPLACE FUNCTION public.admin_set_dispute_review(_dispute_id uuid, _note text DEFAULT NULL) RETURNS void
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.admin_set_dispute_review($1,$2) $$;
CREATE OR REPLACE FUNCTION public.seller_respond_dispute(_dispute_id uuid, _response text, _evidence text[] DEFAULT '{}') RETURNS void
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.seller_respond_dispute($1,$2,$3) $$;
CREATE OR REPLACE FUNCTION public.admin_refund_transaction(_transaction_id uuid, _amount numeric, _reason text) RETURNS jsonb
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.admin_refund_transaction($1,$2,$3) $$;
CREATE OR REPLACE FUNCTION public.admin_request_balance_adjustment(_user_id uuid, _type text, _amount numeric, _reason text) RETURNS jsonb
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.admin_request_balance_adjustment($1,$2,$3,$4) $$;
CREATE OR REPLACE FUNCTION public.admin_decide_balance_adjustment(_request_id uuid, _approve boolean) RETURNS jsonb
LANGUAGE sql SET search_path = public, app_private AS $$ SELECT app_private.admin_decide_balance_adjustment($1,$2) $$;
CREATE OR REPLACE FUNCTION public.get_seller_balance_breakdown(_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, app_private AS $$ SELECT app_private.get_seller_balance_breakdown($1) $$;
CREATE OR REPLACE FUNCTION public.get_seller_360(_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, app_private AS $$ SELECT app_private.get_seller_360($1) $$;
REVOKE ALL ON FUNCTION public.admin_open_dispute(uuid,text,text,int), public.admin_resolve_dispute(uuid,text,numeric,text),
  public.admin_set_dispute_review(uuid,text), public.seller_respond_dispute(uuid,text,text[]), public.admin_refund_transaction(uuid,numeric,text),
  public.admin_request_balance_adjustment(uuid,text,numeric,text), public.admin_decide_balance_adjustment(uuid,boolean),
  public.get_seller_balance_breakdown(uuid), public.get_seller_360(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_open_dispute(uuid,text,text,int), public.admin_resolve_dispute(uuid,text,numeric,text),
  public.admin_set_dispute_review(uuid,text), public.seller_respond_dispute(uuid,text,text[]), public.admin_refund_transaction(uuid,numeric,text),
  public.admin_request_balance_adjustment(uuid,text,numeric,text), public.admin_decide_balance_adjustment(uuid,boolean),
  public.get_seller_balance_breakdown(uuid), public.get_seller_360(uuid) TO authenticated;
