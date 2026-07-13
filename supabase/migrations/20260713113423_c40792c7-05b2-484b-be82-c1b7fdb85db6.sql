
DROP POLICY IF EXISTS "Service role manages podpay webhook events" ON public.podpay_webhook_events;
CREATE POLICY "Service role manages podpay webhook events"
  ON public.podpay_webhook_events
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "read_flag_updates" ON public.ticket_messages;
CREATE POLICY "read_flag_updates"
  ON public.ticket_messages
  FOR UPDATE
  USING (
    (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  )
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );
