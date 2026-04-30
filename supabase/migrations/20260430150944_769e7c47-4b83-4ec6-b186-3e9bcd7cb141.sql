
-- ============= SPRINT 2: QUIZZES, NOTAS, ANALYTICS =============

-- 1. QUIZZES
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
  max_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id)
);

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0),
  explanation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id, quiz_id);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Owners (course owners) manage quizzes
CREATE POLICY "Owners manage quizzes" ON public.quizzes
FOR ALL USING (EXISTS (
  SELECT 1 FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE l.id = quizzes.lesson_id AND c.user_id = auth.uid()
));

CREATE POLICY "Anyone with lesson access views quizzes" ON public.quizzes
FOR SELECT USING (EXISTS (
  SELECT 1 FROM lessons l WHERE l.id = quizzes.lesson_id
));

CREATE POLICY "Owners manage quiz_questions" ON public.quiz_questions
FOR ALL USING (EXISTS (
  SELECT 1 FROM quizzes q
  JOIN lessons l ON l.id = q.lesson_id
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE q.id = quiz_questions.quiz_id AND c.user_id = auth.uid()
));

CREATE POLICY "Students view quiz questions" ON public.quiz_questions
FOR SELECT USING (true);

CREATE POLICY "Users manage own attempts" ON public.quiz_attempts
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners view attempts on their quizzes" ON public.quiz_attempts
FOR SELECT USING (EXISTS (
  SELECT 1 FROM quizzes q
  JOIN lessons l ON l.id = q.lesson_id
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE q.id = quiz_attempts.quiz_id AND c.user_id = auth.uid()
));

CREATE TRIGGER trg_quizzes_updated
BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. LESSON NOTES
CREATE TABLE public.lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_notes_user_lesson ON public.lesson_notes(user_id, lesson_id);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes" ON public.lesson_notes
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_lesson_notes_updated
BEFORE UPDATE ON public.lesson_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. ANALYTICS RPC FOR PRODUCERS
CREATE OR REPLACE FUNCTION public.get_course_analytics(_course_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSONB;
  _is_owner BOOLEAN;
BEGIN
  SELECT (user_id = auth.uid()) INTO _is_owner FROM courses WHERE id = _course_id;
  IF NOT COALESCE(_is_owner, false) AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'total_lessons', (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = _course_id),
    'total_students', (
      SELECT COUNT(DISTINCT up.user_id) FROM user_progress up
      JOIN lessons l ON l.id = up.lesson_id
      JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = _course_id
    ),
    'active_7d', (
      SELECT COUNT(DISTINCT up.user_id) FROM user_progress up
      JOIN lessons l ON l.id = up.lesson_id
      JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = _course_id AND up.updated_at > now() - interval '7 days'
    ),
    'completions', (
      SELECT COUNT(*) FROM certificates WHERE course_id = _course_id
    ),
    'total_comments', (
      SELECT COUNT(*) FROM lesson_comments lc
      JOIN lessons l ON l.id = lc.lesson_id
      JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = _course_id
    ),
    'avg_quiz_score', (
      SELECT COALESCE(ROUND(AVG(qa.score)::numeric, 1), 0) FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      JOIN lessons l ON l.id = q.lesson_id
      JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = _course_id
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_course_analytics(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_course_analytics(UUID) TO authenticated;
