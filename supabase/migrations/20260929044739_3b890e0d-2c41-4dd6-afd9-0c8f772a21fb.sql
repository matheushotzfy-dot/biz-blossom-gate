DROP POLICY IF EXISTS public_product_catalog_read ON public.public_product_catalog;
CREATE POLICY public_product_catalog_read
ON public.public_product_catalog
FOR SELECT TO anon, authenticated
USING (
  status = 'active'
  AND checkout_url IS NOT NULL
  AND btrim(checkout_url) <> ''
);

DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS race_assets_read_authenticated ON storage.objects;
CREATE POLICY race_assets_read_authenticated
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'race-assets'
  AND auth.uid() IS NOT NULL
  AND (
    owner_id = auth.uid()::text
    OR app_private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.revenue_races r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.is_active = true
    )
  )
);

CREATE TABLE public.security_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('database', 'catalog', 'storage')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'analyzed', 'failed', 'resolved')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  ai_summary TEXT,
  ai_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_run_id TEXT,
  error_message TEXT,
  analyzed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_findings TO authenticated;
GRANT ALL ON public.security_findings TO service_role;
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_findings_admin_select ON public.security_findings
FOR SELECT TO authenticated
USING (public.current_user_has_role('admin'::public.app_role));
CREATE POLICY security_findings_admin_insert ON public.security_findings
FOR INSERT TO authenticated
WITH CHECK (public.current_user_has_role('admin'::public.app_role) AND created_by = auth.uid());
CREATE POLICY security_findings_admin_update ON public.security_findings
FOR UPDATE TO authenticated
USING (public.current_user_has_role('admin'::public.app_role))
WITH CHECK (public.current_user_has_role('admin'::public.app_role));
CREATE POLICY security_findings_admin_delete ON public.security_findings
FOR DELETE TO authenticated
USING (public.current_user_has_role('admin'::public.app_role));
CREATE INDEX security_findings_status_created_idx ON public.security_findings (status, created_at DESC);
CREATE INDEX security_findings_risk_created_idx ON public.security_findings (risk_level, created_at DESC);

CREATE OR REPLACE FUNCTION public.security_findings_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.security_findings_touch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_findings_touch() TO service_role;
CREATE TRIGGER security_findings_touch_before_update
BEFORE UPDATE ON public.security_findings
FOR EACH ROW EXECUTE FUNCTION public.security_findings_touch();

CREATE OR REPLACE FUNCTION public.raise_admin_alert(_kind TEXT, _severity TEXT, _message TEXT, _metadata JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_id UUID;
BEGIN
  SELECT id INTO _existing_id
  FROM public.admin_alerts
  WHERE kind = _kind AND resolved_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.admin_alerts
    SET severity = _severity,
        message = _message,
        metadata = COALESCE(_metadata, '{}'::jsonb)
    WHERE id = _existing_id;
    RETURN;
  END IF;

  INSERT INTO public.admin_alerts (kind, severity, message, metadata)
  VALUES (_kind, _severity, _message, COALESCE(_metadata, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.raise_admin_alert(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.raise_admin_alert(TEXT, TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_admin_alert(_kind TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.admin_alerts
  SET resolved_at = COALESCE(resolved_at, now())
  WHERE kind = _kind AND resolved_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.resolve_admin_alert(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_admin_alert(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_stuck_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
  stuck_count INTEGER;
BEGIN
  WITH exp AS (
    UPDATE public.transactions
    SET status = 'expired', updated_at = now()
    WHERE status IN ('pending','processing')
      AND payment_method = 'pix'
      AND ((pix_expires_at IS NOT NULL AND pix_expires_at < now()) OR (pix_expires_at IS NULL AND created_at < now() - INTERVAL '24 hours'))
    RETURNING 1
  ) SELECT count(*) INTO expired_count FROM exp;

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
  ELSE
    PERFORM public.resolve_admin_alert('stuck_transactions');
  END IF;
  RETURN stuck_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_stuck_transactions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_transactions() TO service_role;

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
    PERFORM public.raise_admin_alert('stuck_withdrawals', 'critical', format('%s saques aguardam conclusão há mais de 24h', stuck_count), jsonb_build_object('count', stuck_count));
  ELSE
    PERFORM public.resolve_admin_alert('stuck_withdrawals');
  END IF;
  RETURN stuck_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_stuck_withdrawals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_withdrawals() TO service_role;

CREATE OR REPLACE FUNCTION public.check_error_rate()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  err_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO err_count FROM public.error_logs WHERE created_at > now() - INTERVAL '5 minutes';
  IF err_count > 50 THEN
    PERFORM public.raise_admin_alert('high_error_rate', CASE WHEN err_count > 200 THEN 'critical' ELSE 'warning' END, format('%s erros nos últimos 5 minutos', err_count), jsonb_build_object('count', err_count, 'window_minutes', 5));
  ELSE
    PERFORM public.resolve_admin_alert('high_error_rate');
  END IF;
  RETURN err_count;
END;
$$;
REVOKE ALL ON FUNCTION public.check_error_rate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_error_rate() TO service_role;

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
  pct := ROUND((used::NUMERIC / NULLIF(max_conn, 0)) * 100, 1);
  IF pct >= 80 THEN
    PERFORM public.raise_admin_alert('db_connections_high', CASE WHEN pct >= 90 THEN 'critical' ELSE 'warning' END, format('Conexões do banco em %s%% (%s/%s)', pct, used, max_conn), jsonb_build_object('used', used, 'max', max_conn, 'pct', pct));
  ELSE
    PERFORM public.resolve_admin_alert('db_connections_high');
  END IF;
  RETURN used;
END;
$$;
REVOKE ALL ON FUNCTION public.check_db_connections() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_db_connections() TO service_role;

UPDATE public.admin_alerts
SET resolved_at = COALESCE(resolved_at, now())
WHERE resolved_at IS NULL
  AND kind IN ('stuck_transactions', 'db_connections_high', 'high_error_rate');