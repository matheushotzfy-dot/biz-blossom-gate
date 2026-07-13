
-- 1) Attachments column on ticket messages
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Storage RLS policies for ticket-attachments bucket
-- Path convention: <ticket_id>/<uuid>-<filename>
-- Access: ticket owner OR any staff (admin/manager/employee)

DROP POLICY IF EXISTS "ticket_attachments_select" ON storage.objects;
CREATE POLICY "ticket_attachments_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id::text = (storage.foldername(name))[1]
        AND st.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'employee')
  )
);

DROP POLICY IF EXISTS "ticket_attachments_insert" ON storage.objects;
CREATE POLICY "ticket_attachments_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id::text = (storage.foldername(name))[1]
        AND st.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'employee')
  )
);

DROP POLICY IF EXISTS "ticket_attachments_delete" ON storage.objects;
CREATE POLICY "ticket_attachments_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id::text = (storage.foldername(name))[1]
        AND st.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'employee')
  )
);
