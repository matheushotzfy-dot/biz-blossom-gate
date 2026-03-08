-- =============================================
-- CRITICAL: ATTACH ALL MISSING TRIGGERS
-- All security functions exist but NO triggers!
-- =============================================

-- 1. Profile field protection (prevents KYC bypass, self-approval)
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- 2. Withdrawal amount validation (prevents overdraft/race condition)
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_trigger
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_withdrawal_amount();

-- 3. PIX key limit enforcement (max 3 per user)
DROP TRIGGER IF EXISTS enforce_max_pix_keys_trigger ON public.pix_keys;
CREATE TRIGGER enforce_max_pix_keys_trigger
  BEFORE INSERT ON public.pix_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_pix_keys();

-- 4. Product audit trail
DROP TRIGGER IF EXISTS log_product_changes_trigger ON public.products;
CREATE TRIGGER log_product_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_changes();

-- 5. Course audit trail
DROP TRIGGER IF EXISTS log_course_changes_trigger ON public.courses;
CREATE TRIGGER log_course_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_course_changes();

-- 6. Grant member access on payment completion
DROP TRIGGER IF EXISTS grant_access_on_payment_trigger ON public.transactions;
CREATE TRIGGER grant_access_on_payment_trigger
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_access_on_payment();

-- 7. Auto-update updated_at columns
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON public.courses;
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_disputes_updated_at ON public.disputes;
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FIX SECURITY SCAN FINDINGS
-- =============================================

-- FINDING 5: platform_settings - restrict to authenticated only
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- FINDING 6: notifications - prevent modifying global notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND user_id IS NOT NULL)
  WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- =============================================
-- PERFORMANCE INDEXES for high-concurrency
-- =============================================

CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
  ON public.transactions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status 
  ON public.withdrawals(user_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_podpay_payment_id 
  ON public.transactions(podpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_transactions_podpay_event_id 
  ON public.transactions(podpay_event_id);

CREATE INDEX IF NOT EXISTS idx_transactions_checkout_session 
  ON public.transactions(checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_products_checkout_url 
  ON public.products(checkout_url);

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user 
  ON public.balance_adjustments(user_id);

-- =============================================
-- POSITIVE AMOUNT CONSTRAINTS
-- =============================================

DO $$ BEGIN
  ALTER TABLE public.withdrawals ADD CONSTRAINT check_positive_amount CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD CONSTRAINT check_positive_tx_amount CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.balance_adjustments ADD CONSTRAINT check_positive_adj_amount CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- REVOKE dangerous function access from anon
-- =============================================
REVOKE EXECUTE ON FUNCTION public.validate_withdrawal_amount() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_max_pix_keys() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_access_on_payment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_product_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_course_changes() FROM anon;