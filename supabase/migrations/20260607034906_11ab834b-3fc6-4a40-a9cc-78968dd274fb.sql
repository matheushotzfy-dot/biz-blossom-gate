
-- 1. Flip views to security_invoker so RLS of querying user applies
ALTER VIEW public.app_integrations_safe SET (security_invoker = true);
ALTER VIEW public.disputes_seller       SET (security_invoker = true);
ALTER VIEW public.webhook_configs_safe  SET (security_invoker = true);
ALTER VIEW public.quiz_questions_safe   SET (security_invoker = true);

-- 2. Lock down quiz_questions column-level access
REVOKE SELECT ON public.quiz_questions FROM anon, authenticated;
GRANT SELECT (id, quiz_id, question, options, explanation, sort_order, created_at)
  ON public.quiz_questions TO authenticated;
-- correct_index intentionally NOT granted; only definer functions / superuser / service_role can read it

-- 3. Add SELECT policy so enrolled students (and owners) can read quiz_questions via the safe view
DROP POLICY IF EXISTS "Enrolled students view quiz_questions" ON public.quiz_questions;
CREATE POLICY "Enrolled students view quiz_questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.lessons l ON l.id = q.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_access ua
          WHERE ua.course_id = c.id
            AND ua.user_id = auth.uid()
            AND ua.status = 'active'
        )
      )
  )
);

-- Ensure service_role keeps full access
GRANT ALL ON public.quiz_questions TO service_role;
