-- =====================================================================
-- WAVE 1: Critical Security Hardening
-- =====================================================================

-- 1. REVOKE EXECUTE on trigger-only / internal SECURITY DEFINER functions
--    These should never be callable from the Data API (anon/authenticated)
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'sanitize_notification()',
    'protect_withdrawal_status()',
    'validate_coupon_discount()',
    'validate_balance_adjustment()',
    'validate_role_assignment()',
    'sanitize_lesson_comment()',
    'notify_product_status_change()',
    'validate_notification_rate()',
    'update_updated_at_column()',
    'issue_certificate_on_completion()',
    'ledger_on_withdrawal_change()',
    'protect_profile_fields()',
    'force_pending_on_insert()',
    'enforce_max_pix_keys()',
    'rate_limit_withdrawals()',
    'validate_product_price()',
    'validate_crypto_daily_limit()',
    'log_product_changes()',
    'sanitize_dispute()',
    'enforce_max_api_keys()',
    'validate_webhook_url()',
    'grant_access_on_payment()',
    'log_course_changes()',
    'ledger_on_adjustment()',
    'sanitize_activity_log()',
    'enqueue_webhook_on_tx_change()',
    'validate_withdrawal_balance()',
    'validate_retention_settings()',
    'handle_new_user()',
    'enforce_withdrawal_fee()',
    'protect_transaction_status()',
    'sanitize_seller_note()',
    'validate_custom_fees()',
    'ledger_on_transaction_change()',
    'notify_withdrawal_status()',
    'validate_withdrawal()',
    'verify_api_secret(text, text)',
    'touch_api_key(uuid)',
    'bump_rate_limit(text, integer, integer)',
    'check_blacklist(text, text, text)',
    'check_velocity(text, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Skip missing function: %', fn;
    END;
  END LOOP;
END $$;

-- Public/edge-callable functions stay callable (explicit re-grant for clarity)
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_signup_conflicts(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_product_active(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ledger_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_affiliate_product_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_quiz_attempt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_analytics(uuid) TO authenticated;

-- =====================================================================
-- 2. user_progress: require active enrollment before writing
-- =====================================================================
DROP POLICY IF EXISTS "Users manage own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users view own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users insert own progress with enrollment" ON public.user_progress;
DROP POLICY IF EXISTS "Users update own progress with enrollment" ON public.user_progress;
DROP POLICY IF EXISTS "Users delete own progress" ON public.user_progress;

CREATE POLICY "Users view own progress"
  ON public.user_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own progress with enrollment"
  ON public.user_progress FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.user_access ua ON ua.course_id = m.course_id
      WHERE l.id = user_progress.lesson_id
        AND ua.user_id = auth.uid()
        AND ua.status = 'active'
    )
  );

CREATE POLICY "Users update own progress with enrollment"
  ON public.user_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.user_access ua ON ua.course_id = m.course_id
      WHERE l.id = user_progress.lesson_id
        AND ua.user_id = auth.uid()
        AND ua.status = 'active'
    )
  );

CREATE POLICY "Users delete own progress"
  ON public.user_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- 3. quiz_questions: safe view without correct_index for students
-- =====================================================================
DROP VIEW IF EXISTS public.quiz_questions_safe;
CREATE VIEW public.quiz_questions_safe
WITH (security_invoker = on) AS
  SELECT id, quiz_id, question, options, explanation, sort_order, created_at
  FROM public.quiz_questions;

GRANT SELECT ON public.quiz_questions_safe TO authenticated;
