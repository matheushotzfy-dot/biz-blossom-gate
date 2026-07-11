CREATE OR REPLACE FUNCTION public.reconcile_stuck_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_count INTEGER;
  stuck_count INTEGER;
BEGIN
  -- Step 1: auto-expire PIX transactions that are truly past their expiry
  -- (either pix_expires_at passed, or older than 24h without any expiry set).
  WITH exp AS (
    UPDATE public.transactions
       SET status = 'expired',
           updated_at = now()
     WHERE status IN ('pending','processing')
       AND payment_method = 'pix'
       AND (
         (pix_expires_at IS NOT NULL AND pix_expires_at < now())
         OR (pix_expires_at IS NULL AND created_at < now() - INTERVAL '24 hours')
       )
    RETURNING 1
  )
  SELECT count(*) INTO expired_count FROM exp;

  -- Step 2: count what remains genuinely stuck (mostly card/boleto with no callback)
  SELECT COUNT(*) INTO stuck_count
  FROM public.transactions
  WHERE status IN ('pending','processing')
    AND created_at < now() - INTERVAL '2 hours';

  IF stuck_count > 0 THEN
    PERFORM public.raise_admin_alert(
      'stuck_transactions',
      CASE WHEN stuck_count > 100 THEN 'critical' ELSE 'warning' END,
      format('%s transações travadas em pending/processing há mais de 2h (após auto-expirar %s PIX vencidos)', stuck_count, expired_count),
      jsonb_build_object('count', stuck_count, 'auto_expired', expired_count)
    );
  END IF;

  RETURN stuck_count;
END;
$$;