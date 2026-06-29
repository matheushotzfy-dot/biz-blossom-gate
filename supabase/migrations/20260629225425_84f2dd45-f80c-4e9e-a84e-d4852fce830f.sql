-- Schedule periodic release of card retention holds every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove old job if exists (avoid duplicates)
DO $$
DECLARE
  _jobid bigint;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'release_due_card_holds_every_5min';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'release_due_card_holds_every_5min',
  '*/5 * * * *',
  $$ SELECT public.release_due_card_holds(); $$
);

-- Run once now to flush any backlog
SELECT public.release_due_card_holds();