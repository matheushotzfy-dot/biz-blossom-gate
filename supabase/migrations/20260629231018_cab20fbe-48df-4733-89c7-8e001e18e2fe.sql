ALTER TABLE public.app_deliveries DROP CONSTRAINT IF EXISTS app_deliveries_status_check;
ALTER TABLE public.app_deliveries
  ADD CONSTRAINT app_deliveries_status_check
  CHECK (status IN ('pending','processing','delivered','exhausted','failed'));

CREATE OR REPLACE FUNCTION public.claim_app_deliveries(_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  integration_id uuid,
  user_id uuid,
  transaction_id uuid,
  app_name text,
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
    FROM public.app_deliveries d
    WHERE d.status = 'pending'
      AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
    ORDER BY d.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.app_deliveries d
     SET status = 'processing', updated_at = now()
    FROM claimed
   WHERE d.id = claimed.id
  RETURNING d.id, d.integration_id, d.user_id, d.transaction_id, d.app_name, d.event, d.payload, d.attempt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_app_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_app_deliveries(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.reap_stuck_app_deliveries()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reaped AS (
    UPDATE public.app_deliveries
       SET status = 'pending', next_retry_at = now()
     WHERE status = 'processing'
       AND updated_at < now() - interval '5 minutes'
    RETURNING 1
  )
  SELECT COALESCE(COUNT(*), 0)::int FROM reaped;
$$;
REVOKE EXECUTE ON FUNCTION public.reap_stuck_app_deliveries() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reap_stuck_app_deliveries() TO service_role;