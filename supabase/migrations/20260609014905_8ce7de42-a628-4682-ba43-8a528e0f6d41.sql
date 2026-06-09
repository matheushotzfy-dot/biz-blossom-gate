
REVOKE SELECT (correct_index) ON public.quiz_questions FROM authenticated;
REVOKE SELECT (correct_index) ON public.quiz_questions FROM anon;

DROP VIEW IF EXISTS public.quiz_questions_safe CASCADE;
CREATE VIEW public.quiz_questions_safe
WITH (security_invoker = on) AS
SELECT id, quiz_id, question, options, explanation, sort_order
FROM public.quiz_questions;
GRANT SELECT ON public.quiz_questions_safe TO authenticated;

REVOKE SELECT (secret) ON public.webhook_configs FROM authenticated;
REVOKE SELECT (secret) ON public.webhook_configs FROM anon;

DROP VIEW IF EXISTS public.webhook_configs_safe CASCADE;
CREATE VIEW public.webhook_configs_safe
WITH (security_invoker = on) AS
SELECT
  id, user_id, url, events, is_active, created_at, updated_at,
  CASE
    WHEN secret IS NULL OR secret = '' THEN ''
    ELSE 'whsec_' || repeat('•', 8) || right(secret, 4)
  END AS secret_masked
FROM public.webhook_configs;
GRANT SELECT ON public.webhook_configs_safe TO authenticated;

DROP POLICY IF EXISTS deny_insert_login_attempts ON public.admin_login_attempts;
DROP POLICY IF EXISTS deny_update_login_attempts ON public.admin_login_attempts;
DROP POLICY IF EXISTS deny_delete_login_attempts ON public.admin_login_attempts;

CREATE POLICY deny_insert_login_attempts ON public.admin_login_attempts
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY deny_update_login_attempts ON public.admin_login_attempts
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY deny_delete_login_attempts ON public.admin_login_attempts
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
