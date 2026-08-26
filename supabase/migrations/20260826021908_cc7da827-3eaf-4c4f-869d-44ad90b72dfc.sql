WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY event_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.podpay_webhook_events
  WHERE event_id IS NOT NULL
)
DELETE FROM public.podpay_webhook_events p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_podpay_webhook_events_event_id
  ON public.podpay_webhook_events (event_id)
  WHERE event_id IS NOT NULL;