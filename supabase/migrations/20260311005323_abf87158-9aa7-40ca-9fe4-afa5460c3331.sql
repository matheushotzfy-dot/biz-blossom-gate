
-- =============================================
-- ATTACH ALL ORPHANED TRIGGER FUNCTIONS
-- =============================================

-- 1. Withdrawal validation (balance + amount)
CREATE TRIGGER trg_validate_withdrawal_amount
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_amount();

-- 2. Withdrawal fee enforcement (server-side fee calc)
CREATE TRIGGER trg_enforce_withdrawal_fee
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_fee();

-- 3. Rate limit withdrawals (max 3 pending)
CREATE TRIGGER trg_rate_limit_withdrawals
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_withdrawals();

-- 4. Force pending status on withdrawal insert
CREATE TRIGGER trg_force_pending_withdrawals
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.force_pending_on_insert();

-- 5. Protect transaction status/amounts from client manipulation
CREATE TRIGGER trg_protect_transaction_status
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.protect_transaction_status();

-- 6. Grant course access on payment completion
CREATE TRIGGER trg_grant_access_on_payment
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.grant_access_on_payment();

-- 7. Protect profile fields (KYC immutability + admin-only fields)
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 8. Validate product price range
CREATE TRIGGER trg_validate_product_price
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_price();

-- 9. Validate webhook URL (HTTPS + no internal IPs)
CREATE TRIGGER trg_validate_webhook_url
  BEFORE INSERT OR UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.validate_webhook_url();

-- 10. Validate coupon discount values
CREATE TRIGGER trg_validate_coupon_discount
  BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.validate_coupon_discount();

-- 11. Enforce max 3 PIX keys per user
CREATE TRIGGER trg_enforce_max_pix_keys
  BEFORE INSERT ON public.pix_keys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_pix_keys();

-- 12. Log product changes (audit trail)
CREATE TRIGGER trg_log_product_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_changes();

-- 13. Log course changes (audit trail)
CREATE TRIGGER trg_log_course_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.log_course_changes();

-- 14. Auto-update updated_at timestamps
CREATE TRIGGER trg_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_withdrawals
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_webhook_configs
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_disputes
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RECREATE VIEWS WITH SECURITY INVOKER
-- =============================================

-- disputes_seller view (masks PII, respects RLS)
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller
WITH (security_invoker = true)
AS SELECT
  d.id,
  d.seller_user_id,
  d.transaction_id,
  d.amount,
  d.type,
  d.status,
  d.reason,
  d.admin_notes,
  d.resolved_at,
  d.created_at,
  d.updated_at,
  CASE WHEN d.buyer_name IS NOT NULL THEN
    LEFT(d.buyer_name, 2) || '***'
  ELSE NULL END AS buyer_name_masked,
  CASE WHEN d.buyer_email IS NOT NULL THEN
    LEFT(d.buyer_email, 2) || '***@***'
  ELSE NULL END AS buyer_email_masked,
  CASE WHEN d.buyer_phone IS NOT NULL THEN
    LEFT(d.buyer_phone, 3) || '****' || RIGHT(d.buyer_phone, 2)
  ELSE NULL END AS buyer_phone_masked
FROM public.disputes d;

-- webhook_configs_safe view (masks secret, respects RLS)
DROP VIEW IF EXISTS public.webhook_configs_safe;
CREATE VIEW public.webhook_configs_safe
WITH (security_invoker = true)
AS SELECT
  wc.id,
  wc.user_id,
  wc.url,
  wc.events,
  wc.is_active,
  wc.created_at,
  wc.updated_at,
  CASE WHEN wc.secret IS NOT NULL THEN
    LEFT(wc.secret, 4) || '****'
  ELSE NULL END AS secret_masked
FROM public.webhook_configs wc;

-- =============================================
-- RESTRICT platform_settings to admin-only READ
-- =============================================
DROP POLICY IF EXISTS "Authenticated can read platform settings" ON public.platform_settings;

-- =============================================
-- PERFORMANCE INDEXES FOR VPS
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON public.transactions (product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals (user_id, status);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products (user_id);
CREATE INDEX IF NOT EXISTS idx_products_checkout_url ON public.products (checkout_url);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON public.coupons (user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons (code);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON public.webhook_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_user_id ON public.disputes (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_order_bumps_product_id ON public.order_bumps (product_id);
CREATE INDEX IF NOT EXISTS idx_product_pixels_product_id ON public.product_pixels (product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts (user_id);
