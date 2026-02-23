
-- ========================================
-- MEMBER AREA: Courses, Modules, Lessons
-- ========================================

-- Courses (linked to a product for access control)
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- creator/owner
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  category text DEFAULT 'geral',
  is_published boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Modules (seasons/sections within a course)
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lessons (episodes/classes within a module)
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text, -- YouTube unlisted URL
  duration_minutes int DEFAULT 0,
  is_free boolean DEFAULT false, -- free preview lessons
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User access (granted on purchase, revoked on chargeback)
CREATE TABLE public.user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id),
  status text NOT NULL DEFAULT 'active', -- active, revoked, expired
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(user_id, course_id)
);

-- User progress (track lesson completion)
CREATE TABLE public.user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  progress_seconds int DEFAULT 0,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- ========================================
-- ENABLE RLS
-- ========================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES: Courses
-- ========================================
-- Owners can manage their courses
CREATE POLICY "Owners manage courses" ON public.courses FOR ALL USING (auth.uid() = user_id);
-- Admins can manage all courses
CREATE POLICY "Admins manage courses" ON public.courses FOR ALL USING (has_role(auth.uid(), 'admin'));
-- Published courses visible to anyone with access
CREATE POLICY "Members view published courses" ON public.courses FOR SELECT
  USING (is_published = true AND EXISTS (
    SELECT 1 FROM public.user_access WHERE user_access.course_id = courses.id AND user_access.user_id = auth.uid() AND user_access.status = 'active'
  ));
-- Free courses visible to all authenticated
CREATE POLICY "Published courses visible" ON public.courses FOR SELECT
  USING (is_published = true AND product_id IS NULL);

-- ========================================
-- RLS POLICIES: Modules
-- ========================================
CREATE POLICY "View modules of accessible courses" ON public.modules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND (
      c.user_id = auth.uid() OR
      has_role(auth.uid(), 'admin') OR
      (c.is_published = true AND (c.product_id IS NULL OR EXISTS (
        SELECT 1 FROM public.user_access ua WHERE ua.course_id = c.id AND ua.user_id = auth.uid() AND ua.status = 'active'
      )))
    )
  ));
CREATE POLICY "Owners manage modules" ON public.modules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins manage modules" ON public.modules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- ========================================
-- RLS POLICIES: Lessons
-- ========================================
CREATE POLICY "View lessons of accessible courses" ON public.lessons FOR SELECT
  USING (
    is_free = true OR
    EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND (
        c.user_id = auth.uid() OR
        has_role(auth.uid(), 'admin') OR
        (c.is_published = true AND (c.product_id IS NULL OR EXISTS (
          SELECT 1 FROM public.user_access ua WHERE ua.course_id = c.id AND ua.user_id = auth.uid() AND ua.status = 'active'
        )))
      )
    )
  );
CREATE POLICY "Owners manage lessons" ON public.lessons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id WHERE m.id = lessons.module_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "Admins manage lessons" ON public.lessons FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- ========================================
-- RLS POLICIES: User Access
-- ========================================
CREATE POLICY "Users view own access" ON public.user_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage access" ON public.user_access FOR ALL USING (has_role(auth.uid(), 'admin'));
-- Service role handles inserts from edge functions (bypasses RLS)

-- ========================================
-- RLS POLICIES: User Progress
-- ========================================
CREATE POLICY "Users manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = user_id);

-- ========================================
-- TRIGGERS
-- ========================================
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- FUNCTION: Auto-grant access on payment
-- ========================================
CREATE OR REPLACE FUNCTION public.grant_access_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Find course linked to this product
    SELECT id INTO _course_id FROM public.courses WHERE product_id = NEW.product_id LIMIT 1;
    
    IF _course_id IS NOT NULL THEN
      -- Find the buyer's user_id from customer_email
      -- The transaction has customer_email, we need to find the auth user
      -- For now, grant to any user with matching email
      DECLARE
        _buyer_id uuid;
      BEGIN
        SELECT au.id INTO _buyer_id FROM auth.users au WHERE au.email = NEW.customer_email LIMIT 1;
        
        IF _buyer_id IS NOT NULL THEN
          INSERT INTO public.user_access (user_id, course_id, transaction_id, status)
          VALUES (_buyer_id, _course_id, NEW.id, 'active')
          ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', revoked_at = NULL;
        END IF;
      END;
    END IF;
  END IF;

  -- Revoke access on chargeback/refund
  IF NEW.status IN ('chargeback', 'refunded') AND OLD.status = 'completed' THEN
    UPDATE public.user_access SET status = 'revoked', revoked_at = now()
    WHERE transaction_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_grant_access_on_payment
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.grant_access_on_payment();
