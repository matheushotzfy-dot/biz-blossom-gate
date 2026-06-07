-- Production hardening for high-volume financial workload

-- 1) Hide quiz answer key from direct table reads (students must use quiz_questions_safe view or grade_quiz_attempt RPC)
REVOKE SELECT (correct_index) ON public.quiz_questions FROM authenticated;
REVOKE SELECT (correct_index) ON public.quiz_questions FROM anon;

-- 2) Hide webhook signing secret from direct table reads (clients must use webhook_configs_safe view)
REVOKE SELECT (secret) ON public.webhook_configs FROM authenticated;
REVOKE SELECT (secret) ON public.webhook_configs FROM anon;

-- 3) Allow sellers to read their own disputes so the disputes_seller masking view returns rows
DROP POLICY IF EXISTS "Sellers can view own disputes" ON public.disputes;
CREATE POLICY "Sellers can view own disputes"
ON public.disputes
FOR SELECT
TO authenticated
USING (seller_user_id = auth.uid());