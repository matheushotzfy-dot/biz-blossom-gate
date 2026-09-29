
CREATE TABLE public.financial_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL,
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  reason text,
  amount numeric NOT NULL DEFAULT 0,
  balance_before numeric,
  balance_after numeric,
  ledger_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fal_seller_date ON public.financial_action_log(seller_user_id, created_at DESC);
CREATE INDEX idx_fal_date ON public.financial_action_log(created_at DESC);
GRANT SELECT ON public.financial_action_log TO authenticated;
GRANT ALL ON public.financial_action_log TO service_role;
ALTER TABLE public.financial_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read financial action log" ON public.financial_action_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.financial_role_permissions (
  role app_role NOT NULL,
  permission text NOT NULL CHECK (permission IN ('balance_adjust_request','dispute_review')),
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (role, permission)
);
GRANT SELECT, INSERT, UPDATE ON public.financial_role_permissions TO authenticated;
GRANT ALL ON public.financial_role_permissions TO service_role;
ALTER TABLE public.financial_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read financial permissions" ON public.financial_role_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "Admins insert financial permissions" ON public.financial_role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND role <> 'admin');
CREATE POLICY "Admins update financial permissions" ON public.financial_role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin') AND role <> 'admin');
INSERT INTO public.financial_role_permissions(role, permission, allowed) VALUES
  ('manager','balance_adjust_request',true),('manager','dispute_review',true),
  ('employee','balance_adjust_request',false),('employee','dispute_review',false);

CREATE OR REPLACE FUNCTION app_private.actor_role(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _uid IS NULL THEN 'sistema'
    WHEN public.has_role(_uid,'admin') THEN 'admin'
    WHEN public.has_role(_uid,'manager') THEN 'manager'
    WHEN public.has_role(_uid,'employee') THEN 'employee' ELSE 'seller' END
$$;

CREATE OR REPLACE FUNCTION app_private.has_financial_permission(_uid uuid, _perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR EXISTS (
    SELECT 1 FROM public.financial_role_permissions p JOIN public.user_roles r ON r.role = p.role
    WHERE r.user_id = _uid AND p.permission = _perm AND p.allowed)
$$;

-- Reinforced confirmation: caller must have signed in with password in the last 10 minutes
CREATE OR REPLACE FUNCTION app_private.assert_recent_auth() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ts bigint;
BEGIN
  SELECT max((e->>'timestamp')::bigint) INTO _ts FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr','[]'::jsonb)) e;
  IF _ts IS NULL OR _ts < extract(epoch FROM now())::bigint - 600 THEN
    RAISE EXCEPTION 'reautenticação necessária: confirme sua senha';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION app_private.assert_recent_auth(), app_private.has_financial_permission(uuid,text), app_private.actor_role(uuid) TO authenticated;

-- Automatic log for every sensitive ledger movement
CREATE OR REPLACE FUNCTION app_private.log_ledger_action() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reason text; _action text; _entity text; _eid uuid; _key text := COALESCE(NEW.idempotency_key,'');
BEGIN
  IF NEW.entry_type IN ('adjustment_credit','adjustment_debit') THEN
    _action := CASE WHEN NEW.entry_type='adjustment_credit' THEN 'ajuste_credito' ELSE 'ajuste_debito' END;
    _entity := 'balance_adjustment'; _eid := NEW.adjustment_id;
    SELECT reason INTO _reason FROM public.balance_adjustments WHERE id = NEW.adjustment_id;
  ELSIF NEW.entry_type = 'refund' THEN
    _action := 'reembolso'; _entity := 'transaction'; _eid := NEW.transaction_id;
    SELECT metadata->>'last_refund_reason' INTO _reason FROM public.transactions WHERE id = NEW.transaction_id;
  ELSIF NEW.entry_type = 'chargeback' THEN
    _action := 'chargeback'; _entity := 'transaction'; _eid := NEW.transaction_id;
  ELSIF NEW.entry_type IN ('dispute_hold','dispute_release') OR _key LIKE 'dispute_fee_%' THEN
    _action := CASE WHEN NEW.entry_type='dispute_hold' THEN 'disputa_bloqueio' WHEN NEW.entry_type='dispute_release' THEN 'disputa_liberacao' ELSE 'disputa_taxa' END;
    _entity := 'dispute';
    BEGIN _eid := regexp_replace(_key, '^dispute_(open|release|fee)_', '')::uuid; EXCEPTION WHEN others THEN _eid := NULL; END;
    SELECT COALESCE(admin_notes, reason) INTO _reason FROM public.disputes WHERE id = _eid;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.financial_action_log(seller_user_id, actor_id, actor_role, action, entity_type, entity_id, reason, amount, balance_before, balance_after, ledger_id)
  VALUES (NEW.user_id, auth.uid(), app_private.actor_role(auth.uid()), _action, _entity, _eid, left(_reason,1000), NEW.amount,
          NEW.balance_after - public.ledger_entry_effect(NEW.entry_type, NEW.amount), NEW.balance_after, NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_ledger_action AFTER INSERT ON public.financial_ledger FOR EACH ROW EXECUTE FUNCTION app_private.log_ledger_action();

-- Dispute decisions that don't move money still get logged
CREATE OR REPLACE FUNCTION app_private.log_dispute_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal numeric;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  _bal := public.calculate_ledger_balance(NEW.seller_user_id);
  INSERT INTO public.financial_action_log(seller_user_id, actor_id, actor_role, action, entity_type, entity_id, reason, amount, balance_before, balance_after)
  VALUES (NEW.seller_user_id, auth.uid(), app_private.actor_role(auth.uid()),
    CASE NEW.status WHEN 'in_review' THEN 'disputa_em_analise' WHEN 'resolved_seller' THEN 'disputa_ganha' WHEN 'resolved_buyer' THEN 'disputa_perdida' ELSE 'disputa_'||NEW.status END,
    'dispute', NEW.id, left(COALESCE(NEW.admin_notes, NEW.reason),1000), NEW.amount, _bal, _bal);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_dispute_status AFTER UPDATE OF status ON public.disputes FOR EACH ROW EXECUTE FUNCTION app_private.log_dispute_status();

-- Permission-aware request + review
CREATE OR REPLACE FUNCTION app_private.admin_request_balance_adjustment(_user_id uuid, _type text, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _adj uuid; _req uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _type NOT IN ('credit','debit') OR _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'valores inválidos'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'motivo obrigatório (mín. 5 caracteres)'; END IF;
  IF public.has_role(_uid,'admin') THEN
    PERFORM app_private.assert_recent_auth();
    INSERT INTO public.balance_adjustments(user_id, admin_user_id, amount, type, reason)
    VALUES (_user_id,_uid,ROUND(_amount,2),_type,left(btrim(_reason),1000)) RETURNING id INTO _adj;
    PERFORM app_private.admin_audit(_uid,'balance_adjustment','profile',_user_id::text, jsonb_build_object('adjustment_id',_adj,'type',_type,'amount',_amount));
    RETURN jsonb_build_object('status','applied','adjustment_id',_adj);
  ELSIF app_private.has_financial_permission(_uid,'balance_adjust_request') THEN
    INSERT INTO public.balance_adjustment_requests(user_id,type,amount,reason,requested_by)
    VALUES (_user_id,_type,ROUND(_amount,2),left(btrim(_reason),1000),_uid) RETURNING id INTO _req;
    PERFORM app_private.admin_audit(_uid,'balance_adjustment_requested','profile',_user_id::text, jsonb_build_object('request_id',_req,'type',_type,'amount',_amount));
    RETURN jsonb_build_object('status','pending_approval','request_id',_req);
  END IF;
  RAISE EXCEPTION 'sem permissão para solicitar ajuste de saldo';
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_set_dispute_review(_dispute_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT app_private.has_financial_permission(_uid,'dispute_review') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.disputes SET status='in_review' WHERE id=_dispute_id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não está aberta'; END IF;
  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note) VALUES (_dispute_id,_uid,'in_review',_note);
END $$;

-- Reinforced wrappers for owner-only sensitive actions
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_dispute_id uuid, _outcome text, _fee numeric DEFAULT 0, _note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path = public, app_private AS $$
BEGIN PERFORM app_private.assert_recent_auth(); PERFORM app_private.admin_resolve_dispute(_dispute_id,_outcome,_fee,_note); END $$;
CREATE OR REPLACE FUNCTION public.admin_refund_transaction(_transaction_id uuid, _amount numeric, _reason text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, app_private AS $$
BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_refund_transaction(_transaction_id,_amount,_reason); END $$;
CREATE OR REPLACE FUNCTION public.admin_decide_balance_adjustment(_request_id uuid, _approve boolean) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, app_private AS $$
BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_decide_balance_adjustment(_request_id,_approve); END $$;

-- History query with filters
CREATE OR REPLACE FUNCTION app_private.get_financial_action_history(_seller uuid DEFAULT NULL, _from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL, _action text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _rows jsonb; _total bigint;
BEGIN
  SELECT count(*) INTO _total FROM public.financial_action_log l
   WHERE (_seller IS NULL OR l.seller_user_id=_seller) AND (_from IS NULL OR l.created_at>=_from) AND (_to IS NULL OR l.created_at<_to)
     AND (_action IS NULL OR l.action LIKE _action||'%');
  SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at DESC),'[]') INTO _rows FROM (
    SELECT l.*, sp.full_name AS seller_name, sp.email AS seller_email, ap.full_name AS actor_name, ap.email AS actor_email
    FROM public.financial_action_log l
    LEFT JOIN public.profiles sp ON sp.user_id=l.seller_user_id
    LEFT JOIN public.profiles ap ON ap.user_id=l.actor_id
    WHERE (_seller IS NULL OR l.seller_user_id=_seller) AND (_from IS NULL OR l.created_at>=_from) AND (_to IS NULL OR l.created_at<_to)
      AND (_action IS NULL OR l.action LIKE _action||'%')
    ORDER BY l.created_at DESC LIMIT LEAST(GREATEST(COALESCE(_limit,50),1),200) OFFSET GREATEST(COALESCE(_offset,0),0)) r;
  RETURN jsonb_build_object('total',_total,'rows',_rows);
END $$;
GRANT EXECUTE ON FUNCTION app_private.get_financial_action_history(uuid,timestamptz,timestamptz,text,int,int) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_financial_action_history(_seller uuid DEFAULT NULL, _from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL, _action text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, app_private AS $$ SELECT app_private.get_financial_action_history($1,$2,$3,$4,$5,$6) $$;
REVOKE ALL ON FUNCTION public.get_financial_action_history(uuid,timestamptz,timestamptz,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_action_history(uuid,timestamptz,timestamptz,text,int,int) TO authenticated;
