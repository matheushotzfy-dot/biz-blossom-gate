
-- ========== 1. REVOKE EXECUTE em funções SECURITY DEFINER sensíveis ==========
REVOKE EXECUTE ON FUNCTION public.get_course_analytics(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ledger_balance(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_velocity(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_blacklist(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_signup_conflicts(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_affiliate_product_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_checkout_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_product_active(uuid) FROM anon;

-- ========== 2. ÍNDICES de performance ==========
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_created ON public.transactions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_affiliate ON public.affiliate_sales(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product ON public.affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_user_created ON public.financial_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created ON public.audit_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_email_created ON public.fraud_logs(customer_email, created_at DESC);

-- ========== 3. CHECK constraints (não-negativo) ==========
DO $$ BEGIN
  ALTER TABLE public.transactions ADD CONSTRAINT chk_transactions_amount_positive CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object OR check_violation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.withdrawals ADD CONSTRAINT chk_withdrawals_amount_positive CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object OR check_violation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.affiliate_sales ADD CONSTRAINT chk_affiliate_sales_amount_positive CHECK (sale_amount >= 0 AND commission_amount >= 0);
EXCEPTION WHEN duplicate_object OR check_violation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.balance_adjustments ADD CONSTRAINT chk_balance_adjustments_amount_positive CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object OR check_violation THEN NULL; END $$;

-- ========== 4. ON DELETE CASCADE em order_bumps ==========
DO $$ BEGIN
  ALTER TABLE public.order_bumps DROP CONSTRAINT IF EXISTS order_bumps_bump_product_id_fkey;
  ALTER TABLE public.order_bumps
    ADD CONSTRAINT order_bumps_bump_product_id_fkey
    FOREIGN KEY (bump_product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

-- ========== 5. SOFT DELETE em products ==========
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_products_not_deleted ON public.products(user_id) WHERE deleted_at IS NULL;

-- ========== 6. Sanitização PII em activity_logs ==========
CREATE OR REPLACE FUNCTION public.sanitize_activity_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sensitive_keys text[] := ARRAY['password','senha','token','secret','api_key','secret_key','access_token','refresh_token','cpf','cnpj','document_number','card_number','cvv'];
  _k text;
BEGIN
  IF NEW.new_data IS NOT NULL THEN
    FOREACH _k IN ARRAY _sensitive_keys LOOP
      NEW.new_data := NEW.new_data - _k;
    END LOOP;
  END IF;
  IF NEW.old_data IS NOT NULL THEN
    FOREACH _k IN ARRAY _sensitive_keys LOOP
      NEW.old_data := NEW.old_data - _k;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_activity_log ON public.activity_logs;
CREATE TRIGGER trg_sanitize_activity_log
BEFORE INSERT OR UPDATE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.sanitize_activity_log();

-- ========== 7. Trigger updated_at em acquirers ==========
DROP TRIGGER IF EXISTS trg_acquirers_updated_at ON public.acquirers;
CREATE TRIGGER trg_acquirers_updated_at
BEFORE UPDATE ON public.acquirers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
