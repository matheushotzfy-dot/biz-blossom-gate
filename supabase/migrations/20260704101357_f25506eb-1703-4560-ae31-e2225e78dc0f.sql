
-- 1) Extend seller_auto_withdraw
ALTER TABLE public.seller_auto_withdraw
  ADD COLUMN IF NOT EXISTS target_amount numeric,
  ADD COLUMN IF NOT EXISTS pix_key_id uuid REFERENCES public.pix_keys(id) ON DELETE SET NULL;

-- Backfill from legacy max_amount when present
UPDATE public.seller_auto_withdraw
   SET target_amount = LEAST(GREATEST(COALESCE(target_amount, max_amount, 50), 50), 10000)
 WHERE target_amount IS NULL;

-- Uniqueness: one config per seller
CREATE UNIQUE INDEX IF NOT EXISTS seller_auto_withdraw_user_id_uidx
  ON public.seller_auto_withdraw(user_id);

-- Range check via trigger (kept as trigger to remain safe under future changes)
CREATE OR REPLACE FUNCTION public.validate_auto_withdraw_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_key_type text;
BEGIN
  IF NEW.enabled = true THEN
    IF NEW.target_amount IS NULL OR NEW.target_amount < 50 OR NEW.target_amount > 10000 THEN
      RAISE EXCEPTION 'target_amount must be between 50 and 10000';
    END IF;
    IF NEW.pix_key_id IS NULL THEN
      RAISE EXCEPTION 'pix_key_id is required when auto withdrawal is enabled';
    END IF;
  END IF;

  IF NEW.pix_key_id IS NOT NULL THEN
    SELECT user_id, key_type INTO v_owner, v_key_type
      FROM public.pix_keys WHERE id = NEW.pix_key_id;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'pix_key not found';
    END IF;
    IF v_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'pix_key does not belong to user';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_auto_withdraw_row ON public.seller_auto_withdraw;
CREATE TRIGGER trg_validate_auto_withdraw_row
  BEFORE INSERT OR UPDATE ON public.seller_auto_withdraw
  FOR EACH ROW EXECUTE FUNCTION public.validate_auto_withdraw_row();

-- Lock privileged columns from seller updates
CREATE OR REPLACE FUNCTION public.protect_auto_withdraw_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.admin_user_id := OLD.admin_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_auto_withdraw_columns ON public.seller_auto_withdraw;
CREATE TRIGGER trg_protect_auto_withdraw_columns
  BEFORE UPDATE ON public.seller_auto_withdraw
  FOR EACH ROW EXECUTE FUNCTION public.protect_auto_withdraw_columns();

-- Updated-at trigger
DROP TRIGGER IF EXISTS trg_seller_auto_withdraw_updated_at ON public.seller_auto_withdraw;
CREATE TRIGGER trg_seller_auto_withdraw_updated_at
  BEFORE UPDATE ON public.seller_auto_withdraw
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log for config changes
CREATE OR REPLACE FUNCTION public.audit_auto_withdraw_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    COALESCE(auth.uid(), NEW.user_id),
    TG_OP,
    'auto_withdrawal_settings',
    NEW.id::text,
    jsonb_build_object(
      'user_id', NEW.user_id,
      'before', CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object(
        'enabled', OLD.enabled,
        'target_amount', OLD.target_amount,
        'pix_key_id', OLD.pix_key_id
      ) ELSE NULL END,
      'after', jsonb_build_object(
        'enabled', NEW.enabled,
        'target_amount', NEW.target_amount,
        'pix_key_id', NEW.pix_key_id
      )
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_auto_withdraw_change ON public.seller_auto_withdraw;
CREATE TRIGGER trg_audit_auto_withdraw_change
  AFTER INSERT OR UPDATE ON public.seller_auto_withdraw
  FOR EACH ROW EXECUTE FUNCTION public.audit_auto_withdraw_change();

-- Policies: allow seller INSERT/UPDATE own row
DROP POLICY IF EXISTS "Users insert own auto withdraw config" ON public.seller_auto_withdraw;
CREATE POLICY "Users insert own auto withdraw config"
  ON public.seller_auto_withdraw
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own auto withdraw config" ON public.seller_auto_withdraw;
CREATE POLICY "Users update own auto withdraw config"
  ON public.seller_auto_withdraw
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Withdrawals: origin column
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';

ALTER TABLE public.withdrawals
  DROP CONSTRAINT IF EXISTS withdrawals_origin_check;
ALTER TABLE public.withdrawals
  ADD CONSTRAINT withdrawals_origin_check CHECK (origin IN ('manual','auto'));

CREATE INDEX IF NOT EXISTS withdrawals_origin_idx ON public.withdrawals(origin);
