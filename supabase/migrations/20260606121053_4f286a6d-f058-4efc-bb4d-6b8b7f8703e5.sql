
-- 1. DISPUTES: remove seller direct SELECT; expose masked seller view
DROP POLICY IF EXISTS "Sellers can view own disputes" ON public.disputes;
ALTER VIEW public.disputes_seller SET (security_invoker = off);
GRANT SELECT ON public.disputes_seller TO authenticated;

-- 2. QUIZ_QUESTIONS: drop SELECT exposure of correct_index, keep mgmt
DROP POLICY IF EXISTS "Owner or admin view quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Owners manage quiz_questions" ON public.quiz_questions;

CREATE POLICY "Owners insert quiz_questions" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quizzes q
      JOIN public.lessons l ON l.id = q.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Owners update quiz_questions" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quizzes q
      JOIN public.lessons l ON l.id = q.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Owners delete quiz_questions" ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quizzes q
      JOIN public.lessons l ON l.id = q.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Admins view quiz_questions" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER VIEW public.quiz_questions_safe SET (security_invoker = off);
GRANT SELECT ON public.quiz_questions_safe TO authenticated;

-- 3. APP_INTEGRATIONS: create masked safe view, restrict direct SELECT of api_key
CREATE OR REPLACE VIEW public.app_integrations_safe
WITH (security_invoker = off) AS
SELECT
  id, user_id, app_name, product_id,
  CASE
    WHEN api_key IS NULL THEN NULL
    WHEN length(api_key) > 8 THEN left(api_key, 4) || '••••' || right(api_key, 4)
    ELSE '••••'
  END AS api_key_masked,
  (api_key IS NOT NULL) AS has_api_key,
  api_url, webhook_url, events, is_active, config, created_at, updated_at
FROM public.app_integrations
WHERE user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.app_integrations_safe TO authenticated;

-- Replace ALL policy (which exposed SELECT incl. api_key) with scoped INSERT
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.app_integrations;
CREATE POLICY "Users insert own integrations" ON public.app_integrations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- existing UPDATE/DELETE policies remain; admin SELECT policy remains

-- 4. WEBHOOK_CONFIGS: remove direct user SELECT (which exposes secret); use safe view
ALTER VIEW public.webhook_configs_safe SET (security_invoker = off);
GRANT SELECT ON public.webhook_configs_safe TO authenticated;
DROP POLICY IF EXISTS "Users can view own webhooks" ON public.webhook_configs;

-- 5. STORAGE course-content: enforce course ownership on INSERT path[2]
DROP POLICY IF EXISTS "Authenticated users can upload course content" ON storage.objects;
CREATE POLICY "Authenticated users can upload course content"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-content'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE (c.id)::text = (storage.foldername(name))[2]
        AND c.user_id = auth.uid()
    )
  );
