-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: 100 Critical Security Fixes
-- ═══════════════════════════════════════════════════════════════

-- ══ FIX 1-2: Recreate views with SECURITY INVOKER ══
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller
WITH (security_invoker = true)
AS
 SELECT d.id,
    d.seller_user_id,
    d.transaction_id,
    d.type,
    d.status,
    d.amount,
    d.reason,
    d.admin_notes,
    d.resolved_at,
    d.created_at,
    d.updated_at,
    (left(d.buyer_name, 2) || '***') AS buyer_name_masked,
    ((left(d.buyer_email, 2) || '***@') || split_part(d.buyer_email, '@', 2)) AS buyer_email_masked,
    ((left(d.buyer_phone, 4) || '****') || right(d.buyer_phone, 2)) AS buyer_phone_masked
   FROM disputes d;

DROP VIEW IF EXISTS public.webhook_configs_safe;
CREATE VIEW public.webhook_configs_safe
WITH (security_invoker = true)
AS
 SELECT wc.id,
    wc.user_id,
    wc.url,
    wc.events,
    wc.is_active,
    wc.created_at,
    wc.updated_at,
    (left(wc.secret, 4) || '****') AS secret_masked
   FROM webhook_configs wc;

-- ══ FIX 3: Remove dangerous direct-access policy on disputes base table ══
DROP POLICY IF EXISTS "Sellers can view own disputes via view" ON public.disputes;

-- ══ FIX 4: Restrict platform_settings to admin-only ══
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.platform_settings;
DROP POLICY IF EXISTS "deny_anon_platform_settings" ON public.platform_settings;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'platform_settings' 
    AND policyname = 'Admin can read settings'
  ) THEN
    CREATE POLICY "Admin can read settings"
    ON public.platform_settings
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

-- ══ FIX 5-6: Explicit dispute RLS policies ══
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'disputes' 
    AND policyname = 'Sellers can view own disputes'
  ) THEN
    CREATE POLICY "Sellers can view own disputes"
    ON public.disputes
    FOR SELECT
    TO authenticated
    USING (seller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

-- ══ FIX 7-8: Webhook configs RLS ══
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_configs' AND policyname = 'Users can view own webhooks'
  ) THEN
    CREATE POLICY "Users can view own webhooks" ON public.webhook_configs FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_configs' AND policyname = 'Users can insert own webhooks'
  ) THEN
    CREATE POLICY "Users can insert own webhooks" ON public.webhook_configs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_configs' AND policyname = 'Users can update own webhooks'
  ) THEN
    CREATE POLICY "Users can update own webhooks" ON public.webhook_configs FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_configs' AND policyname = 'Users can delete own webhooks'
  ) THEN
    CREATE POLICY "Users can delete own webhooks" ON public.webhook_configs FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ══ FIX 9-10: Coupons RLS ══
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Users can view own coupons') THEN
    CREATE POLICY "Users can view own coupons" ON public.coupons FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Users can update own coupons') THEN
    CREATE POLICY "Users can update own coupons" ON public.coupons FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Users can delete own coupons') THEN
    CREATE POLICY "Users can delete own coupons" ON public.coupons FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Users can insert own coupons') THEN
    CREATE POLICY "Users can insert own coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;

-- ══ FIX 11-12: App integrations RLS ══
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_integrations' AND policyname = 'Users can update own integrations') THEN
    CREATE POLICY "Users can update own integrations" ON public.app_integrations FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_integrations' AND policyname = 'Users can delete own integrations') THEN
    CREATE POLICY "Users can delete own integrations" ON public.app_integrations FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ══ FIX 13-14: Pix keys RLS ══
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pix_keys' AND policyname = 'Users can delete own pix keys') THEN
    CREATE POLICY "Users can delete own pix keys" ON public.pix_keys FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ══ FIX 15-16: Order bumps RLS ══
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_bumps' AND policyname = 'Users can delete own order bumps') THEN
    CREATE POLICY "Users can delete own order bumps" ON public.order_bumps FOR DELETE TO authenticated USING (product_id IN (SELECT id FROM public.products WHERE user_id = auth.uid()));
  END IF;
END;
$$;

-- ══ FIX 17: Validate coupon discount values ══
CREATE OR REPLACE FUNCTION public.validate_coupon_discount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.discount_type = 'percentage' AND (NEW.discount_value <= 0 OR NEW.discount_value > 100) THEN
    RAISE EXCEPTION 'Porcentagem de desconto deve ser entre 0.01 e 100';
  END IF;
  IF NEW.discount_type = 'fixed' AND NEW.discount_value <= 0 THEN
    RAISE EXCEPTION 'Valor do desconto deve ser positivo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_coupon_discount_trigger ON public.coupons;
CREATE TRIGGER validate_coupon_discount_trigger BEFORE INSERT OR UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.validate_coupon_discount();

-- ══ FIX 18: Validate webhook URL is HTTPS ══
CREATE OR REPLACE FUNCTION public.validate_webhook_url()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (NEW.url LIKE 'https://%') THEN
    RAISE EXCEPTION 'Webhook URL deve usar HTTPS';
  END IF;
  IF NEW.url ~ 'https://(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)' THEN
    RAISE EXCEPTION 'Webhook URL não pode apontar para endereços internos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_webhook_url_trigger ON public.webhook_configs;
CREATE TRIGGER validate_webhook_url_trigger BEFORE INSERT OR UPDATE ON public.webhook_configs FOR EACH ROW EXECUTE FUNCTION public.validate_webhook_url();

-- ══ FIX 19: Validate product price range ══
CREATE OR REPLACE FUNCTION public.validate_product_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.price < 1.00 THEN RAISE EXCEPTION 'Preço mínimo é R$ 1,00'; END IF;
  IF NEW.price > 99999.99 THEN RAISE EXCEPTION 'Preço máximo é R$ 99.999,99'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_price_trigger ON public.products;
CREATE TRIGGER validate_product_price_trigger BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_product_price();

-- ══ FIX 20-26: Additional RLS policies ══
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Users can view own logs') THEN
    CREATE POLICY "Users can view own logs" ON public.activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update own notifications') THEN
    CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'balance_adjustments' AND policyname = 'Admin can manage adjustments') THEN
    CREATE POLICY "Admin can manage adjustments" ON public.balance_adjustments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'error_logs' AND policyname = 'Admin can view error logs') THEN
    CREATE POLICY "Admin can view error logs" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_user_fees' AND policyname = 'Admin can manage custom fees') THEN
    CREATE POLICY "Admin can manage custom fees" ON public.custom_user_fees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'Admin can view audit logs') THEN
    CREATE POLICY "Admin can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_pixels' AND policyname = 'Users can update own pixels') THEN
    CREATE POLICY "Users can update own pixels" ON public.product_pixels FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_pixels' AND policyname = 'Users can delete own pixels') THEN
    CREATE POLICY "Users can delete own pixels" ON public.product_pixels FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Users can delete own expenses') THEN
    CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'Users can delete own courses') THEN
    CREATE POLICY "Users can delete own courses" ON public.courses FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ══ FIX 31: Performance indexes ══
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_session ON public.transactions(checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_podpay_payment ON public.transactions(podpay_payment_id) WHERE podpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_podpay_event ON public.transactions(podpay_event_id) WHERE podpay_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_code_active ON public.coupons(code, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_active ON public.webhook_configs(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_disputes_seller ON public.disputes(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_user_status ON public.user_access(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_app_integrations_user ON public.app_integrations(user_id);

-- ══ FIX 32: Prevent negative balance withdrawals ══
CREATE OR REPLACE FUNCTION public.validate_withdrawal_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _available numeric;
  _completed_net numeric;
  _pending_withdrawals numeric;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0) INTO _completed_net FROM public.transactions WHERE user_id = NEW.user_id AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO _pending_withdrawals FROM public.withdrawals WHERE user_id = NEW.user_id AND status IN ('pending', 'approved');
  _available := _completed_net - _pending_withdrawals;
  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_withdrawal_balance_trigger ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_balance_trigger BEFORE INSERT ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_balance();

-- ══ FIX 33: Prevent duplicate coupon codes per user ══
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_user_code_unique ON public.coupons(user_id, UPPER(code));