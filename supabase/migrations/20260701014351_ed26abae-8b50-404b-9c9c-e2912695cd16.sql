
-- Pacote 2: Monitoramento e reconciliação

-- 1) Tabela de alertas admin
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unresolved ON public.admin_alerts (created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_kind ON public.admin_alerts (kind, created_at DESC);

GRANT SELECT, UPDATE ON public.admin_alerts TO authenticated;
GRANT ALL ON public.admin_alerts TO service_role;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view alerts" ON public.admin_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Admins update alerts" ON public.admin_alerts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper para não duplicar alerta aberto do mesmo tipo em 1h
CREATE OR REPLACE FUNCTION public.raise_admin_alert(_kind TEXT, _severity TEXT, _message TEXT, _metadata JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_alerts
    WHERE kind = _kind AND resolved_at IS NULL AND created_at > now() - INTERVAL '1 hour'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.admin_alerts (kind, severity, message, metadata)
  VALUES (_kind, _severity, _message, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

-- 2) Reconciliação de transações travadas (pending/processing > 2h e não é PIX ainda válido)
CREATE OR REPLACE FUNCTION public.reconcile_stuck_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stuck_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stuck_count
  FROM public.transactions
  WHERE status IN ('pending','processing')
    AND created_at < now() - INTERVAL '2 hours'
    AND (pix_expires_at IS NULL OR pix_expires_at < now());

  IF stuck_count > 0 THEN
    PERFORM public.raise_admin_alert(
      'stuck_transactions',
      CASE WHEN stuck_count > 100 THEN 'critical' ELSE 'warning' END,
      format('%s transações travadas em pending/processing há mais de 2h', stuck_count),
      jsonb_build_object('count', stuck_count)
    );
  END IF;
  RETURN stuck_count;
END;
$$;

-- 3) Reconciliação de saques travados (processing > 24h)
CREATE OR REPLACE FUNCTION public.reconcile_stuck_withdrawals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stuck_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stuck_count
  FROM public.withdrawals
  WHERE status IN ('processing','approved')
    AND created_at < now() - INTERVAL '24 hours';

  IF stuck_count > 0 THEN
    PERFORM public.raise_admin_alert(
      'stuck_withdrawals',
      'critical',
      format('%s saques travados em processing/approved há mais de 24h', stuck_count),
      jsonb_build_object('count', stuck_count)
    );
  END IF;
  RETURN stuck_count;
END;
$$;

-- 4) Rate de erros 500 (error_logs últimos 5 min)
CREATE OR REPLACE FUNCTION public.check_error_rate()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  err_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO err_count
  FROM public.error_logs
  WHERE created_at > now() - INTERVAL '5 minutes';

  IF err_count > 50 THEN
    PERFORM public.raise_admin_alert(
      'high_error_rate',
      CASE WHEN err_count > 200 THEN 'critical' ELSE 'warning' END,
      format('%s erros nos últimos 5 minutos', err_count),
      jsonb_build_object('count', err_count, 'window_minutes', 5)
    );
  END IF;
  RETURN err_count;
END;
$$;

-- 5) Uso de conexões DB
CREATE OR REPLACE FUNCTION public.check_db_connections()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used INTEGER;
  max_conn INTEGER;
  pct NUMERIC;
BEGIN
  SELECT COUNT(*) INTO used FROM pg_stat_activity;
  SELECT setting::INTEGER INTO max_conn FROM pg_settings WHERE name = 'max_connections';
  pct := ROUND((used::NUMERIC / NULLIF(max_conn,0)) * 100, 1);

  IF pct >= 80 THEN
    PERFORM public.raise_admin_alert(
      'db_connections_high',
      CASE WHEN pct >= 90 THEN 'critical' ELSE 'warning' END,
      format('Conexões DB em %s%% (%s/%s)', pct, used, max_conn),
      jsonb_build_object('used', used, 'max', max_conn, 'pct', pct)
    );
  END IF;
  RETURN used;
END;
$$;

-- 6) Crons falhos (cron.job_run_details última execução com status != succeeded)
CREATE OR REPLACE FUNCTION public.check_failed_crons()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  failed_count INTEGER;
  failed_list TEXT;
BEGIN
  WITH last_runs AS (
    SELECT DISTINCT ON (jobid) jobid, status, return_message, end_time
    FROM cron.job_run_details
    WHERE start_time > now() - INTERVAL '1 hour'
    ORDER BY jobid, start_time DESC
  ), failed AS (
    SELECT j.jobname, lr.return_message
    FROM last_runs lr
    JOIN cron.job j ON j.jobid = lr.jobid
    WHERE lr.status <> 'succeeded'
  )
  SELECT COUNT(*), string_agg(jobname, ', ') INTO failed_count, failed_list FROM failed;

  IF failed_count > 0 THEN
    PERFORM public.raise_admin_alert(
      'cron_failures',
      'critical',
      format('%s cron(s) falharam na última execução: %s', failed_count, failed_list),
      jsonb_build_object('count', failed_count, 'jobs', failed_list)
    );
  END IF;
  RETURN failed_count;
END;
$$;

-- 7) Runner consolidado (uma chamada por cron)
CREATE OR REPLACE FUNCTION public.run_monitoring_checks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  result := jsonb_build_object(
    'stuck_transactions', public.reconcile_stuck_transactions(),
    'stuck_withdrawals', public.reconcile_stuck_withdrawals(),
    'error_rate', public.check_error_rate(),
    'db_connections', public.check_db_connections(),
    'failed_crons', public.check_failed_crons(),
    'checked_at', now()
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.raise_admin_alert(TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_monitoring_checks() TO service_role;

-- 8) Cron: rodar checks a cada 5 minutos
SELECT cron.schedule(
  'run_monitoring_checks_every_5min',
  '*/5 * * * *',
  $$ SELECT public.run_monitoring_checks(); $$
);
