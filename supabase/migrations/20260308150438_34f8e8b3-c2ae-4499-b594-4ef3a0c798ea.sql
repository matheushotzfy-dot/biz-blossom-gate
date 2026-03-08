-- =============================================
-- CRITICAL FIX 1: ATTACH ALL MISSING TRIGGERS
-- Functions exist but NONE are wired to tables
-- =============================================

-- Withdrawal validation (prevents overdraft & race conditions)
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_trigger
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_withdrawal_amount();

-- Profile field protection (KYC immutability + admin-only fields)
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- Force pending status on new transactions
DROP TRIGGER IF EXISTS force_pending_status_trigger ON public.transactions;
CREATE TRIGGER force_pending_status_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.force_pending_on_insert();

-- Protect transaction status/amount from client manipulation
DROP TRIGGER IF EXISTS protect_transaction_status_trigger ON public.transactions;
CREATE TRIGGER protect_transaction_status_trigger
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_transaction_status();

-- Enforce max 3 PIX keys per user
DROP TRIGGER IF EXISTS enforce_max_pix_keys_trigger ON public.pix_keys;
CREATE TRIGGER enforce_max_pix_keys_trigger
  BEFORE INSERT ON public.pix_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_pix_keys();

-- Grant member access on completed payment
DROP TRIGGER IF EXISTS grant_access_on_payment_trigger ON public.transactions;
CREATE TRIGGER grant_access_on_payment_trigger
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_access_on_payment();

-- Audit trail: product changes
DROP TRIGGER IF EXISTS log_product_changes_trigger ON public.products;
CREATE TRIGGER log_product_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_changes();

-- Audit trail: course changes
DROP TRIGGER IF EXISTS log_course_changes_trigger ON public.courses;
CREATE TRIGGER log_course_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_course_changes();

-- =============================================
-- CRITICAL FIX 2: RLS ON UNPROTECTED VIEWS
-- =============================================

ALTER VIEW public.disputes_seller SET (security_invoker = on);
ALTER VIEW public.webhook_configs_safe SET (security_invoker = on);
ALTER VIEW public.product_pixels_public SET (security_invoker = on)