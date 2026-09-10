-- lovable-cron-fallback-reviewed: 1440 runs/day; limpeza temporária e limitada de mais de um milhão de registros, com desligamento automático ao zerar.
CREATE OR REPLACE FUNCTION public.cleanup_simulated_transactions_batch()
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, cron
SET statement_timeout = '50s'
AS $$
DECLARE
  _removed bigint := 0;
  _remaining bigint := 0;
  _job_id bigint;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS cleanup_simulated_ids(id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE cleanup_simulated_ids;
  INSERT INTO cleanup_simulated_ids(id)
  SELECT id FROM public.transactions
  WHERE is_simulated = true
  ORDER BY created_at, id
  LIMIT 20000;

  DELETE FROM public.webhook_deliveries w USING cleanup_simulated_ids s WHERE w.transaction_id = s.id;
  DELETE FROM public.affiliate_sales a USING cleanup_simulated_ids s WHERE a.transaction_id = s.id;
  DELETE FROM public.user_access u USING cleanup_simulated_ids s WHERE u.transaction_id = s.id;
  DELETE FROM public.disputes d USING cleanup_simulated_ids s WHERE d.transaction_id = s.id;
  DELETE FROM public.financial_ledger l USING cleanup_simulated_ids s WHERE l.transaction_id = s.id;
  DELETE FROM public.app_deliveries a USING cleanup_simulated_ids s WHERE a.transaction_id = s.id;
  DELETE FROM public.transactions t USING cleanup_simulated_ids s WHERE t.id = s.id;
  GET DIAGNOSTICS _removed = ROW_COUNT;

  SELECT count(*) INTO _remaining FROM public.transactions WHERE is_simulated = true;
  IF _remaining = 0 THEN
    SELECT jobid INTO _job_id FROM cron.job WHERE jobname = 'cleanup_simulated_transactions' LIMIT 1;
    IF _job_id IS NOT NULL THEN PERFORM cron.unschedule(_job_id); END IF;
    DROP FUNCTION IF EXISTS public.cleanup_simulated_transactions_batch();
  END IF;
  RETURN _removed;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_simulated_transactions_batch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_simulated_transactions_batch() TO service_role, postgres;

DO $$
DECLARE _existing bigint;
BEGIN
  SELECT jobid INTO _existing FROM cron.job WHERE jobname='cleanup_simulated_transactions' LIMIT 1;
  IF _existing IS NOT NULL THEN PERFORM cron.unschedule(_existing); END IF;
  PERFORM cron.schedule('cleanup_simulated_transactions','* * * * *','SELECT public.cleanup_simulated_transactions_batch();');
END $$;