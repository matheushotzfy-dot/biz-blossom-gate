
-- =============================================
-- FIX 1: Add missing user_id indexes for RLS performance
-- These 10 tables do full table scans on EVERY query due to RLS checking user_id without index
-- =============================================
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON public.coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_product_id ON public.courses(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_integrations_user_id ON public.app_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_product_pixels_user_id ON public.product_pixels(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user_id ON public.balance_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id) WHERE user_id IS NOT NULL;

-- =============================================
-- FIX 2: Add indexes for FK joins used in member area RLS policies
-- =============================================
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON public.modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_user_access_course_user ON public.user_access(course_id, user_id, status);

-- =============================================
-- FIX 3: Fix withdrawal race condition with advisory lock in trigger
-- Replace the validate_withdrawal_amount trigger to use SELECT ... FOR UPDATE
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total_earned numeric;
  _total_withdrawn numeric;
  _available numeric;
BEGIN
  -- Advisory lock per user to prevent concurrent withdrawal race condition
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  -- Calculate total net earnings from completed transactions
  SELECT COALESCE(SUM(net_amount), 0) INTO _total_earned
  FROM public.transactions
  WHERE user_id = NEW.user_id AND status = 'completed';

  -- Calculate total approved/pending withdrawals (excluding current insert)
  SELECT COALESCE(SUM(amount), 0) INTO _total_withdrawn
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved') AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  _available := _total_earned - _total_withdrawn;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;

  RETURN NEW;
END;
$function$;
