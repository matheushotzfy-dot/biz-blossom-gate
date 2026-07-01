
CREATE OR REPLACE FUNCTION public.expire_stale_pix_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.transactions
  SET status = 'expired', updated_at = now()
  WHERE payment_method = 'pix'
    AND status IN ('pending', 'waiting_payment')
    AND (
      (pix_expires_at IS NOT NULL AND pix_expires_at < now())
      OR (pix_expires_at IS NULL AND created_at < now() - interval '1 hour')
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_pix_transactions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_pix_transactions() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('expire_stale_pix_every_5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire_stale_pix_every_5min',
  '*/5 * * * *',
  $$SELECT public.expire_stale_pix_transactions();$$
);
