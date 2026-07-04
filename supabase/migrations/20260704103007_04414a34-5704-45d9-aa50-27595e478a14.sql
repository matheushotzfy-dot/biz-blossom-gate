
-- 1) withdrawals.pix_key_id
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS pix_key_id uuid REFERENCES public.pix_keys(id) ON DELETE SET NULL;

-- Ensure origin has sensible default
ALTER TABLE public.withdrawals
  ALTER COLUMN origin SET DEFAULT 'manual';

-- Only one pending auto withdrawal per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_auto_withdrawal_per_user
  ON public.withdrawals (user_id)
  WHERE status = 'pending' AND origin = 'auto';

-- 2) check_auto_withdrawal function
CREATE OR REPLACE FUNCTION public.check_auto_withdrawal(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          public.seller_auto_withdraw%ROWTYPE;
  v_balance      numeric;
  v_pix_owner    uuid;
  v_account_st   text;
  v_existing_id  uuid;
  v_withdrawal_id uuid;
  v_fee          numeric := 5;
  v_net          numeric;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  -- Serialize per user
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT * INTO v_cfg
    FROM public.seller_auto_withdraw
   WHERE user_id = p_user_id AND enabled = true
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_cfg.target_amount IS NULL OR v_cfg.pix_key_id IS NULL THEN RETURN; END IF;

  -- Account status must be approved
  SELECT account_status INTO v_account_st FROM public.profiles WHERE user_id = p_user_id;
  IF v_account_st IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, 'auto_withdrawal_skipped', 'auto_withdrawal_settings', v_cfg.id::text,
            jsonb_build_object('reason','account_not_approved','account_status',v_account_st));
    RETURN;
  END IF;

  -- Available balance
  v_balance := public.get_ledger_balance(p_user_id);
  IF v_balance IS NULL OR v_balance < v_cfg.target_amount THEN RETURN; END IF;

  -- Pix key still valid & owned
  SELECT user_id INTO v_pix_owner FROM public.pix_keys WHERE id = v_cfg.pix_key_id;
  IF v_pix_owner IS NULL OR v_pix_owner <> p_user_id THEN
    UPDATE public.seller_auto_withdraw SET enabled = false, updated_at = now()
      WHERE id = v_cfg.id;
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, 'auto_withdrawal_disabled', 'auto_withdrawal_settings', v_cfg.id::text,
            jsonb_build_object('reason','invalid_pix_key','pix_key_id',v_cfg.pix_key_id));
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p_user_id, 'Saque automático desativado',
            'Sua chave Pix vinculada ao saque automático foi removida. Configure novamente.',
            'warning');
    RETURN;
  END IF;

  -- Already a pending auto withdrawal?
  SELECT id INTO v_existing_id FROM public.withdrawals
    WHERE user_id = p_user_id AND status = 'pending' AND origin = 'auto' LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN; END IF;

  -- Withdraw fee
  SELECT value INTO v_fee FROM public.fees
    WHERE name = 'Taxa de Saque' AND fee_type = 'fixed' LIMIT 1;
  v_fee := COALESCE(v_fee, 5);
  v_net := v_cfg.target_amount - v_fee;

  INSERT INTO public.withdrawals
    (user_id, amount, fee_amount, net_amount, status, withdrawal_type, origin, pix_key_id)
  VALUES
    (p_user_id, v_cfg.target_amount, v_fee, v_net, 'pending', 'pix', 'auto', v_cfg.pix_key_id)
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'auto_withdrawal_created', 'withdrawal', v_withdrawal_id::text,
          jsonb_build_object(
            'amount', v_cfg.target_amount,
            'pix_key_id', v_cfg.pix_key_id,
            'available_balance', v_balance
          ));
EXCEPTION WHEN unique_violation THEN
  -- another concurrent auto withdrawal beat us
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.check_auto_withdrawal(uuid) FROM PUBLIC;

-- 3) Trigger on financial_ledger: on credit, try auto withdrawal
CREATE OR REPLACE FUNCTION public.trg_ledger_auto_withdraw()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_type = 'credit' AND NEW.amount > 0 THEN
    PERFORM public.check_auto_withdrawal(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_ledger_auto_withdraw ON public.financial_ledger;
CREATE TRIGGER trg_financial_ledger_auto_withdraw
AFTER INSERT ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.trg_ledger_auto_withdraw();

-- 4) Trigger on pix_keys DELETE: auto-disable config + notify
CREATE OR REPLACE FUNCTION public.trg_pix_key_deleted_disable_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg_id uuid;
BEGIN
  SELECT id INTO v_cfg_id FROM public.seller_auto_withdraw
   WHERE user_id = OLD.user_id AND pix_key_id = OLD.id AND enabled = true;
  IF v_cfg_id IS NOT NULL THEN
    UPDATE public.seller_auto_withdraw
       SET enabled = false, updated_at = now()
     WHERE id = v_cfg_id;
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (OLD.user_id, 'auto_withdrawal_disabled', 'auto_withdrawal_settings', v_cfg_id::text,
            jsonb_build_object('reason','pix_key_removed','pix_key_id',OLD.id));
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (OLD.user_id, 'Saque automático desativado',
            'Seu saque automático foi desativado porque a chave Pix vinculada foi removida. Configure novamente.',
            'warning');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pix_keys_disable_auto_withdraw ON public.pix_keys;
CREATE TRIGGER trg_pix_keys_disable_auto_withdraw
BEFORE DELETE ON public.pix_keys
FOR EACH ROW EXECUTE FUNCTION public.trg_pix_key_deleted_disable_auto();

-- 5) Trigger on profiles: if account_status leaves 'approved', pause auto
CREATE OR REPLACE FUNCTION public.trg_profile_status_pause_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.account_status = 'approved'
     AND NEW.account_status IS DISTINCT FROM 'approved' THEN
    UPDATE public.seller_auto_withdraw
       SET enabled = false, updated_at = now()
     WHERE user_id = NEW.user_id AND enabled = true;

    IF FOUND THEN
      INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
      VALUES (NEW.user_id, 'auto_withdrawal_paused', 'auto_withdrawal_settings', NEW.user_id::text,
              jsonb_build_object('reason','kyc_status_changed','new_status',NEW.account_status));
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, 'Saque automático pausado',
              'Seu saque automático foi pausado porque o status do seu KYC foi alterado.',
              'warning');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_pause_auto_withdraw ON public.profiles;
CREATE TRIGGER trg_profiles_pause_auto_withdraw
AFTER UPDATE OF account_status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_profile_status_pause_auto();
