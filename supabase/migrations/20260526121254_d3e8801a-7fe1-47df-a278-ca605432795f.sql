
-- =========== CERTIFICATES ===========
DROP POLICY IF EXISTS "Public can verify certificates by code" ON public.certificates;

CREATE POLICY "Owners view own certificates"
ON public.certificates
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE(
  id uuid,
  code text,
  course_title text,
  student_name text,
  total_lessons integer,
  issued_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.course_title, c.student_name, c.total_lessons, c.issued_at
  FROM public.certificates c
  WHERE c.code = upper(_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- =========== QUIZZES / QUIZ_QUESTIONS ===========
DROP POLICY IF EXISTS "Anyone with lesson access views quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Students view quiz questions" ON public.quiz_questions;

CREATE POLICY "Enrolled or owner view quizzes"
ON public.quizzes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = quizzes.lesson_id
      AND (
        c.user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.user_access ua
          WHERE ua.user_id = auth.uid()
            AND ua.course_id = c.id
            AND ua.status = 'active'
        )
      )
  )
);

CREATE POLICY "Enrolled or owner view quiz_questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.lessons l ON l.id = q.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (
        c.user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.user_access ua
          WHERE ua.user_id = auth.uid()
            AND ua.course_id = c.id
            AND ua.status = 'active'
        )
      )
  )
);

-- =========== SECURITY DEFINER EXECUTE HARDENING ===========
-- Revoke from PUBLIC then re-grant only what is required client-side.
REVOKE EXECUTE ON FUNCTION public.get_course_analytics(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ledger_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_velocity(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_blacklist(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_affiliate_product_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_product_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_has_role(app_role) FROM PUBLIC, anon;

-- Public-facing helpers keep what they need:
-- check_signup_conflicts: used from anon signup screen
-- get_checkout_status: used from anon public checkout
-- has_role: used implicitly inside policies (already SECURITY DEFINER)
