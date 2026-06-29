-- Allow 'processing' status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%webhook_deliveries_status%'
  ) THEN
    ALTER TABLE public.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;
  END IF;
END $$;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending','processing','success','exhausted','failed'));

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  webhook_config_id uuid,
  user_id uuid,
  transaction_id uuid,
  event text,
  payload jsonb,
  attempt integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT d.id
    FROM public.webhook_deliveries d
    WHERE d.status = 'pending'
      AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
    ORDER BY d.next_retry_at NULLS FIRST
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.webhook_deliveries d
     SET status = 'processing', updated_at = now()
    FROM claimed
   WHERE d.id = claimed.id
  RETURNING d.id, d.webhook_config_id, d.user_id, d.transaction_id, d.event, d.payload, d.attempt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_webhook_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_webhook_deliveries(integer) TO service_role;

-- Reaper: stuck 'processing' for more than 5 minutes → back to pending for retry
CREATE OR REPLACE FUNCTION public.reap_stuck_webhook_deliveries()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reaped AS (
    UPDATE public.webhook_deliveries
       SET status = 'pending', next_retry_at = now()
     WHERE status = 'processing'
       AND updated_at < now() - interval '5 minutes'
    RETURNING 1
  )
  SELECT COALESCE(COUNT(*), 0)::int FROM reaped;
$$;
REVOKE EXECUTE ON FUNCTION public.reap_stuck_webhook_deliveries() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reap_stuck_webhook_deliveries() TO service_role;