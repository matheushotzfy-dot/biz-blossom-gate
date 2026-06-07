
-- 1. fees: remove anon read
DROP POLICY IF EXISTS "Anon can view fees" ON public.fees;
REVOKE SELECT ON public.fees FROM anon;

-- 2. disputes: remove direct seller SELECT; sellers must use disputes_seller view
DROP POLICY IF EXISTS "Sellers can view own disputes" ON public.disputes;

-- 3. quiz_questions: revoke correct_index column read
REVOKE SELECT (correct_index) ON public.quiz_questions FROM anon, authenticated;

-- 4. webhook_configs: revoke secret column read
REVOKE SELECT (secret) ON public.webhook_configs FROM anon, authenticated;

-- 5. app_integrations: owner SELECT policy
CREATE POLICY "Users can view own integrations"
  ON public.app_integrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
