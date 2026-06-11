-- Defense-in-depth: explicitly revoke column-level SELECT on quiz_questions.correct_index
-- from authenticated and anon roles, independent of RLS. Students must use the
-- get_quiz_questions_for_student / grade_quiz_attempt SECURITY DEFINER RPCs which
-- never expose correct_index to the client.
REVOKE SELECT (correct_index) ON public.quiz_questions FROM authenticated;
REVOKE SELECT (correct_index) ON public.quiz_questions FROM anon;
REVOKE INSERT (correct_index), UPDATE (correct_index) ON public.quiz_questions FROM anon;