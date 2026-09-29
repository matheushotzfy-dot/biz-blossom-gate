DO $$
DECLARE
  target_job RECORD;
BEGIN
  FOR target_job IN
    SELECT jobid
    FROM cron.job
    WHERE lower(jobname) IN ('veopag_poll_pending_every_2min', 'podpay_app_poll_pending_every_2min')
       OR lower(command) LIKE '%veopag-poll%'
       OR lower(command) LIKE '%podpay-app-poll%'
  LOOP
    PERFORM cron.unschedule(target_job.jobid);
  END LOOP;
END
$$;