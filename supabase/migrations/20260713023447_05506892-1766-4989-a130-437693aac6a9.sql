
-- Threaded conversation for support tickets
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','staff')),
  sender_name TEXT,
  sender_role TEXT,
  body TEXT NOT NULL,
  read_by_customer BOOLEAN NOT NULL DEFAULT false,
  read_by_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender ON public.ticket_messages(sender_id);

GRANT SELECT, INSERT, UPDATE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Customer sees only their own ticket messages
CREATE POLICY "customer_reads_own_ticket_messages"
ON public.ticket_messages FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.support_tickets t
          WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
);

-- Customer inserts messages on their own ticket as 'customer'
CREATE POLICY "customer_inserts_own_ticket_messages"
ON public.ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (sender_type = 'customer' AND EXISTS (
       SELECT 1 FROM public.support_tickets t
       WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()
    ))
    OR (sender_type = 'staff' AND (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'manager')
       OR public.has_role(auth.uid(), 'employee')
    ))
  )
);

-- Only staff can mark customer-read flags on their side (update read_by_staff);
-- customer can mark read_by_customer on their own tickets
CREATE POLICY "read_flag_updates"
ON public.ticket_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.support_tickets t
          WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
)
WITH CHECK (true);

-- Backfill: turn existing single message + admin_reply into thread messages
INSERT INTO public.ticket_messages (ticket_id, sender_id, sender_type, sender_name, sender_role, body, read_by_customer, read_by_staff, created_at)
SELECT t.id, t.user_id, 'customer', NULL, NULL, t.message, true, true, t.created_at
FROM public.support_tickets t
WHERE NOT EXISTS (SELECT 1 FROM public.ticket_messages m WHERE m.ticket_id = t.id);

INSERT INTO public.ticket_messages (ticket_id, sender_id, sender_type, sender_name, sender_role, body, read_by_customer, read_by_staff, created_at)
SELECT t.id, COALESCE(t.admin_user_id, t.user_id), 'staff', t.admin_name, t.admin_role, t.admin_reply, true, true, COALESCE(t.replied_at, t.created_at)
FROM public.support_tickets t
WHERE t.admin_reply IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_messages m
    WHERE m.ticket_id = t.id AND m.sender_type = 'staff'
  );

-- Add last_message_at for sorting inbox
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unread_by_staff INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_by_customer INT NOT NULL DEFAULT 0;

UPDATE public.support_tickets
SET last_message_at = COALESCE(replied_at, created_at)
WHERE last_message_at IS NULL;

-- Trigger to keep last_message_at + unread counts in sync
CREATE OR REPLACE FUNCTION public.sync_ticket_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'customer' THEN
    UPDATE public.support_tickets
      SET last_message_at = NEW.created_at,
          unread_by_staff = unread_by_staff + 1,
          status = CASE WHEN status IN ('closed','resolved') THEN 'open' ELSE status END
      WHERE id = NEW.ticket_id;
  ELSE
    UPDATE public.support_tickets
      SET last_message_at = NEW.created_at,
          unread_by_customer = unread_by_customer + 1,
          status = 'answered',
          replied_at = NEW.created_at,
          admin_reply = NEW.body,
          admin_user_id = NEW.sender_id,
          admin_name = NEW.sender_name,
          admin_role = NEW.sender_role
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ticket_on_message ON public.ticket_messages;
CREATE TRIGGER trg_sync_ticket_on_message
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_on_message();
