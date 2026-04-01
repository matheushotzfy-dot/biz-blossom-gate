
-- =============================================
-- 1. Fix course-content: more precise access check
-- =============================================
DROP POLICY IF EXISTS "Course content viewable by owner or enrolled students" ON storage.objects;

CREATE POLICY "Course content viewable by owner or enrolled students"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-content' AND (
    -- Owner of the content (files stored under their user_id)
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Admin access
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Enrolled student: folder owner has a course the student has SPECIFIC access to
    -- Files are stored as {owner_user_id}/{course_id}/... so check 2nd segment
    EXISTS (
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.status = 'active'
        AND ua.course_id::text = (storage.foldername(name))[2]
    )
  )
);

-- =============================================
-- 2. Remove notifications from Realtime to avoid channel auth issues
-- =============================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
