-- FIX #1: Restrict disputes table - sellers must NOT see unmasked buyer PII
DROP POLICY IF EXISTS "Sellers can view own disputes" ON public.disputes;
CREATE POLICY "Only admins can read disputes"
ON public.disputes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can manage disputes" ON public.disputes;
CREATE POLICY "Admins can manage disputes"
ON public.disputes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- FIX #2: Add validation trigger for balance_adjustments
CREATE OR REPLACE FUNCTION public.validate_balance_adjustment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF NEW.amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum'; END IF;
  IF NEW.type NOT IN ('credit', 'debit') THEN RAISE EXCEPTION 'Invalid type'; END IF;
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_balance_adjustment ON public.balance_adjustments;
CREATE TRIGGER trg_validate_balance_adjustment BEFORE INSERT ON public.balance_adjustments FOR EACH ROW EXECUTE FUNCTION public.validate_balance_adjustment();

-- FIX #3: Add validation trigger for retention_settings
CREATE OR REPLACE FUNCTION public.validate_retention_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.pix_retention_pct < 0 OR NEW.pix_retention_pct > 100 THEN RAISE EXCEPTION 'PIX retention must be 0-100'; END IF;
  IF NEW.card_retention_pct < 0 OR NEW.card_retention_pct > 100 THEN RAISE EXCEPTION 'Card retention must be 0-100'; END IF;
  IF NEW.retention_days < 1 OR NEW.retention_days > 365 THEN RAISE EXCEPTION 'Days must be 1-365'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_retention ON public.retention_settings;
CREATE TRIGGER trg_validate_retention BEFORE INSERT OR UPDATE ON public.retention_settings FOR EACH ROW EXECUTE FUNCTION public.validate_retention_settings();

-- FIX #4: Notification rate limiting
CREATE OR REPLACE FUNCTION public.validate_notification_rate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count FROM public.notifications WHERE created_by = NEW.created_by AND created_at > now() - interval '1 hour';
  IF recent_count >= 50 THEN RAISE EXCEPTION 'Rate limit exceeded'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notification_rate_limit ON public.notifications;
CREATE TRIGGER trg_notification_rate_limit BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.validate_notification_rate();

-- FIX #5: Withdrawal validation
CREATE OR REPLACE FUNCTION public.validate_withdrawal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF NEW.amount > 500000 THEN RAISE EXCEPTION 'Amount exceeds maximum'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_withdrawal ON public.withdrawals;
CREATE TRIGGER trg_validate_withdrawal BEFORE INSERT ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal();

-- FIX #6: Failed login tracking
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins read login attempts" ON public.admin_login_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- FIX #7-12: RLS on admin-only tables
DROP POLICY IF EXISTS "Admins manage blacklist" ON public.global_blacklist;
CREATE POLICY "Admins manage blacklist" ON public.global_blacklist FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage velocity rules" ON public.velocity_rules;
CREATE POLICY "Admins manage velocity rules" ON public.velocity_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read fraud logs" ON public.fraud_logs;
CREATE POLICY "Admins read fraud logs" ON public.fraud_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage auto withdraw" ON public.seller_auto_withdraw;
CREATE POLICY "Admins manage auto withdraw" ON public.seller_auto_withdraw FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read error logs" ON public.error_logs;
CREATE POLICY "Admins read error logs" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));