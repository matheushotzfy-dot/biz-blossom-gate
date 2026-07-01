CREATE TABLE IF NOT EXISTS public.podpay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  podpay_payment_id text,
  signature text,
  signature_valid boolean NOT NULL DEFAULT false,
  raw_payload jsonb NOT NULL,
  headers jsonb,
  processing_result text NOT NULL DEFAULT 'received',
  error text,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podpay_webhook_events_created_at ON public.podpay_webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podpay_webhook_events_event_id ON public.podpay_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_podpay_webhook_events_tx ON public.podpay_webhook_events(transaction_id);

GRANT ALL ON public.podpay_webhook_events TO service_role;
GRANT SELECT ON public.podpay_webhook_events TO authenticated;

ALTER TABLE public.podpay_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view podpay webhook events"
  ON public.podpay_webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Service role manages podpay webhook events"
  ON public.podpay_webhook_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
