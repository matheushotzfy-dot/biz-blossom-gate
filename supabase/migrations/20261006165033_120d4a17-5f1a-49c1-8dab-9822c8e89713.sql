CREATE OR REPLACE FUNCTION app_private.set_staff_seller_fees(_seller uuid, _percentage numeric, _fixed numeric, _withdrawal numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _uid uuid:=auth.uid(); _before jsonb; _limits public.staff_fee_limits;
BEGIN
 IF _uid IS NULL OR NOT public.has_staff_permission(_uid,'fees.edit')
    OR (NOT public.has_role(_uid,'admin') AND NOT app_private.has_active_seller_assignment(_uid,_seller))
 THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF _percentage IS NULL OR _fixed IS NULL OR _withdrawal IS NULL OR _percentage NOT BETWEEN 0 AND 100 OR _fixed NOT BETWEEN 0 AND 1000000 OR _withdrawal NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'Invalid fees'; END IF;
 IF NOT public.has_role(_uid,'admin') THEN
   SELECT * INTO _limits FROM public.staff_fee_limits WHERE user_id=_uid;
   IF NOT FOUND OR _percentage<_limits.min_transaction_percentage OR _fixed<_limits.min_transaction_fixed OR _withdrawal<_limits.min_withdrawal_fee THEN RAISE EXCEPTION 'Fee below owner minimum'; END IF;
 END IF;
 PERFORM 1 FROM public.profiles WHERE user_id=_seller FOR UPDATE;
 SELECT to_jsonb(f) INTO _before FROM public.custom_user_fees f WHERE user_id=_seller;
 INSERT INTO public.custom_user_fees(user_id,transaction_percentage,transaction_fixed,withdrawal_fee,admin_user_id)
 VALUES(_seller,_percentage,_fixed,_withdrawal,_uid)
 ON CONFLICT(user_id) DO UPDATE SET transaction_percentage=_percentage,transaction_fixed=_fixed,withdrawal_fee=_withdrawal,admin_user_id=_uid;
 INSERT INTO public.staff_audit_log(staff_user_id,action,entity_type,entity_id,before,after)
 VALUES(_uid,'set_seller_fees','seller',_seller::text,_before,jsonb_build_object('percentage',_percentage,'fixed',_fixed,'withdrawal',_withdrawal));
END $$;

CREATE OR REPLACE FUNCTION app_private.set_seller_withdrawal_block(_seller uuid, _block boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _uid uuid:=auth.uid(); _admin boolean:=public.has_role(auth.uid(),'admin'); _before jsonb;
BEGIN
 IF _uid IS NULL OR _block IS NULL OR length(trim(coalesce(_reason,''))) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Authorization and reason required'; END IF;
 IF NOT _admin AND (NOT _block OR NOT public.has_staff_permission(_uid,'freeze_seller_withdrawals') OR NOT app_private.has_active_seller_assignment(_uid,_seller)) THEN RAISE EXCEPTION 'Only owner can release; active assigned staff permission required to block'; END IF;
 IF _seller=_uid OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_seller) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_seller AND role IN ('admin','employee','manager','partner')) THEN RAISE EXCEPTION 'Invalid seller'; END IF;
 PERFORM 1 FROM public.profiles WHERE user_id=_seller FOR UPDATE;
 SELECT to_jsonb(b) INTO _before FROM public.seller_withdrawal_blocks b WHERE seller_user_id=_seller;
 INSERT INTO public.seller_withdrawal_blocks(seller_user_id,blocked_by,reason,active) VALUES(_seller,_uid,trim(_reason),_block)
 ON CONFLICT(seller_user_id) DO UPDATE SET active=_block,reason=EXCLUDED.reason,blocked_by=_uid,updated_at=now();
 INSERT INTO public.staff_audit_log(staff_user_id,action,entity_type,entity_id,before,after)
 VALUES(_uid,CASE WHEN _block THEN 'block_seller_withdrawals' ELSE 'release_seller_withdrawals' END,'seller',_seller::text,_before,jsonb_build_object('active',_block,'reason',trim(_reason)));
 INSERT INTO public.notifications(user_id,title,message,type,created_by)
 VALUES(_seller,CASE WHEN _block THEN 'Saques em análise' ELSE 'Saques liberados' END,CASE WHEN _block THEN 'Novos saques estão temporariamente bloqueados para análise. Login, vendas e saldo permanecem inalterados.' ELSE 'O bloqueio de novos saques foi removido pelo responsável.' END,'info',_uid);
END $$;

CREATE OR REPLACE FUNCTION public.enforce_manager_fee_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private
AS $$
DECLARE _limits public.staff_fee_limits; _uid uuid:=auth.uid();
BEGIN
 IF _uid IS NULL OR public.has_role(_uid,'admin') THEN RETURN NEW; END IF;
 IF NOT public.has_staff_permission(_uid,'fees.edit') OR public.has_role(_uid,'partner') THEN RAISE EXCEPTION 'Fee permission required'; END IF;
 IF NOT app_private.has_active_seller_assignment(_uid,NEW.user_id) THEN RAISE EXCEPTION 'Seller not actively assigned'; END IF;
 SELECT * INTO _limits FROM public.staff_fee_limits WHERE user_id=_uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner must configure fee limits'; END IF;
 IF NEW.transaction_percentage IS NULL OR NEW.transaction_fixed IS NULL OR NEW.withdrawal_fee IS NULL OR NEW.transaction_percentage < _limits.min_transaction_percentage OR NEW.transaction_fixed < _limits.min_transaction_fixed OR NEW.withdrawal_fee < _limits.min_withdrawal_fee THEN RAISE EXCEPTION 'Fee below owner-defined minimum'; END IF;
 IF NEW.transaction_percentage>100 OR NEW.transaction_fixed>1000000 OR NEW.withdrawal_fee>1000000 THEN RAISE EXCEPTION 'Invalid fees'; END IF;
 NEW.admin_user_id:=_uid; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
 IF public.has_role(auth.uid(),'admin'::app_role) THEN RETURN NEW; END IF;
 NEW.account_status:=OLD.account_status;
 NEW.staff_role_type:=OLD.staff_role_type;
 NEW.balance_frozen:=OLD.balance_frozen;
 NEW.frozen:=OLD.frozen;
 NEW.approved_by:=OLD.approved_by;
 NEW.credit_card_enabled:=OLD.credit_card_enabled;
 NEW.boleto_enabled:=OLD.boleto_enabled;
 NEW.kyc_rejection_reason:=OLD.kyc_rejection_reason;
 NEW.admin_notes:=OLD.admin_notes;
 NEW.user_id:=OLD.user_id;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.apply_staff_commission_on_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE _staff uuid; _pct numeric; _amount numeric; _bal numeric; _idem text; _type text; _original public.staff_commissions_ledger%ROWTYPE;
BEGIN
 IF COALESCE(NEW.is_simulated,false) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
 IF NEW.status='completed' AND (OLD.status IS NULL OR OLD.status<>'completed') THEN
   _staff:=public.resolve_commission_staff(NEW.user_id); IF _staff IS NULL THEN RETURN NEW; END IF;
   _pct:=public.resolve_commission_pct(_staff,NEW.user_id); IF COALESCE(_pct,0)<=0 THEN RETURN NEW; END IF;
   _type:='accrual'; _idem:='comm_accrual_'||NEW.id||'_'||_staff; _amount:=round((NEW.net_amount*_pct/100)::numeric,2);
 ELSIF NEW.status IN ('refunded','chargeback') THEN
   SELECT * INTO _original FROM public.staff_commissions_ledger WHERE transaction_id=NEW.id AND type='accrual' ORDER BY created_at ASC LIMIT 1;
   IF NOT FOUND OR EXISTS(SELECT 1 FROM public.staff_commissions_ledger WHERE transaction_id=NEW.id AND type LIKE 'clawback%') THEN RETURN NEW; END IF;
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
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE _original public.staff_commissions_ledger%ROWTYPE; _bal numeric; _idem text;
BEGIN
 IF TG_OP<>'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status<>'resolved_buyer' OR COALESCE(NEW.type,'') NOT IN ('medpix','pre_med_pix','refund','chargeback') THEN RETURN NEW; END IF;
 SELECT * INTO _original FROM public.staff_commissions_ledger WHERE transaction_id=NEW.transaction_id AND type='accrual' ORDER BY created_at ASC LIMIT 1;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.staff_commissions_ledger WHERE transaction_id=NEW.transaction_id AND type LIKE 'clawback%') THEN RETURN NEW; END IF;
 _idem:='comm_dispute_'||NEW.id||'_'||_original.staff_user_id;
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
  SELECT a.seller_user_id,a.started_at,p.full_name,p.email,p.account_status,p.seller_type FROM public.manager_seller_assignments a JOIN public.profiles p ON p.user_id=a.seller_user_id
  WHERE a.manager_user_id=_uid AND a.ended_at IS NULL AND a.started_at<=now() AND (_q='' OR p.full_name ILIKE '%'||_q||'%' OR p.email ILIKE '%'||_q||'%' OR p.user_id::text=_q)
 ), scoped_tx AS (
  SELECT t.* FROM public.transactions t JOIN active a ON a.seller_user_id=t.user_id WHERE t.created_at>=greatest(_from,a.started_at) AND t.created_at<_to AND NOT COALESCE(t.is_simulated,false)
 ), scoped_disputes AS (
  SELECT d.* FROM public.disputes d JOIN active a ON a.seller_user_id=d.seller_user_id WHERE d.created_at>=greatest(_from,a.started_at) AND d.created_at<_to
 ), scoped_refunds AS (
  SELECT r.* FROM public.refund_requests r JOIN active a ON a.seller_user_id=r.seller_user_id WHERE r.created_at>=greatest(_from,a.started_at) AND r.created_at<_to
 ), seller_stats AS (
  SELECT a.seller_user_id,a.started_at,a.full_name,a.email,a.account_status,a.seller_type,count(t.id) filter(where t.status='completed')::int sales_count,
   COALESCE(sum(t.amount) filter(where t.status='completed'),0) volume,COALESCE(sum(t.net_amount) filter(where t.status='completed'),0) net_volume
  FROM active a LEFT JOIN scoped_tx t ON t.user_id=a.seller_user_id GROUP BY a.seller_user_id,a.started_at,a.full_name,a.email,a.account_status,a.seller_type
 ), paged AS (SELECT * FROM seller_stats ORDER BY volume DESC,seller_user_id LIMIT 25 OFFSET ((_p-1)*25)),
 perms AS (SELECT COALESCE(jsonb_agg(permission_key ORDER BY permission_key),'[]'::jsonb) value FROM public.staff_permissions WHERE user_id=_uid)
 SELECT jsonb_build_object('period',jsonb_build_object('from',_from,'to',_to),'metrics',jsonb_build_object(
  'seller_count',(SELECT count(*) FROM active),'sales_count',(SELECT count(*) FROM scoped_tx WHERE status='completed'),
  'volume',(SELECT COALESCE(sum(amount),0) FROM scoped_tx WHERE status='completed'),'ticket_average',(SELECT COALESCE(avg(amount),0) FROM scoped_tx WHERE status='completed'),
  'refunds',(SELECT count(*) FROM scoped_refunds),'chargebacks',(SELECT count(*) FROM scoped_disputes WHERE type='chargeback'),
  'medpix',(SELECT count(*) FROM scoped_disputes WHERE type IN ('medpix','pre_med_pix')),
  'commission_generated',(SELECT COALESCE(sum(l.amount),0) FROM public.staff_commissions_ledger l WHERE l.staff_user_id=_uid AND l.created_at>=_from AND l.created_at<_to AND l.type='accrual'),
  'commission_reversed',(SELECT COALESCE(abs(sum(l.amount)),0) FROM public.staff_commissions_ledger l WHERE l.staff_user_id=_uid AND l.created_at>=_from AND l.created_at<_to AND l.type LIKE 'clawback%'),
  'commission_balance',public.get_staff_commission_balance(_uid)),
  'permissions',(SELECT value FROM perms),'sellers',(SELECT COALESCE(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) FROM paged),
  'total_sellers',(SELECT count(*) FROM seller_stats),'page',_p,'page_size',25) INTO _result;
 RETURN _result;
END $$;