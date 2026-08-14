
DROP POLICY IF EXISTS "Co-producers view own invites" ON public.co_productions;
DROP POLICY IF EXISTS "Co-producers update own status" ON public.co_productions;

CREATE POLICY "Co-producers view own invites"
ON public.co_productions
FOR SELECT
TO authenticated
USING (
  (co_producer_user_id IS NOT NULL AND co_producer_user_id = auth.uid())
  OR (
    co_producer_user_id IS NULL
    AND co_producer_email IS NOT NULL
    AND auth.email() IS NOT NULL
    AND lower(co_producer_email) = lower(auth.email())
  )
);

CREATE POLICY "Co-producers update own status"
ON public.co_productions
FOR UPDATE
TO authenticated
USING (
  (co_producer_user_id IS NOT NULL AND co_producer_user_id = auth.uid())
  OR (
    co_producer_user_id IS NULL
    AND co_producer_email IS NOT NULL
    AND auth.email() IS NOT NULL
    AND lower(co_producer_email) = lower(auth.email())
  )
)
WITH CHECK (
  (co_producer_user_id IS NOT NULL AND co_producer_user_id = auth.uid())
  OR (
    co_producer_user_id IS NULL
    AND co_producer_email IS NOT NULL
    AND auth.email() IS NOT NULL
    AND lower(co_producer_email) = lower(auth.email())
  )
);

REVOKE ALL ON FUNCTION public.get_quiz_questions_for_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO authenticated;
