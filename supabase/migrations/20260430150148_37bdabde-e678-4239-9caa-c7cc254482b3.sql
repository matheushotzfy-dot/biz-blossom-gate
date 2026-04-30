
-- ════════════════════════════════════════════════════════════════
-- LESSON COMMENTS — Q&A by lesson
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.lesson_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON public.lesson_comments(lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_user ON public.lesson_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent ON public.lesson_comments(parent_id);

ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

-- Sanitize + length validation
CREATE OR REPLACE FUNCTION public.sanitize_lesson_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.content := regexp_replace(NEW.content, '<[^>]*>', '', 'g');
  NEW.content := regexp_replace(NEW.content, 'javascript:', '', 'gi');
  NEW.content := left(trim(NEW.content), 2000);
  IF length(trim(NEW.content)) < 1 THEN RAISE EXCEPTION 'Comment cannot be empty'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sanitize_lesson_comment() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS sanitize_lesson_comment_trigger ON public.lesson_comments;
CREATE TRIGGER sanitize_lesson_comment_trigger
BEFORE INSERT OR UPDATE ON public.lesson_comments
FOR EACH ROW EXECUTE FUNCTION public.sanitize_lesson_comment();

-- RLS: anyone with access to the lesson reads
CREATE POLICY "View comments of accessible lessons"
ON public.lesson_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = lesson_comments.lesson_id
      AND (
        c.user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR (c.is_published = true AND (
          c.product_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.user_access ua
            WHERE ua.course_id = c.id AND ua.user_id = auth.uid() AND ua.status = 'active'
          )
        ))
      )
  )
);

CREATE POLICY "Users insert own comments"
ON public.lesson_comments FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = lesson_comments.lesson_id
      AND (
        c.user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR (c.is_published = true AND (
          c.product_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.user_access ua
            WHERE ua.course_id = c.id AND ua.user_id = auth.uid() AND ua.status = 'active'
          )
        ))
      )
  )
);

CREATE POLICY "Users update own comments"
ON public.lesson_comments FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own comments"
ON public.lesson_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Course owners moderate comments"
ON public.lesson_comments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = lesson_comments.lesson_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all comments"
ON public.lesson_comments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_all_lesson_comments"
ON public.lesson_comments AS RESTRICTIVE FOR ALL
TO anon USING (false) WITH CHECK (false);

-- ════════════════════════════════════════════════════════════════
-- CERTIFICATES — auto-issued on course completion
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  course_title text NOT NULL DEFAULT '',
  student_name text NOT NULL DEFAULT '',
  total_lessons integer NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON public.certificates(code);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Public read by code (verification page) — but no enumeration: only via known code
CREATE POLICY "Public can verify certificates by code"
ON public.certificates FOR SELECT
TO anon, authenticated
USING (true);

-- Only system inserts (via trigger SECURITY DEFINER)
CREATE POLICY "deny_direct_insert_certificates"
ON public.certificates AS RESTRICTIVE FOR INSERT
TO authenticated WITH CHECK (false);

CREATE POLICY "deny_direct_update_certificates"
ON public.certificates AS RESTRICTIVE FOR UPDATE
TO authenticated USING (false);

CREATE POLICY "deny_direct_delete_certificates"
ON public.certificates AS RESTRICTIVE FOR DELETE
TO authenticated USING (false);

CREATE POLICY "Admins manage certificates"
ON public.certificates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ════════════════════════════════════════════════════════════════
-- TRIGGER — issue certificate when course is 100% complete
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.issue_certificate_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
  _course_title text;
  _student_name text;
  _total integer;
  _completed integer;
  _code text;
BEGIN
  -- Only when transitioning to completed
  IF NEW.completed IS NOT TRUE OR (TG_OP = 'UPDATE' AND OLD.completed IS TRUE) THEN
    RETURN NEW;
  END IF;

  -- Find the course for this lesson
  SELECT c.id, c.title INTO _course_id, _course_title
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = NEW.lesson_id
  LIMIT 1;

  IF _course_id IS NULL THEN RETURN NEW; END IF;

  -- Skip if certificate already issued
  IF EXISTS (SELECT 1 FROM public.certificates WHERE user_id = NEW.user_id AND course_id = _course_id) THEN
    RETURN NEW;
  END IF;

  -- Count totals
  SELECT COUNT(*) INTO _total
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = _course_id;

  SELECT COUNT(*) INTO _completed
  FROM public.user_progress up
  JOIN public.lessons l ON l.id = up.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = _course_id AND up.user_id = NEW.user_id AND up.completed = true;

  IF _total > 0 AND _completed >= _total THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), COALESCE(nickname, 'Aluno'))
    INTO _student_name
    FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

    _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

    INSERT INTO public.certificates (user_id, course_id, code, course_title, student_name, total_lessons)
    VALUES (NEW.user_id, _course_id, _code, COALESCE(_course_title, ''), COALESCE(_student_name, 'Aluno'), _total)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.issue_certificate_on_completion() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS issue_certificate_trigger ON public.user_progress;
CREATE TRIGGER issue_certificate_trigger
AFTER INSERT OR UPDATE OF completed ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.issue_certificate_on_completion();
