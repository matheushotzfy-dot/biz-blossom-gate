CREATE OR REPLACE FUNCTION app_private.guard_balance_self_adjust()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id = NEW.admin_user_id OR NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido ajustar o próprio saldo' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_00_guard_balance_self_adjust ON public.balance_adjustments;
CREATE TRIGGER trg_00_guard_balance_self_adjust BEFORE INSERT OR UPDATE ON public.balance_adjustments
FOR EACH ROW EXECUTE FUNCTION app_private.guard_balance_self_adjust();

CREATE OR REPLACE FUNCTION app_private.guard_balance_request_self()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id = NEW.requested_by OR NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido ajustar o próprio saldo' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_00_guard_balance_request_self ON public.balance_adjustment_requests;
CREATE TRIGGER trg_00_guard_balance_request_self BEFORE INSERT ON public.balance_adjustment_requests
FOR EACH ROW EXECUTE FUNCTION app_private.guard_balance_request_self();

CREATE OR REPLACE FUNCTION public.issue_certificate_on_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _course_id uuid; _course_title text; _student_name text; _total integer; _completed integer; _code text;
BEGIN
  IF NEW.completed IS NOT TRUE OR (TG_OP = 'UPDATE' AND OLD.completed IS TRUE) THEN RETURN NEW; END IF;
  SELECT c.id, c.title INTO _course_id, _course_title
  FROM public.lessons l JOIN public.modules m ON m.id = l.module_id JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = NEW.lesson_id LIMIT 1;
  IF _course_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.certificates WHERE user_id = NEW.user_id AND course_id = _course_id) THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO _total FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _course_id;
  SELECT COUNT(*) INTO _completed FROM public.user_progress up JOIN public.lessons l ON l.id = up.lesson_id
    JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = _course_id AND up.user_id = NEW.user_id AND up.completed = true;
  -- Exige aprovação (corrigida no servidor) em todos os quizzes do curso.
  IF EXISTS (
    SELECT 1 FROM public.quizzes q JOIN public.lessons l ON l.id = q.lesson_id JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id
      AND NOT EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.quiz_id = q.id AND a.user_id = NEW.user_id AND a.passed = true)
  ) THEN RETURN NEW; END IF;
  IF _total > 0 AND _completed >= _total THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), COALESCE(nickname, 'Aluno')) INTO _student_name
    FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
    _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    INSERT INTO public.certificates (user_id, course_id, code, course_title, student_name, total_lessons)
    VALUES (NEW.user_id, _course_id, _code, COALESCE(_course_title, ''), COALESCE(_student_name, 'Aluno'), _total)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;