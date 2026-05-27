
-- 1. quiz_questions: remove direct student SELECT of correct_index
DROP POLICY IF EXISTS "Enrolled or owner view quiz_questions" ON public.quiz_questions;

CREATE POLICY "Owner or admin view quiz_questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM quizzes q
    JOIN lessons l ON l.id = q.lesson_id
    JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Safe RPC for enrolled students (no correct_index)
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_student(_quiz_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  question text,
  options jsonb,
  explanation text,
  sort_order integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
  _owner_id uuid;
BEGIN
  SELECT c.id, c.user_id INTO _course_id, _owner_id
  FROM quizzes q
  JOIN lessons l ON l.id = q.lesson_id
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE q.id = _quiz_id
  LIMIT 1;

  IF _course_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    _owner_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.course_id = _course_id
        AND ua.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT qq.id, qq.quiz_id, qq.question, qq.options, qq.explanation, qq.sort_order
  FROM quiz_questions qq
  WHERE qq.quiz_id = _quiz_id
  ORDER BY qq.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO authenticated;

-- Server-side grader so the client never needs correct_index
CREATE OR REPLACE FUNCTION public.grade_quiz_attempt(_quiz_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
  _owner_id uuid;
  _passing integer;
  _max_attempts integer;
  _attempt_count integer;
  _total integer;
  _correct integer := 0;
  _score integer;
  _passed boolean;
  _results jsonb := '[]'::jsonb;
  _q record;
  _user_choice integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.id, c.user_id, qz.passing_score, qz.max_attempts
  INTO _course_id, _owner_id, _passing, _max_attempts
  FROM quizzes qz
  JOIN lessons l ON l.id = qz.lesson_id
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE qz.id = _quiz_id
  LIMIT 1;

  IF _course_id IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  IF NOT (
    _owner_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.course_id = _course_id
        AND ua.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _max_attempts > 0 THEN
    SELECT COUNT(*) INTO _attempt_count
    FROM quiz_attempts
    WHERE quiz_id = _quiz_id AND user_id = auth.uid();
    IF _attempt_count >= _max_attempts THEN
      RAISE EXCEPTION 'Max attempts reached';
    END IF;
  END IF;

  SELECT COUNT(*) INTO _total FROM quiz_questions WHERE quiz_id = _quiz_id;
  IF _total = 0 THEN
    RAISE EXCEPTION 'No questions';
  END IF;

  FOR _q IN
    SELECT id, correct_index FROM quiz_questions WHERE quiz_id = _quiz_id ORDER BY sort_order
  LOOP
    _user_choice := NULLIF(_answers ->> _q.id::text, '')::integer;
    IF _user_choice IS NOT NULL AND _user_choice = _q.correct_index THEN
      _correct := _correct + 1;
      _results := _results || jsonb_build_object('question_id', _q.id, 'correct_index', _q.correct_index, 'is_correct', true);
    ELSE
      _results := _results || jsonb_build_object('question_id', _q.id, 'correct_index', _q.correct_index, 'is_correct', false);
    END IF;
  END LOOP;

  _score := ROUND((_correct::numeric / _total) * 100);
  _passed := _score >= _passing;

  INSERT INTO quiz_attempts (quiz_id, user_id, answers, score, passed)
  VALUES (_quiz_id, auth.uid(), _answers, _score, _passed);

  RETURN jsonb_build_object(
    'score', _score,
    'passed', _passed,
    'total', _total,
    'correct', _correct,
    'results', _results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_quiz_attempt(uuid, jsonb) TO authenticated;

-- 2. notifications: stop exposing broadcast (NULL user_id) rows to all users
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
