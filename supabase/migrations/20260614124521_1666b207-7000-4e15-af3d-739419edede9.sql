
-- ============================================================
-- 1) PROFILES: novas colunas
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_admin uuid,
  ADD COLUMN IF NOT EXISTS staff_role_type text,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- approved_by torna-se imutável uma vez preenchido (extensão do trigger existente)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.account_status := OLD.account_status;
    NEW.seller_type := OLD.seller_type;
    NEW.admin_notes := OLD.admin_notes;
    NEW.acquirer_id := OLD.acquirer_id;
    NEW.last_ip := OLD.last_ip;
    NEW.balance_frozen := OLD.balance_frozen;
    NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
    NEW.frozen := OLD.frozen;
    NEW.staff_role_type := OLD.staff_role_type;
    NEW.created_by_admin := OLD.created_by_admin;
  END IF;

  IF OLD.document_number IS NOT NULL AND OLD.document_number != '' THEN
    NEW.document_number := OLD.document_number;
    NEW.document_type := OLD.document_type;
  END IF;
  IF OLD.full_name IS NOT NULL AND OLD.full_name != '' THEN
    NEW.full_name := OLD.full_name;
  END IF;
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    NEW.email := OLD.email;
  END IF;
  IF OLD.phone IS NOT NULL AND OLD.phone != '' THEN
    NEW.phone := OLD.phone;
  END IF;

  -- approved_by imutável uma vez preenchido
  IF OLD.approved_by IS NOT NULL THEN
    NEW.approved_by := OLD.approved_by;
  END IF;

  RETURN NEW;
END;
$function$;

-- Preenche approved_by automaticamente quando staff/manager aprova o seller
CREATE OR REPLACE FUNCTION public.auto_fill_approved_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_status = 'active'
     AND COALESCE(OLD.account_status, '') <> 'active'
     AND NEW.approved_by IS NULL
     AND auth.uid() IS NOT NULL
  THEN
    IF has_role(auth.uid(), 'employee'::app_role)
       OR has_role(auth.uid(), 'manager'::app_role)
       OR has_role(auth.uid(), 'admin'::app_role)
    THEN
      NEW.approved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fill_approved_by ON public.profiles;
CREATE TRIGGER trg_auto_fill_approved_by
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_approved_by();

-- ============================================================
-- 2) STAFF_PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

GRANT SELECT ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own permissions"
  ON public.staff_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage permissions"
  ON public.staff_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_staff_permissions_user ON public.staff_permissions(user_id);

-- Helper RPC: o usuário tem essa permissão?
CREATE OR REPLACE FUNCTION public.has_staff_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions
      WHERE user_id = _user_id AND permission_key = _key
    );
$$;

-- ============================================================
-- 3) STAFF_AUDIT_LOG (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.staff_audit_log TO authenticated;
GRANT ALL ON public.staff_audit_log TO service_role;

ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit"
  ON public.staff_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read own audit"
  ON public.staff_audit_log FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "System and staff insert audit"
  ON public.staff_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Imutável: bloqueia UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'staff_audit_log é imutável';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_no_update ON public.staff_audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON public.staff_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE INDEX IF NOT EXISTS idx_staff_audit_staff ON public.staff_audit_log(staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_audit_entity ON public.staff_audit_log(entity_type, entity_id);

-- Trigger genérico para gravar alterações em profiles/transactions/withdrawals feitas por staff/manager
CREATE OR REPLACE FUNCTION public.log_staff_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- só registra se for staff ou manager (admin entra também, é útil)
  IF NOT (
    has_role(_actor, 'employee'::app_role)
    OR has_role(_actor, 'manager'::app_role)
    OR has_role(_actor, 'admin'::app_role)
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.staff_audit_log (staff_user_id, action, entity_type, entity_id, before, after)
  VALUES (
    _actor,
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    COALESCE((NEW).id::text, (OLD).id::text),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_staff_profiles ON public.profiles;
CREATE TRIGGER trg_log_staff_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_action();

DROP TRIGGER IF EXISTS trg_log_staff_transactions ON public.transactions;
CREATE TRIGGER trg_log_staff_transactions
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_action();

DROP TRIGGER IF EXISTS trg_log_staff_withdrawals ON public.withdrawals;
CREATE TRIGGER trg_log_staff_withdrawals
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_action();

DROP TRIGGER IF EXISTS trg_log_staff_disputes ON public.disputes;
CREATE TRIGGER trg_log_staff_disputes
  AFTER UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_action();

-- ============================================================
-- 4) STAFF_COMMISSION_CONFIG / OVERRIDES / LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_commission_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_pct numeric NOT NULL DEFAULT 0.10 CHECK (base_pct >= 0 AND base_pct <= 100),
  base text NOT NULL DEFAULT 'net_amount',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.staff_commission_config TO authenticated;
GRANT ALL ON public.staff_commission_config TO service_role;

ALTER TABLE public.staff_commission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own commission config"
  ON public.staff_commission_config FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage commission config"
  ON public.staff_commission_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.staff_commission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pct numeric NOT NULL CHECK (pct >= 0 AND pct <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, seller_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_commission_overrides TO authenticated;
GRANT ALL ON public.staff_commission_overrides TO service_role;

ALTER TABLE public.staff_commission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage overrides"
  ON public.staff_commission_overrides FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read own overrides"
  ON public.staff_commission_overrides FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.staff_commissions_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL,
  seller_user_id uuid,
  transaction_id uuid,
  dispute_id uuid,
  type text NOT NULL CHECK (type IN ('accrual','clawback_refund','clawback_chargeback','clawback_med','payout','adjustment')),
  base_amount numeric NOT NULL DEFAULT 0,
  pct numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.staff_commissions_ledger TO authenticated;
GRANT ALL ON public.staff_commissions_ledger TO service_role;

ALTER TABLE public.staff_commissions_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all commissions"
  ON public.staff_commissions_ledger FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read own commissions"
  ON public.staff_commissions_ledger FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "Admins insert commissions"
  ON public.staff_commissions_ledger FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_commissions_staff ON public.staff_commissions_ledger(staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_tx ON public.staff_commissions_ledger(transaction_id);

-- Helper: saldo de comissão do staff
CREATE OR REPLACE FUNCTION public.get_staff_commission_balance(_staff uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM public.staff_commissions_ledger
     WHERE staff_user_id = _staff
     ORDER BY created_at DESC, id DESC
     LIMIT 1),
    0
  );
$$;

-- Resolve qual staff/manager ganha a comissão de uma venda
-- Preferência: manager_seller_assignments → profiles.approved_by (se for staff/manager)
CREATE OR REPLACE FUNCTION public.resolve_commission_staff(_seller uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff uuid;
  _approver uuid;
BEGIN
  SELECT manager_user_id INTO _staff
  FROM public.manager_seller_assignments
  WHERE seller_user_id = _seller
  ORDER BY created_at DESC
  LIMIT 1;

  IF _staff IS NOT NULL THEN RETURN _staff; END IF;

  SELECT approved_by INTO _approver
  FROM public.profiles
  WHERE user_id = _seller
  LIMIT 1;

  IF _approver IS NULL THEN RETURN NULL; END IF;

  -- só conta se o approver for staff/manager (não admin)
  IF has_role(_approver, 'employee'::app_role)
     OR has_role(_approver, 'manager'::app_role) THEN
    RETURN _approver;
  END IF;

  RETURN NULL;
END;
$$;

-- Resolve a % efetiva (override ou padrão)
CREATE OR REPLACE FUNCTION public.resolve_commission_pct(_staff uuid, _seller uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pct FROM public.staff_commission_overrides
       WHERE staff_user_id = _staff AND seller_user_id = _seller LIMIT 1),
    (SELECT base_pct FROM public.staff_commission_config
       WHERE user_id = _staff AND is_active = true LIMIT 1),
    0
  );
$$;

-- Trigger principal: aplica accrual / clawback ao mudar status da transação
CREATE OR REPLACE FUNCTION public.apply_staff_commission_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff uuid;
  _pct numeric;
  _amount numeric;
  _bal numeric;
  _idem text;
  _type text;
BEGIN
  IF COALESCE(NEW.is_simulated, false) = true THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  _staff := public.resolve_commission_staff(NEW.user_id);
  IF _staff IS NULL THEN RETURN NEW; END IF;

  _pct := public.resolve_commission_pct(_staff, NEW.user_id);
  IF COALESCE(_pct, 0) <= 0 THEN RETURN NEW; END IF;

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    _type := 'accrual';
    _idem := 'comm_accrual_' || NEW.id || '_' || _staff;
    _amount := ROUND((NEW.net_amount * _pct / 100)::numeric, 2);
  ELSIF NEW.status = 'refunded' AND OLD.status = 'completed' THEN
    _type := 'clawback_refund';
    _idem := 'comm_refund_' || NEW.id || '_' || _staff;
    _amount := -ROUND((NEW.net_amount * _pct / 100)::numeric, 2);
  ELSIF NEW.status = 'chargeback' AND OLD.status = 'completed' THEN
    _type := 'clawback_chargeback';
    _idem := 'comm_cb_' || NEW.id || '_' || _staff;
    _amount := -ROUND((NEW.net_amount * _pct / 100)::numeric, 2);
  ELSE
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff_commissions_ledger WHERE idempotency_key = _idem) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_staff::text));
  _bal := public.get_staff_commission_balance(_staff);

  INSERT INTO public.staff_commissions_ledger
    (staff_user_id, seller_user_id, transaction_id, type, base_amount, pct, amount, balance_after, description, idempotency_key)
  VALUES
    (_staff, NEW.user_id, NEW.id, _type, NEW.net_amount, _pct, _amount, _bal + _amount,
     CASE _type
       WHEN 'accrual' THEN 'Comissão de venda aprovada'
       WHEN 'clawback_refund' THEN 'Estorno: comissão revertida'
       WHEN 'clawback_chargeback' THEN 'Chargeback: comissão revertida'
     END,
     _idem);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_commission_tx ON public.transactions;
CREATE TRIGGER trg_staff_commission_tx
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_staff_commission_on_tx();

-- Trigger para MED resolvido contra o seller
CREATE OR REPLACE FUNCTION public.apply_staff_commission_on_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff uuid;
  _pct numeric;
  _amount numeric;
  _bal numeric;
  _idem text;
  _seller uuid;
  _net numeric;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('lost','accepted','refunded') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.type, '') NOT IN ('med','refund') THEN RETURN NEW; END IF;

  SELECT user_id, net_amount INTO _seller, _net
    FROM public.transactions WHERE id = NEW.transaction_id LIMIT 1;
  IF _seller IS NULL THEN RETURN NEW; END IF;

  _staff := public.resolve_commission_staff(_seller);
  IF _staff IS NULL THEN RETURN NEW; END IF;

  _pct := public.resolve_commission_pct(_staff, _seller);
  IF COALESCE(_pct, 0) <= 0 THEN RETURN NEW; END IF;

  _idem := 'comm_med_' || NEW.id || '_' || _staff;
  IF EXISTS (SELECT 1 FROM public.staff_commissions_ledger WHERE idempotency_key = _idem) THEN
    RETURN NEW;
  END IF;

  _amount := -ROUND((_net * _pct / 100)::numeric, 2);
  PERFORM pg_advisory_xact_lock(hashtext(_staff::text));
  _bal := public.get_staff_commission_balance(_staff);

  INSERT INTO public.staff_commissions_ledger
    (staff_user_id, seller_user_id, transaction_id, dispute_id, type, base_amount, pct, amount, balance_after, description, idempotency_key)
  VALUES
    (_staff, _seller, NEW.transaction_id, NEW.id, 'clawback_med', _net, _pct, _amount, _bal + _amount,
     'MED resolvido: comissão revertida', _idem);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_commission_dispute ON public.disputes;
CREATE TRIGGER trg_staff_commission_dispute
  AFTER UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.apply_staff_commission_on_dispute();

-- ============================================================
-- 5) Payout request (staff solicita pagamento; admin aprova)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  method text,
  notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.staff_commission_payouts TO authenticated;
GRANT ALL ON public.staff_commission_payouts TO service_role;

ALTER TABLE public.staff_commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff insert own payout request"
  ON public.staff_commission_payouts FOR INSERT
  TO authenticated
  WITH CHECK (staff_user_id = auth.uid());

CREATE POLICY "Staff read own payouts"
  ON public.staff_commission_payouts FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage payouts"
  ON public.staff_commission_payouts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Quando admin marca como 'paid' → grava payout no ledger (debita)
CREATE OR REPLACE FUNCTION public.apply_commission_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bal numeric;
  _idem text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'paid' THEN
    _idem := 'comm_payout_' || NEW.id;
    IF EXISTS (SELECT 1 FROM public.staff_commissions_ledger WHERE idempotency_key = _idem) THEN
      RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(NEW.staff_user_id::text));
    _bal := public.get_staff_commission_balance(NEW.staff_user_id);
    INSERT INTO public.staff_commissions_ledger
      (staff_user_id, type, base_amount, pct, amount, balance_after, description, idempotency_key)
    VALUES
      (NEW.staff_user_id, 'payout', NEW.amount, 0, -NEW.amount, _bal - NEW.amount,
       COALESCE('Pagamento manual: ' || NEW.method, 'Pagamento de comissão'), _idem);
    NEW.processed_at := now();
    NEW.processed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_payout ON public.staff_commission_payouts;
CREATE TRIGGER trg_commission_payout
  BEFORE UPDATE ON public.staff_commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.apply_commission_payout();
