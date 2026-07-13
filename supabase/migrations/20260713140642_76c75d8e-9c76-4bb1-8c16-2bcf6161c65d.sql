CREATE OR REPLACE FUNCTION public.expire_stale_pix_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH batch AS (
    SELECT id
    FROM public.transactions
    WHERE payment_method = 'pix'
      AND status IN ('pending', 'waiting_payment')
      AND (
        (pix_expires_at IS NOT NULL AND pix_expires_at < now())
        OR (pix_expires_at IS NULL AND created_at < now() - interval '24 hours')
      )
    LIMIT 5000
  )
  UPDATE public.transactions t
  SET status = 'expired', updated_at = now()
  FROM batch
  WHERE t.id = batch.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_pix_transactions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_pix_transactions() TO service_role;