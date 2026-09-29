
CREATE OR REPLACE FUNCTION app_private.admin_request_balance_adjustment(_user_id uuid, _type text, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _adj uuid; _req uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _type NOT IN ('credit','debit') OR _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'valores inválidos'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'motivo obrigatório (mín. 5 caracteres)'; END IF;

  IF public.has_role(_uid,'admin') THEN
    INSERT INTO public.balance_adjustments(user_id, admin_user_id, amount, type, reason)
    VALUES (_user_id,_uid,ROUND(_amount,2),_type,left(btrim(_reason),1000)) RETURNING id INTO _adj;
    PERFORM app_private.admin_audit(_uid,'balance_adjustment','profile',_user_id::text, jsonb_build_object('adjustment_id',_adj,'type',_type,'amount',_amount));
    RETURN jsonb_build_object('status','applied','adjustment_id',_adj);
  ELSIF public.has_role(_uid,'manager') OR public.has_role(_uid,'employee') THEN
    INSERT INTO public.balance_adjustment_requests(user_id,type,amount,reason,requested_by)
    VALUES (_user_id,_type,ROUND(_amount,2),left(btrim(_reason),1000),_uid) RETURNING id INTO _req;
    PERFORM app_private.admin_audit(_uid,'balance_adjustment_requested','profile',_user_id::text, jsonb_build_object('request_id',_req,'type',_type,'amount',_amount));
    RETURN jsonb_build_object('status','pending_approval','request_id',_req);
  END IF;
  RAISE EXCEPTION 'not authorized';
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_decide_balance_adjustment(_request_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _r public.balance_adjustment_requests%ROWTYPE; _adj uuid;
BEGIN
  SELECT * INTO _r FROM public.balance_adjustment_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND OR _r.status <> 'pending' THEN RAISE EXCEPTION 'pedido não está pendente'; END IF;
  IF _approve THEN
    INSERT INTO public.balance_adjustments(user_id, admin_user_id, amount, type, reason)
    VALUES (_r.user_id,_admin,_r.amount,_r.type,_r.reason) RETURNING id INTO _adj;
  END IF;
  UPDATE public.balance_adjustment_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decided_by=_admin, decided_at=now(), adjustment_id=_adj WHERE id=_request_id;
  PERFORM app_private.admin_audit(_admin, CASE WHEN _approve THEN 'balance_adjustment_approved' ELSE 'balance_adjustment_rejected' END,
    'profile', _r.user_id::text, jsonb_build_object('request_id',_request_id,'amount',_r.amount,'type',_r.type,'requested_by',_r.requested_by));
  RETURN jsonb_build_object('status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, 'adjustment_id', _adj);
END $$;

CREATE POLICY "Staff view own adjustment requests" ON public.balance_adjustment_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());
