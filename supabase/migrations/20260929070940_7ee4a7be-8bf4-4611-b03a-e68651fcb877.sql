-- ===== 1. Fee breakdown stored per sale (percent vs fixed) =====
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS fee_percent_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_fixed_amount numeric(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.split_transaction_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _fixed numeric := 0; _m text := lower(COALESCE(NEW.payment_method,''));
BEGIN
  IF COALESCE(NEW.fee_amount,0) <= 0 THEN NEW.fee_percent_amount := 0; NEW.fee_fixed_amount := 0; RETURN NEW; END IF;
  SELECT CASE WHEN _m = 'pix' THEN pix_fixed WHEN _m IN ('card','credit_card','cartao') THEN card_fixed WHEN _m = 'boleto' THEN boleto_fixed ELSE transaction_fixed END
    INTO _fixed FROM public.custom_user_fees WHERE user_id = NEW.user_id;
  IF _fixed IS NULL THEN
    SELECT value INTO _fixed FROM public.fees WHERE name = CASE WHEN _m = 'pix' THEN 'Taxa Fixa PIX' WHEN _m IN ('card','credit_card','cartao') THEN 'Taxa Fixa Cartão' WHEN _m = 'boleto' THEN 'Taxa Fixa Boleto' ELSE 'Taxa Fixa por Transação' END LIMIT 1;
  END IF;
  NEW.fee_fixed_amount := LEAST(ROUND(COALESCE(_fixed,0),2), NEW.fee_amount);
  NEW.fee_percent_amount := ROUND(NEW.fee_amount - NEW.fee_fixed_amount, 2);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_split_transaction_fee ON public.transactions;
CREATE TRIGGER trg_split_transaction_fee BEFORE INSERT OR UPDATE OF fee_amount ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.split_transaction_fee();

-- ===== 2. Automatic reserve (default/fallback) acquirer for each sale =====
CREATE OR REPLACE FUNCTION public.compute_acquirer_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE acq_pct numeric; acq_fixed numeric;
BEGIN
  IF NEW.acquirer_id IS NULL THEN
    SELECT p.acquirer_id INTO NEW.acquirer_id FROM public.profiles p
     JOIN public.acquirers a ON a.id = p.acquirer_id AND a.is_active
     WHERE p.user_id = NEW.user_id LIMIT 1;
  END IF;
  IF NEW.acquirer_id IS NULL THEN  -- platform default, then backups by priority
    SELECT a.id INTO NEW.acquirer_id FROM public.acquirers a
     WHERE a.is_active AND COALESCE(a.health_status,'healthy') <> 'down'
       AND (a.supported_methods IS NULL OR cardinality(a.supported_methods) = 0 OR lower(COALESCE(NEW.payment_method,'')) = ANY(a.supported_methods))
     ORDER BY a.priority NULLS LAST, a.created_at LIMIT 1;
  END IF;
  IF NEW.acquirer_id IS NOT NULL AND (NEW.acquirer_fee_amount IS NULL OR NEW.acquirer_fee_amount = 0) THEN
    SELECT COALESCE(a.transaction_fee_percentage,0), COALESCE(a.transaction_fee_fixed,0) INTO acq_pct, acq_fixed FROM public.acquirers a WHERE a.id = NEW.acquirer_id;
    IF acq_pct IS NOT NULL THEN NEW.acquirer_fee_amount := ROUND(((NEW.amount * acq_pct / 100.0) + acq_fixed)::numeric, 2); END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ===== 3. Access helper: owner or partner with metrics permission =====
CREATE OR REPLACE FUNCTION app_private.assert_metrics_viewer()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _u uuid := auth.uid();
BEGIN
  IF _u IS NULL OR NOT app_private.has_financial_permission(_u,'metrics_view') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN _u;
END $$;
REVOKE ALL ON FUNCTION app_private.assert_metrics_viewer() FROM PUBLIC, anon;

ALTER TABLE public.financial_role_permissions DROP CONSTRAINT financial_role_permissions_permission_check;
ALTER TABLE public.financial_role_permissions ADD CONSTRAINT financial_role_permissions_permission_check
  CHECK (permission = ANY (ARRAY['balance_adjust_request','dispute_review','metrics_view','request_actions']));
INSERT INTO public.financial_role_permissions(role, permission, allowed) VALUES
  ('partner','metrics_view',true), ('partner','request_actions',true),
  ('manager','metrics_view',false), ('manager','request_actions',true)
ON CONFLICT DO NOTHING;

-- ===== 4. Financial metrics =====
CREATE OR REPLACE FUNCTION app_private.get_financial_metrics(_from timestamptz, _to timestamptz, _seller uuid, _acquirer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _v uuid := app_private.assert_metrics_viewer(); _paid text[] := ARRAY['approved','paid','completed','partially_refunded','refunded','chargeback','chargedback'];
  _tot jsonb; _methods jsonb; _daily jsonb; _out jsonb; _wd jsonb; _all int;
BEGIN
  IF _to <= _from OR _to - _from > interval '400 days' THEN RAISE EXCEPTION 'período inválido'; END IF;
  SELECT count(*) INTO _all FROM public.transactions t WHERE t.created_at >= _from AND t.created_at < _to AND NOT COALESCE(t.is_simulated,false)
    AND (_seller IS NULL OR t.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer);
  SELECT jsonb_build_object(
    'count', count(*), 'gross', COALESCE(sum(amount),0), 'platform_fee', COALESCE(sum(fee_amount),0),
    'fee_percent', COALESCE(sum(fee_percent_amount),0), 'fee_fixed', COALESCE(sum(fee_fixed_amount),0),
    'acquirer_fee', COALESCE(sum(acquirer_fee_amount),0), 'seller_net', COALESCE(sum(net_amount),0),
    'discounts', COALESCE(sum(discount_amount),0), 'all_count', _all,
    'conversion', CASE WHEN _all > 0 THEN round(count(*)::numeric * 100 / _all, 2) ELSE 0 END)
  INTO _tot FROM public.transactions t
  WHERE t.status = ANY(_paid) AND t.created_at >= _from AND t.created_at < _to AND NOT COALESCE(t.is_simulated,false)
    AND (_seller IS NULL OR t.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer);

  SELECT COALESCE(jsonb_agg(m ORDER BY m->>'method'),'[]'::jsonb) INTO _methods FROM (
    SELECT jsonb_build_object('method', COALESCE(payment_method,'outro'), 'count', count(*), 'gross', sum(amount), 'fee', sum(fee_amount),
      'fee_percent', sum(fee_percent_amount), 'fee_fixed', sum(fee_fixed_amount), 'acquirer_fee', COALESCE(sum(acquirer_fee_amount),0)) m
    FROM public.transactions t
    WHERE t.status = ANY(_paid) AND t.created_at >= _from AND t.created_at < _to AND NOT COALESCE(t.is_simulated,false)
      AND (_seller IS NULL OR t.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer)
    GROUP BY COALESCE(payment_method,'outro')) s;

  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'day'),'[]'::jsonb) INTO _daily FROM (
    SELECT jsonb_build_object('day', to_char(date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM-DD'),
      'gross', sum(amount), 'fee', sum(fee_amount), 'profit', sum(fee_amount) - COALESCE(sum(acquirer_fee_amount),0), 'count', count(*)) d
    FROM public.transactions t
    WHERE t.status = ANY(_paid) AND t.created_at >= _from AND t.created_at < _to AND NOT COALESCE(t.is_simulated,false)
      AND (_seller IS NULL OR t.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer)
    GROUP BY 1 - 1 + 0, date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')) s;

  SELECT jsonb_build_object(
    'refunds', COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'refund'),0),
    'chargebacks', COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'chargeback'),0),
    'dispute_holds', COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'dispute_hold'),0),
    'dispute_releases', COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'dispute_release'),0),
    'adjust_credit', COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'adjustment_credit'),0),
    'adjust_debit', COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'adjustment_debit'),0))
  INTO _out FROM public.financial_ledger l
  LEFT JOIN public.transactions t ON t.id = l.transaction_id
  WHERE l.created_at >= _from AND l.created_at < _to AND (_seller IS NULL OR l.user_id = _seller)
    AND (_acquirer IS NULL OR t.acquirer_id = _acquirer);

  _out := _out || jsonb_build_object(
    'med_lost', (SELECT COALESCE(sum(d.amount),0) FROM public.disputes d LEFT JOIN public.transactions t ON t.id = d.transaction_id
       WHERE d.type IN ('medpix','pre_med_pix') AND d.status = 'resolved_buyer' AND d.resolved_at >= _from AND d.resolved_at < _to
         AND (_seller IS NULL OR d.seller_user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer)),
    'med_open', (SELECT COALESCE(sum(d.amount),0) FROM public.disputes d LEFT JOIN public.transactions t ON t.id = d.transaction_id
       WHERE d.type IN ('medpix','pre_med_pix') AND d.status IN ('open','in_review')
         AND (_seller IS NULL OR d.seller_user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer)),
    'dispute_fees', (SELECT COALESCE(sum(d.fee_amount),0) FROM public.disputes d
       WHERE d.status = 'resolved_buyer' AND d.resolved_at >= _from AND d.resolved_at < _to AND (_seller IS NULL OR d.seller_user_id = _seller)));

  SELECT jsonb_build_object(
    'paid_count', count(*) FILTER (WHERE status IN ('completed','paid','approved')),
    'paid_amount', COALESCE(sum(amount) FILTER (WHERE status IN ('completed','paid','approved')),0),
    'fee', COALESCE(sum(fee_amount) FILTER (WHERE status IN ('completed','paid','approved')),0),
    'pending_count', count(*) FILTER (WHERE status IN ('pending','processing')),
    'pending_amount', COALESCE(sum(amount) FILTER (WHERE status IN ('pending','processing')),0),
    'rejected_count', count(*) FILTER (WHERE status IN ('rejected','failed','cancelled')))
  INTO _wd FROM public.withdrawals w
  WHERE w.created_at >= _from AND w.created_at < _to AND (_seller IS NULL OR w.user_id = _seller);

  RETURN jsonb_build_object('totals', _tot || jsonb_build_object(
      'platform_profit', (_tot->>'platform_fee')::numeric - (_tot->>'acquirer_fee')::numeric + (_wd->>'fee')::numeric + (_out->>'dispute_fees')::numeric),
    'methods', _methods, 'daily', _daily, 'outflows', _out, 'withdrawals', _wd);
END $$;
REVOKE ALL ON FUNCTION app_private.get_financial_metrics(timestamptz,timestamptz,uuid,uuid) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.get_financial_metrics(_from timestamptz, _to timestamptz, _seller uuid DEFAULT NULL, _acquirer uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public','app_private' AS $$ SELECT app_private.get_financial_metrics(_from,_to,_seller,_acquirer) $$;
REVOKE ALL ON FUNCTION public.get_financial_metrics(timestamptz,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_metrics(timestamptz,timestamptz,uuid,uuid) TO authenticated;

-- ===== 5. Acquirer overview =====
CREATE OR REPLACE FUNCTION app_private.get_acquirer_overview(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _v uuid := app_private.assert_metrics_viewer(); _default uuid; _r jsonb;
BEGIN
  SELECT id INTO _default FROM public.acquirers WHERE is_active ORDER BY priority NULLS LAST, created_at LIMIT 1;
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'priority')::int NULLS LAST),'[]'::jsonb) INTO _r FROM (
    SELECT jsonb_build_object('id',a.id,'name',a.name,'is_active',a.is_active,'priority',a.priority,'allow_failover',a.allow_failover,
      'health_status',a.health_status,'is_default',a.id = _default,
      'fee_percent',a.transaction_fee_percentage,'fee_fixed',a.transaction_fee_fixed,
      'sellers',(SELECT count(*) FROM public.profiles p WHERE p.acquirer_id = a.id),
      'tx_total',(SELECT count(*) FROM public.transactions t WHERE t.acquirer_id = a.id AND t.created_at >= _from AND t.created_at < _to),
      'tx_paid',(SELECT count(*) FROM public.transactions t WHERE t.acquirer_id = a.id AND t.created_at >= _from AND t.created_at < _to AND t.status IN ('approved','paid','completed','partially_refunded','refunded')),
      'gross',(SELECT COALESCE(sum(amount),0) FROM public.transactions t WHERE t.acquirer_id = a.id AND t.created_at >= _from AND t.created_at < _to AND t.status IN ('approved','paid','completed','partially_refunded','refunded')),
      'acquirer_fee',(SELECT COALESCE(sum(acquirer_fee_amount),0) FROM public.transactions t WHERE t.acquirer_id = a.id AND t.created_at >= _from AND t.created_at < _to AND t.status IN ('approved','paid','completed','partially_refunded','refunded'))) x
    FROM public.acquirers a) s;
  RETURN jsonb_build_object('default_id',_default,'sellers_on_default',(SELECT count(*) FROM public.profiles WHERE acquirer_id IS NULL),'acquirers',_r);
END $$;
REVOKE ALL ON FUNCTION app_private.get_acquirer_overview(timestamptz,timestamptz) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.get_acquirer_overview(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public','app_private' AS $$ SELECT app_private.get_acquirer_overview(_from,_to) $$;
REVOKE ALL ON FUNCTION public.get_acquirer_overview(timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_acquirer_overview(timestamptz,timestamptz) TO authenticated;

-- ===== 6. Seller acquirer history + balance by acquirer (owner only) =====
CREATE OR REPLACE FUNCTION app_private.get_seller_acquirer_history(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _a uuid := app_private.assert_admin();
BEGIN
  RETURN jsonb_build_object(
    'current', (SELECT jsonb_build_object('id',a.id,'name',a.name) FROM public.profiles p JOIN public.acquirers a ON a.id = p.acquirer_id WHERE p.user_id = _user_id),
    'history', (SELECT COALESCE(jsonb_agg(jsonb_build_object('at',e.created_at,'from',fa.name,'to',COALESCE(ta.name,'Padrão da plataforma'),'reason',e.reason,'trigger',e.trigger_type,'success',e.success) ORDER BY e.created_at DESC),'[]'::jsonb)
       FROM public.acquirer_failover_events e LEFT JOIN public.acquirers fa ON fa.id = e.from_acquirer_id LEFT JOIN public.acquirers ta ON ta.id = e.to_acquirer_id WHERE e.seller_id = _user_id),
    'usage', (SELECT COALESCE(jsonb_agg(u),'[]'::jsonb) FROM (
       SELECT jsonb_build_object('acquirer',COALESCE(a.name,'Sem adquirente'),'tx_total',count(*),
         'tx_paid',count(*) FILTER (WHERE t.status IN ('approved','paid','completed','partially_refunded','refunded')),
         'gross',COALESCE(sum(t.amount) FILTER (WHERE t.status IN ('approved','paid','completed','partially_refunded','refunded')),0),
         'net',COALESCE(sum(t.net_amount - COALESCE(t.refunded_amount,0) * COALESCE(t.net_amount,0) / NULLIF(t.amount,0)) FILTER (WHERE t.status IN ('approved','paid','completed','partially_refunded','refunded')),0),
         'fee',COALESCE(sum(t.fee_amount) FILTER (WHERE t.status IN ('approved','paid','completed','partially_refunded','refunded')),0),
         'first_at',min(t.created_at),'last_at',max(t.created_at)) u
       FROM public.transactions t LEFT JOIN public.acquirers a ON a.id = t.acquirer_id
       WHERE t.user_id = _user_id AND NOT COALESCE(t.is_simulated,false) GROUP BY a.name) s));
END $$;
REVOKE ALL ON FUNCTION app_private.get_seller_acquirer_history(uuid) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.get_seller_acquirer_history(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public','app_private' AS $$ SELECT app_private.get_seller_acquirer_history(_user_id) $$;
REVOKE ALL ON FUNCTION public.get_seller_acquirer_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_acquirer_history(uuid) TO authenticated;

-- ===== 7. Staff (partner/manager) requests approved by the owner =====
CREATE TABLE public.staff_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('acquirer_change','acquirer_toggle','fee_change','seller_freeze','platform_setting','other')),
  target_seller_id uuid,
  target_acquirer_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  requested_by uuid NOT NULL,
  requested_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_action_requests_status_idx ON public.staff_action_requests(status, created_at DESC);
CREATE INDEX staff_action_requests_requester_idx ON public.staff_action_requests(requested_by, created_at DESC);
GRANT SELECT ON public.staff_action_requests TO authenticated;
GRANT ALL ON public.staff_action_requests TO service_role;
ALTER TABLE public.staff_action_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester reads own requests" ON public.staff_action_requests FOR SELECT TO authenticated USING (requested_by = auth.uid());
CREATE POLICY "Owner reads all requests" ON public.staff_action_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER staff_action_requests_touch BEFORE UPDATE ON public.staff_action_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION app_private.request_staff_action(_kind text, _target_seller uuid, _target_acquirer uuid, _payload jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _u uuid := auth.uid(); _role text; _id uuid; _recent int;
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _u AND role::text IN ('partner','manager') ORDER BY role::text = 'partner' DESC LIMIT 1;
  IF _role IS NULL OR NOT app_private.has_financial_permission(_u,'request_actions') THEN RAISE EXCEPTION 'sem permissão para enviar pedidos'; END IF;
  SELECT count(*) INTO _recent FROM public.staff_action_requests WHERE requested_by = _u AND created_at > now() - interval '1 hour';
  IF _recent >= 30 THEN RAISE EXCEPTION 'muitos pedidos em sequência'; END IF;
  IF _kind = 'acquirer_change' AND (_target_seller IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target_seller)) THEN RAISE EXCEPTION 'seller inválido'; END IF;
  IF _target_acquirer IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.acquirers WHERE id = _target_acquirer) THEN RAISE EXCEPTION 'adquirente inválida'; END IF;
  INSERT INTO public.staff_action_requests(kind,target_seller_id,target_acquirer_id,payload,reason,requested_by,requested_role)
  VALUES (_kind,_target_seller,_target_acquirer,COALESCE(_payload,'{}'::jsonb) - 'password' - 'token',btrim(_reason),_u,_role) RETURNING id INTO _id;
  INSERT INTO public.admin_alerts(kind,severity,message,metadata) VALUES ('staff_request','warning','Novo pedido da equipe aguardando aprovação', jsonb_build_object('request_id',_id,'kind',_kind,'role',_role));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION app_private.request_staff_action(text,uuid,uuid,jsonb,text) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.request_staff_action(_kind text, _reason text, _target_seller uuid DEFAULT NULL, _target_acquirer uuid DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE sql SET search_path TO 'public','app_private' AS $$ SELECT app_private.request_staff_action(_kind,_target_seller,_target_acquirer,_payload,_reason) $$;
REVOKE ALL ON FUNCTION public.request_staff_action(text,text,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_staff_action(text,text,uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.admin_decide_staff_action(_id uuid, _approve boolean, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _a uuid := app_private.assert_admin(); _r public.staff_action_requests%ROWTYPE; _exec jsonb := NULL;
BEGIN
  SELECT * INTO _r FROM public.staff_action_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido não encontrado'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'pedido já decidido'; END IF;
  IF NOT _approve AND (_note IS NULL OR length(btrim(_note)) < 5) THEN RAISE EXCEPTION 'informe o motivo da recusa'; END IF;
  IF _approve AND _r.kind = 'acquirer_change' THEN
    _exec := public.admin_set_seller_acquirer(_r.target_seller_id, _r.target_acquirer_id, 'Pedido aprovado: ' || left(_r.reason,200));
  ELSIF _approve AND _r.kind = 'acquirer_toggle' AND _r.target_acquirer_id IS NOT NULL THEN
    _exec := to_jsonb(public.admin_set_acquirer_active(_r.target_acquirer_id, COALESCE((_r.payload->>'active')::boolean, false), 'Pedido aprovado: ' || left(_r.reason,200)));
  END IF;
  UPDATE public.staff_action_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decision_note = NULLIF(left(btrim(COALESCE(_note,'')),1000),''), decided_by = _a, decided_at = now() WHERE id = _id;
  PERFORM app_private.admin_audit(_a, CASE WHEN _approve THEN 'staff_request_approved' ELSE 'staff_request_rejected' END, 'staff_action_request', _id::text,
    jsonb_build_object('kind',_r.kind,'requested_by',_r.requested_by,'note',_note,'executed',_exec));
  RETURN jsonb_build_object('status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, 'executed', _exec IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION app_private.admin_decide_staff_action(uuid,boolean,text) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.admin_decide_staff_action(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public','app_private' AS $$
BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_decide_staff_action(_id,_approve,_note); END $$;
REVOKE ALL ON FUNCTION public.admin_decide_staff_action(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_staff_action(uuid,boolean,text) TO authenticated;

-- Acquirer names readable by partners for their panel (no secrets)
CREATE OR REPLACE FUNCTION public.list_acquirers_basic()
RETURNS TABLE(id uuid, name text, is_active boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR app_private.has_financial_permission(auth.uid(),'metrics_view') OR app_private.has_financial_permission(auth.uid(),'request_actions')) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY SELECT a.id, a.name, a.is_active FROM public.acquirers a ORDER BY a.priority NULLS LAST, a.name;
END $$;
REVOKE ALL ON FUNCTION public.list_acquirers_basic() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_acquirers_basic() TO authenticated;