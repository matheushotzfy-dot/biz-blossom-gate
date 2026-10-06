ALTER TABLE public.manager_seller_assignments
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_by uuid,
  ADD COLUMN IF NOT EXISTS end_reason text;

UPDATE public.manager_seller_assignments
SET started_at = COALESCE(started_at, created_at)
WHERE started_at IS NULL;

ALTER TABLE public.manager_seller_assignments
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN started_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_manager_seller_one_active
  ON public.manager_seller_assignments (seller_user_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manager_assignments_active_manager
  ON public.manager_seller_assignments (manager_user_id, started_at, seller_user_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manager_assignments_history
  ON public.manager_seller_assignments (seller_user_id, started_at DESC, ended_at);

CREATE TABLE public.manager_settings (
  manager_user_id uuid PRIMARY KEY,
  auto_assign_new_sellers boolean NOT NULL DEFAULT false,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manager_settings TO authenticated;
GRANT ALL ON public.manager_settings TO service_role;
ALTER TABLE public.manager_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads manager settings" ON public.manager_settings
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Manager reads own setting" ON public.manager_settings
  FOR SELECT TO authenticated USING (manager_user_id = auth.uid());
CREATE UNIQUE INDEX uq_manager_single_default
  ON public.manager_settings ((auto_assign_new_sellers))
  WHERE auto_assign_new_sellers = true;

CREATE OR REPLACE FUNCTION app_private.has_active_seller_assignment(_staff uuid, _seller uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_seller_assignments a
    WHERE a.manager_user_id = _staff
      AND a.seller_user_id = _seller
      AND a.ended_at IS NULL
      AND a.started_at <= now()
  )
$$;
REVOKE ALL ON FUNCTION app_private.has_active_seller_assignment(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_active_seller_assignment(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.assignment_started_at(_staff uuid, _seller uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.started_at FROM public.manager_seller_assignments a
  WHERE a.manager_user_id = _staff
    AND a.seller_user_id = _seller
    AND a.ended_at IS NULL
    AND a.started_at <= now()
  ORDER BY a.started_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.assignment_started_at(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.assignment_started_at(uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins manage assignments" ON public.manager_seller_assignments;
DROP POLICY IF EXISTS "Managers see own assignments" ON public.manager_seller_assignments;
CREATE POLICY "Owner reads assignment history" ON public.manager_seller_assignments
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff reads active own assignments" ON public.manager_seller_assignments
  FOR SELECT TO authenticated USING (manager_user_id = auth.uid() AND ended_at IS NULL AND started_at <= now());

CREATE OR REPLACE FUNCTION app_private.transfer_seller_manager(
  _seller uuid,
  _new_manager uuid,
  _reason text,
  _started_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  _admin uuid := app_private.assert_admin();
  _current public.manager_seller_assignments%ROWTYPE;
  _new_id uuid;
  _at timestamptz := COALESCE(_started_at, now());
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF _seller IS NULL OR _new_manager IS NULL THEN RAISE EXCEPTION 'seller and manager required'; END IF;
  IF _at > now() + interval '1 minute' THEN RAISE EXCEPTION 'future assignment not allowed'; END IF;
  IF length(btrim(COALESCE(_reason,''))) < 5 THEN RAISE EXCEPTION 'reason required'; END IF;
  IF NOT public.has_role(_new_manager, 'manager') THEN RAISE EXCEPTION 'target is not an active manager'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _seller)
     OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _seller AND r.role IN ('admin','employee','manager','partner'))
  THEN RAISE EXCEPTION 'invalid seller'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_seller::text));
  SELECT * INTO _current FROM public.manager_seller_assignments
  WHERE seller_user_id = _seller AND ended_at IS NULL
  ORDER BY started_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND AND _current.manager_user_id = _new_manager THEN
    RETURN _current.id;
  END IF;

  IF FOUND THEN
    UPDATE public.manager_seller_assignments
       SET ended_at = _at, ended_by = _admin, end_reason = left(btrim(_reason), 1000)
     WHERE id = _current.id;
  END IF;

  INSERT INTO public.manager_seller_assignments
    (manager_user_id, seller_user_id, assigned_by, started_at, notes)
  VALUES (_new_manager, _seller, _admin, _at, left(btrim(_reason), 1000))
  RETURNING id INTO _new_id;

  PERFORM app_private.admin_audit(_admin, 'seller_manager_transferred', 'manager_assignment', _new_id::text,
    jsonb_build_object('seller_user_id', _seller, 'previous_manager_user_id', _current.manager_user_id,
      'manager_user_id', _new_manager, 'started_at', _at, 'reason', left(btrim(_reason),1000)));
  RETURN _new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.transfer_seller_manager(_seller uuid,_new_manager uuid,_reason text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private
AS $$ SELECT app_private.transfer_seller_manager($1,$2,$3,now()) $$;
REVOKE ALL ON FUNCTION public.transfer_seller_manager(uuid,uuid,text), app_private.transfer_seller_manager(uuid,uuid,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_seller_manager(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.remove_seller_manager(_seller uuid,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_private
AS $$
DECLARE _admin uuid := app_private.assert_admin(); _old public.manager_seller_assignments%ROWTYPE;
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF length(btrim(COALESCE(_reason,''))) < 5 THEN RAISE EXCEPTION 'reason required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_seller::text));
  SELECT * INTO _old FROM public.manager_seller_assignments
  WHERE seller_user_id=_seller AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active assignment not found'; END IF;
  UPDATE public.manager_seller_assignments SET ended_at=now(), ended_by=_admin, end_reason=left(btrim(_reason),1000) WHERE id=_old.id;
  PERFORM app_private.admin_audit(_admin,'seller_manager_removed','manager_assignment',_old.id::text,
    jsonb_build_object('seller_user_id',_seller,'manager_user_id',_old.manager_user_id,'reason',left(btrim(_reason),1000)));
END
$$;
CREATE OR REPLACE FUNCTION public.remove_seller_manager(_seller uuid,_reason text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private
AS $$ SELECT app_private.remove_seller_manager($1,$2) $$;
REVOKE ALL ON FUNCTION public.remove_seller_manager(uuid,text),app_private.remove_seller_manager(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_seller_manager(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.set_default_manager(_manager uuid,_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _admin uuid:=app_private.assert_admin();
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF NOT public.has_role(_manager,'manager') THEN RAISE EXCEPTION 'target is not manager'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('manager-default'));
  IF _enabled THEN UPDATE public.manager_settings SET auto_assign_new_sellers=false,updated_by=_admin,updated_at=now() WHERE auto_assign_new_sellers; END IF;
  INSERT INTO public.manager_settings(manager_user_id,auto_assign_new_sellers,updated_by)
  VALUES(_manager,_enabled,_admin)
  ON CONFLICT(manager_user_id) DO UPDATE SET auto_assign_new_sellers=EXCLUDED.auto_assign_new_sellers,updated_by=_admin,updated_at=now();
  PERFORM app_private.admin_audit(_admin,'manager_default_changed','manager',_manager::text,jsonb_build_object('enabled',_enabled));
END
$$;
CREATE OR REPLACE FUNCTION public.set_default_manager(_manager uuid,_enabled boolean)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.set_default_manager($1,$2) $$;
REVOKE ALL ON FUNCTION public.set_default_manager(uuid,boolean),app_private.set_default_manager(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_default_manager(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.admin_approve_seller_with_manager(_seller uuid,_manager uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _admin uuid:=app_private.assert_admin(); _chosen uuid:=_manager; _approved_at timestamptz:=now();
BEGIN
  PERFORM app_private.assert_recent_auth();
  PERFORM pg_advisory_xact_lock(hashtext(_seller::text));
  PERFORM 1 FROM public.profiles WHERE user_id=_seller FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'seller not found'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_seller AND role IN ('admin','employee','manager','partner')) THEN RAISE EXCEPTION 'target is not seller'; END IF;
  IF _chosen IS NULL THEN SELECT manager_user_id INTO _chosen FROM public.manager_settings WHERE auto_assign_new_sellers=true LIMIT 1; END IF;
  UPDATE public.profiles SET account_status='approved',kyc_rejection_reason=NULL,approved_by=_admin,updated_at=_approved_at WHERE user_id=_seller;
  IF _chosen IS NOT NULL THEN PERFORM app_private.transfer_seller_manager(_seller,_chosen,'Vínculo definido na aprovação da conta',_approved_at); END IF;
  INSERT INTO public.notifications(user_id,title,message,type,created_by)
  VALUES(_seller,'KYC aprovado','Seu cadastro foi aprovado. Você já pode operar normalmente na plataforma.','success',_admin);
  PERFORM app_private.admin_audit(_admin,'approve_kyc_with_manager','profile',_seller::text,jsonb_build_object('manager_user_id',_chosen,'approved_at',_approved_at));
END
$$;
CREATE OR REPLACE FUNCTION public.admin_approve_seller_with_manager(_seller uuid,_manager uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private
AS $$ SELECT app_private.admin_approve_seller_with_manager($1,$2) $$;
REVOKE ALL ON FUNCTION public.admin_approve_seller_with_manager(uuid,uuid),app_private.admin_approve_seller_with_manager(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_seller_with_manager(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.assign_staff_seller(_staff uuid,_seller uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private
AS $$ BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF NOT public.has_role(_staff,'manager') THEN RAISE EXCEPTION 'manager required'; END IF;
  PERFORM app_private.transfer_seller_manager(_seller,_staff,'Vínculo definido pelo dono',now());
END $$;

DROP POLICY IF EXISTS "Managers view assigned seller profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers update assigned seller profiles" ON public.profiles;
CREATE POLICY "Assigned staff view active seller profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_staff_permission(auth.uid(),'sellers.view')
    AND app_private.has_active_seller_assignment(auth.uid(),profiles.user_id)
  );

DROP POLICY IF EXISTS "Managers can view assigned seller transactions" ON public.transactions;
DROP POLICY IF EXISTS "Managers view assigned transactions" ON public.transactions;
DROP POLICY IF EXISTS "Employees can view all transactions" ON public.transactions;
CREATE POLICY "Assigned staff view scoped transactions" ON public.transactions
  FOR SELECT TO authenticated USING (
    public.has_staff_permission(auth.uid(),'transactions.view')
    AND app_private.has_active_seller_assignment(auth.uid(),transactions.user_id)
    AND transactions.created_at >= app_private.assignment_started_at(auth.uid(),transactions.user_id)
  );

DROP POLICY IF EXISTS "Managers read assigned seller notes" ON public.seller_notes;
DROP POLICY IF EXISTS "Managers insert notes for assigned sellers" ON public.seller_notes;
CREATE POLICY "Assigned staff read scoped seller notes" ON public.seller_notes
  FOR SELECT TO authenticated USING (
    public.has_staff_permission(auth.uid(),'seller.notes')
    AND app_private.has_active_seller_assignment(auth.uid(),seller_notes.seller_user_id)
    AND seller_notes.created_at >= app_private.assignment_started_at(auth.uid(),seller_notes.seller_user_id)
  );
CREATE POLICY "Assigned staff add scoped seller notes" ON public.seller_notes
  FOR INSERT TO authenticated WITH CHECK (
    public.has_staff_permission(auth.uid(),'seller.notes')
    AND author_user_id=auth.uid()
    AND app_private.has_active_seller_assignment(auth.uid(),seller_notes.seller_user_id)
  );

DROP POLICY IF EXISTS "Assigned staff read fees" ON public.custom_user_fees;
DROP POLICY IF EXISTS "Assigned staff insert fees" ON public.custom_user_fees;
DROP POLICY IF EXISTS "Assigned staff update fees" ON public.custom_user_fees;
CREATE POLICY "Assigned staff read fees" ON public.custom_user_fees FOR SELECT TO authenticated
USING(public.has_staff_permission(auth.uid(),'fees.edit') AND app_private.has_active_seller_assignment(auth.uid(),custom_user_fees.user_id));
CREATE POLICY "Assigned staff insert fees" ON public.custom_user_fees FOR INSERT TO authenticated
WITH CHECK(public.has_staff_permission(auth.uid(),'fees.edit') AND app_private.has_active_seller_assignment(auth.uid(),custom_user_fees.user_id));
CREATE POLICY "Assigned staff update fees" ON public.custom_user_fees FOR UPDATE TO authenticated
USING(public.has_staff_permission(auth.uid(),'fees.edit') AND app_private.has_active_seller_assignment(auth.uid(),custom_user_fees.user_id))
WITH CHECK(public.has_staff_permission(auth.uid(),'fees.edit') AND app_private.has_active_seller_assignment(auth.uid(),custom_user_fees.user_id));

CREATE POLICY "Assigned staff view scoped withdrawals" ON public.withdrawals FOR SELECT TO authenticated
USING(public.has_staff_permission(auth.uid(),'withdrawals.view') AND app_private.has_active_seller_assignment(auth.uid(),withdrawals.user_id) AND withdrawals.created_at >= app_private.assignment_started_at(auth.uid(),withdrawals.user_id));
CREATE POLICY "Assigned staff view scoped disputes" ON public.disputes FOR SELECT TO authenticated
USING(public.has_staff_permission(auth.uid(),'disputes.view') AND app_private.has_active_seller_assignment(auth.uid(),disputes.seller_user_id) AND disputes.created_at >= app_private.assignment_started_at(auth.uid(),disputes.seller_user_id));
CREATE POLICY "Assigned staff view scoped refunds" ON public.refund_requests FOR SELECT TO authenticated
USING(public.has_staff_permission(auth.uid(),'refunds.request') AND app_private.has_active_seller_assignment(auth.uid(),refund_requests.seller_user_id) AND refund_requests.created_at >= app_private.assignment_started_at(auth.uid(),refund_requests.seller_user_id));

CREATE OR REPLACE FUNCTION public.resolve_commission_staff(_seller uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT a.manager_user_id FROM public.manager_seller_assignments a
  WHERE a.seller_user_id=_seller AND a.ended_at IS NULL AND a.started_at<=now()
    AND public.has_role(a.manager_user_id,'manager')
  ORDER BY a.started_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.apply_staff_commission_on_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _staff uuid; _pct numeric; _amount numeric; _bal numeric; _idem text; _type text; _original public.staff_commissions_ledger%ROWTYPE;
BEGIN
  IF COALESCE(NEW.is_simulated,false) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status='completed' AND (OLD.status IS NULL OR OLD.status<>'completed') THEN
    _staff:=public.resolve_commission_staff(NEW.user_id); IF _staff IS NULL THEN RETURN NEW; END IF;
    _pct:=public.resolve_commission_pct(_staff,NEW.user_id); IF COALESCE(_pct,0)<=0 THEN RETURN NEW; END IF;
    _type:='accrual'; _idem:='comm_accrual_'||NEW.id||'_'||_staff; _amount:=round((NEW.net_amount*_pct/100)::numeric,2);
  ELSIF NEW.status IN ('refunded','chargeback') AND OLD.status='completed' THEN
    SELECT * INTO _original FROM public.staff_commissions_ledger
    WHERE transaction_id=NEW.id AND type='accrual' ORDER BY created_at ASC LIMIT 1;
    IF NOT FOUND THEN RETURN NEW; END IF;
    _staff:=_original.staff_user_id; _pct:=_original.pct;
    _type:=CASE WHEN NEW.status='refunded' THEN 'clawback_refund' ELSE 'clawback_chargeback' END;
    _idem:=CASE WHEN NEW.status='refunded' THEN 'comm_refund_' ELSE 'comm_cb_' END||NEW.id||'_'||_staff;
    _amount:=-abs(_original.amount);
  ELSE RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.staff_commissions_ledger WHERE idempotency_key=_idem) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_staff::text)); _bal:=public.get_staff_commission_balance(_staff);
  INSERT INTO public.staff_commissions_ledger(staff_user_id,seller_user_id,transaction_id,type,base_amount,pct,amount,balance_after,description,idempotency_key)
  VALUES(_staff,NEW.user_id,NEW.id,_type,CASE WHEN _type='accrual' THEN NEW.net_amount ELSE _original.base_amount END,_pct,_amount,_bal+_amount,
    CASE _type WHEN 'accrual' THEN 'Comissão de venda aprovada' WHEN 'clawback_refund' THEN 'Estorno: comissão original revertida' ELSE 'Chargeback: comissão original revertida' END,_idem);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.apply_staff_commission_on_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _original public.staff_commissions_ledger%ROWTYPE; _bal numeric; _idem text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status<>'resolved_buyer' OR COALESCE(NEW.type,'') NOT IN ('medpix','pre_med_pix','refund','chargeback') THEN RETURN NEW; END IF;
  SELECT * INTO _original FROM public.staff_commissions_ledger WHERE transaction_id=NEW.transaction_id AND type='accrual' ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  _idem:='comm_dispute_'||NEW.id||'_'||_original.staff_user_id;
  IF EXISTS(SELECT 1 FROM public.staff_commissions_ledger WHERE idempotency_key=_idem) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_original.staff_user_id::text)); _bal:=public.get_staff_commission_balance(_original.staff_user_id);
  INSERT INTO public.staff_commissions_ledger(staff_user_id,seller_user_id,transaction_id,dispute_id,type,base_amount,pct,amount,balance_after,description,idempotency_key)
  VALUES(_original.staff_user_id,_original.seller_user_id,NEW.transaction_id,NEW.id,'clawback_med',_original.base_amount,_original.pct,-abs(_original.amount),_bal-abs(_original.amount),'Disputa resolvida: comissão original revertida',_idem);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app_private.get_staff_portfolio_dashboard(_from timestamptz,_to timestamptz,_page integer DEFAULT 1,_search text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _uid uuid:=auth.uid(); _p integer:=greatest(COALESCE(_page,1),1); _q text:=left(btrim(COALESCE(_search,'')),100); _result jsonb;
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid,'manager') OR public.has_role(_uid,'employee')) THEN RAISE EXCEPTION 'access denied'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from>=_to OR _to-_from>interval '366 days' THEN RAISE EXCEPTION 'invalid period'; END IF;
  WITH active AS (
    SELECT a.seller_user_id,a.started_at,p.full_name,p.email,p.account_status,p.seller_type
    FROM public.manager_seller_assignments a JOIN public.profiles p ON p.user_id=a.seller_user_id
    WHERE a.manager_user_id=_uid AND a.ended_at IS NULL AND a.started_at<=now()
      AND (_q='' OR p.full_name ILIKE '%'||_q||'%' OR p.email ILIKE '%'||_q||'%' OR p.user_id::text=_q)
  ), scoped_tx AS (
    SELECT t.* FROM public.transactions t JOIN active a ON a.seller_user_id=t.user_id
    WHERE t.created_at>=greatest(_from,a.started_at) AND t.created_at<_to AND NOT COALESCE(t.is_simulated,false)
  ), scoped_disputes AS (
    SELECT d.* FROM public.disputes d JOIN active a ON a.seller_user_id=d.seller_user_id
    WHERE d.created_at>=greatest(_from,a.started_at) AND d.created_at<_to
  ), scoped_refunds AS (
    SELECT r.* FROM public.refund_requests r JOIN active a ON a.seller_user_id=r.seller_user_id
    WHERE r.created_at>=greatest(_from,a.started_at) AND r.created_at<_to
  ), seller_stats AS (
    SELECT a.seller_user_id,a.started_at,a.full_name,a.email,a.account_status,a.seller_type,
      count(t.id) filter(where t.status in ('completed','paid','approved'))::int sales_count,
      COALESCE(sum(t.amount) filter(where t.status in ('completed','paid','approved')),0) volume,
      COALESCE(sum(t.net_amount) filter(where t.status in ('completed','paid','approved')),0) net_volume
    FROM active a LEFT JOIN scoped_tx t ON t.user_id=a.seller_user_id GROUP BY a.seller_user_id,a.started_at,a.full_name,a.email,a.account_status,a.seller_type
  ), paged AS (
    SELECT * FROM seller_stats ORDER BY volume DESC,seller_user_id LIMIT 25 OFFSET ((_p-1)*25)
  ), perms AS (
    SELECT COALESCE(jsonb_agg(permission_key ORDER BY permission_key),'[]'::jsonb) value FROM public.staff_permissions WHERE user_id=_uid
  )
  SELECT jsonb_build_object(
    'period',jsonb_build_object('from',_from,'to',_to),
    'metrics',jsonb_build_object(
      'seller_count',(SELECT count(*) FROM active),
      'sales_count',(SELECT count(*) FROM scoped_tx WHERE status IN ('completed','paid','approved')),
      'volume',(SELECT COALESCE(sum(amount),0) FROM scoped_tx WHERE status IN ('completed','paid','approved')),
      'ticket_average',(SELECT COALESCE(avg(amount),0) FROM scoped_tx WHERE status IN ('completed','paid','approved')),
      'refunds',(SELECT count(*) FROM scoped_refunds),
      'chargebacks',(SELECT count(*) FROM scoped_disputes WHERE type='chargeback'),
      'medpix',(SELECT count(*) FROM scoped_disputes WHERE type IN ('medpix','pre_med_pix')),
      'commission_generated',(SELECT COALESCE(sum(l.amount),0) FROM public.staff_commissions_ledger l WHERE l.staff_user_id=_uid AND l.created_at>=_from AND l.created_at<_to AND l.type='accrual'),
      'commission_reversed',(SELECT COALESCE(abs(sum(l.amount)),0) FROM public.staff_commissions_ledger l WHERE l.staff_user_id=_uid AND l.created_at>=_from AND l.created_at<_to AND l.type LIKE 'clawback%'),
      'commission_balance',public.get_staff_commission_balance(_uid)
    ),
    'permissions',(SELECT value FROM perms),
    'sellers',(SELECT COALESCE(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) FROM paged),
    'total_sellers',(SELECT count(*) FROM seller_stats),
    'page',_p,
    'page_size',25
  ) INTO _result;
  RETURN _result;
END $$;
CREATE OR REPLACE FUNCTION public.get_staff_portfolio_dashboard(_from timestamptz,_to timestamptz,_page integer DEFAULT 1,_search text DEFAULT '')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private
AS $$ SELECT app_private.get_staff_portfolio_dashboard($1,$2,$3,$4) $$;
REVOKE ALL ON FUNCTION public.get_staff_portfolio_dashboard(timestamptz,timestamptz,integer,text),app_private.get_staff_portfolio_dashboard(timestamptz,timestamptz,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_portfolio_dashboard(timestamptz,timestamptz,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.get_staff_portfolio_transactions(_from timestamptz,_to timestamptz,_page integer DEFAULT 1,_search text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _uid uuid:=auth.uid(); _p integer:=greatest(COALESCE(_page,1),1); _q text:=left(btrim(COALESCE(_search,'')),100); _result jsonb;
BEGIN
 IF _uid IS NULL OR NOT public.has_staff_permission(_uid,'transactions.view') THEN RAISE EXCEPTION 'permission required'; END IF;
 IF _from IS NULL OR _to IS NULL OR _from>=_to OR _to-_from>interval '366 days' THEN RAISE EXCEPTION 'invalid period'; END IF;
 WITH scoped AS (
  SELECT t.id,t.user_id,t.amount,t.net_amount,t.status,t.payment_method,t.customer_name,t.created_at,p.full_name seller_name,p.email seller_email
  FROM public.manager_seller_assignments a JOIN public.transactions t ON t.user_id=a.seller_user_id JOIN public.profiles p ON p.user_id=t.user_id
  WHERE a.manager_user_id=_uid AND a.ended_at IS NULL AND t.created_at>=greatest(_from,a.started_at) AND t.created_at<_to AND NOT COALESCE(t.is_simulated,false)
    AND (_q='' OR p.full_name ILIKE '%'||_q||'%' OR p.email ILIKE '%'||_q||'%' OR t.id::text=_q)
 ), paged AS (SELECT * FROM scoped ORDER BY created_at DESC,id LIMIT 25 OFFSET ((_p-1)*25))
 SELECT jsonb_build_object('rows',(SELECT COALESCE(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) FROM paged),'total',(SELECT count(*) FROM scoped),'page',_p,'page_size',25) INTO _result;
 RETURN _result;
END $$;
CREATE OR REPLACE FUNCTION public.get_staff_portfolio_transactions(_from timestamptz,_to timestamptz,_page integer DEFAULT 1,_search text DEFAULT '')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.get_staff_portfolio_transactions($1,$2,$3,$4) $$;
REVOKE ALL ON FUNCTION public.get_staff_portfolio_transactions(timestamptz,timestamptz,integer,text),app_private.get_staff_portfolio_transactions(timestamptz,timestamptz,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_portfolio_transactions(timestamptz,timestamptz,integer,text) TO authenticated;