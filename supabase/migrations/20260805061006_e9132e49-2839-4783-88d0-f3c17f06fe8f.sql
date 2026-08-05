DO $$
DECLARE
  proj_url text := 'https://glccldyjevnmoogakqxw.supabase.co';
  cron_secret text := 'd22ec61e3c41f5cb126b864c16bb3e202a172d4d01ea16017f0566fcb525a394';
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'veopag_poll_pending_every_2min';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'podpay_app_poll_pending_every_2min';

  PERFORM cron.schedule(
    'veopag_poll_pending_every_2min',
    '*/2 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 28000
      ) AS request_id;
    $cron$,
      proj_url || '/functions/v1/veopag-poll',
      json_build_object('Content-Type','application/json','x-cron-secret',cron_secret)::text
    )
  );

  PERFORM cron.schedule(
    'podpay_app_poll_pending_every_2min',
    '*/2 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 28000
      ) AS request_id;
    $cron$,
      proj_url || '/functions/v1/podpay-app-poll',
      json_build_object('Content-Type','application/json','x-cron-secret',cron_secret)::text
    )
  );
END $$;