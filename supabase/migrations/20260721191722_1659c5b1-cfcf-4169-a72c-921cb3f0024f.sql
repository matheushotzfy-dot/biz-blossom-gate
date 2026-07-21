
-- Co-productions: harden email-matching policies
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
    AND lower(co_producer_email) = (
      SELECT lower(p.email) FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.email IS NOT NULL
      LIMIT 1
    )
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
    AND lower(co_producer_email) = (
      SELECT lower(p.email) FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.email IS NOT NULL
      LIMIT 1
    )
  )
)
WITH CHECK (
  (co_producer_user_id IS NOT NULL AND co_producer_user_id = auth.uid())
  OR (
    co_producer_user_id IS NULL
    AND co_producer_email IS NOT NULL
    AND lower(co_producer_email) = (
      SELECT lower(p.email) FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.email IS NOT NULL
      LIMIT 1
    )
  )
);

-- Retention settings: restrict global row to admins/managers only
DROP POLICY IF EXISTS "Authenticated can view global retention" ON public.retention_settings;

CREATE POLICY "Staff can view global retention"
ON public.retention_settings
FOR SELECT
TO authenticated
USING (
  user_id IS NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);
