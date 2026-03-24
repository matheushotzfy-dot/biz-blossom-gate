
-- Storage bucket for course content (videos, attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('course-content', 'course-content', true, 524288000)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for course-content bucket
CREATE POLICY "Authenticated users can upload course content"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-content' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can update own course content"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-content' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete own course content"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-content' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view course content"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'course-content');

-- Lesson attachments table
CREATE TABLE public.lesson_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;

-- RLS for lesson_attachments
CREATE POLICY "Users manage own lesson attachments"
ON public.lesson_attachments FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all lesson attachments"
ON public.lesson_attachments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_all_lesson_attachments"
ON public.lesson_attachments FOR ALL TO anon
USING (false) WITH CHECK (false);
