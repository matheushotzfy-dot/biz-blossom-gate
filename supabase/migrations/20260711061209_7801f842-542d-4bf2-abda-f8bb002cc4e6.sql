CREATE OR REPLACE FUNCTION public.check_failed_crons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  failed_count INTEGER := 0;
  failed_list TEXT;
BEGIN
  WITH monitored_jobs AS (
    SELECT jobid, jobname
    FROM cron.job
    WHERE active = true
      AND jobname IN (
        'release_due_card_holds_every_5min',
        'run_monitoring_checks_every_5min',
        'expire_stale_pix_every_5min'
      )
  ), last_finished_runs AS (
    SELECT DISTINCT ON (d.jobid)
      d.jobid,
      d.status,
      d.return_message,
      d.start_time,
      d.end_time
    FROM cron.job_run_details d
    JOIN monitored_jobs j ON j.jobid = d.jobid
    WHERE d.start_time > now() - INTERVAL '2 hours'
      AND d.end_time IS NOT NULL
    ORDER BY d.jobid, d.start_time DESC
  ), failed AS (
    SELECT j.jobname, lfr.return_message
    FROM monitored_jobs j
    LEFT JOIN last_finished_runs lfr ON lfr.jobid = j.jobid
    WHERE lfr.jobid IS NULL
       OR lfr.status <> 'succeeded'
       OR lfr.end_time < now() - INTERVAL '20 minutes'
  )
  SELECT COUNT(*), string_agg(jobname, ', ')
  INTO failed_count, failed_list
  FROM failed;

  IF failed_count > 0 THEN
    PERFORM public.raise_admin_alert(
      'cron_failures',
      'critical',
      format('%s cron(s) falharam na última execução: %s', failed_count, failed_list),
      jsonb_build_object('count', failed_count, 'jobs', failed_list)
    );
  ELSE
    UPDATE public.admin_alerts
    SET resolved_at = COALESCE(resolved_at, now())
    WHERE kind = 'cron_failures'
      AND resolved_at IS NULL;
  END IF;

  RETURN failed_count;
END;
$function$;