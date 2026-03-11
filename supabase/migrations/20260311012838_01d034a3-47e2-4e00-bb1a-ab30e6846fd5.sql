
-- =====================================================
-- FIX #1-2: Recreate views with SECURITY INVOKER
-- =====================================================

-- Fix disputes_seller: use security_invoker to enforce RLS
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller WITH (security_invoker = true) AS
SELECT
  d.id, d.seller_user_id, d.transaction_id, d.type, d.status, d.reason,
  d.amount, d.admin_notes, d.created_at, d.updated_at, d.resolved_at,
  LEFT(d.buyer_name, 2) || '***' AS buyer_name_masked,
  CASE WHEN d.buyer_email IS NOT NULL THEN LEFT(d.buyer_email, 2) || '***@***' ELSE NULL END AS buyer_email_masked,
  CASE WHEN d.buyer_phone IS NOT NULL THEN LEFT(d.buyer_phone, 3) || '****' ELSE NULL END AS buyer_phone_masked
FROM public.disputes d;

-- Fix webhook_configs_safe: use security_invoker
DROP VIEW IF EXISTS public.webhook_configs_safe;
CREATE VIEW public.webhook_configs_safe WITH (security_invoker = true) AS
SELECT
  id, user_id, url, events, is_active, created_at, updated_at,
  CASE WHEN secret IS NOT NULL THEN LEFT(secret, 4) || '****' ELSE NULL END AS secret_masked
FROM public.webhook_configs;

-- =====================================================
-- FIX #3-4: Restrict public views to active-only data
-- =====================================================

DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public WITH (security_invoker = false) AS
SELECT
  id, name, description, price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  created_at
FROM public.products
WHERE status = 'active';

DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public WITH (security_invoker = false) AS
SELECT
  pp.id, pp.pixel_id, pp.platform, pp.product_id, pp.is_active,
  pp.events, pp.fire_on_pix_qr, pp.fire_on_boleto,
  pp.pix_conversion_value, pp.boleto_conversion_value,
  pp.disable_bump_events, pp.domain
FROM public.product_pixels pp
JOIN public.products p ON p.id = pp.product_id
WHERE pp.is_active = true AND p.status = 'active';

-- =====================================================
-- FIX #5: Add missing validate_withdrawal_balance trigger
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_withdrawal_balance') THEN
    CREATE TRIGGER trg_validate_withdrawal_balance
      BEFORE INSERT ON public.withdrawals
      FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_balance();
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- Function doesn't exist yet, skip
  NULL;
END
$$;

-- =====================================================
-- FIX #6-10: Performance indexes for VPS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON public.transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_checkout_url ON public.products(checkout_url);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON public.coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_user ON public.disputes(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_user_course ON public.user_access(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- =====================================================
-- FIX #11: Withdrawal rejection must check status=pending
-- Add a trigger to prevent status regression
-- =====================================================
CREATE OR REPLACE FUNCTION public.protect_withdrawal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow transitions from 'pending'
  IF OLD.status != 'pending' AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'Cannot change withdrawal status from % to %', OLD.status, NEW.status;
  END IF;
  -- Only allow valid target statuses
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_withdrawal_status') THEN
    CREATE TRIGGER trg_protect_withdrawal_status
      BEFORE UPDATE ON public.withdrawals
      FOR EACH ROW EXECUTE FUNCTION public.protect_withdrawal_status();
  END IF;
END
$$;
