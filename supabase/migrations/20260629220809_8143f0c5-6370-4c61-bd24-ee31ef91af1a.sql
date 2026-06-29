
CREATE TABLE IF NOT EXISTS public.auth_abuse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  endpoint text,
  identifier_hash text,
  ip_hash text,
  status_code int,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auth_abuse_events TO authenticated;
GRANT ALL ON public.auth_abuse_events TO service_role;

ALTER TABLE public.auth_abuse_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read abuse events"
  ON public.auth_abuse_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_auth_abuse_created ON public.auth_abuse_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_abuse_type ON public.auth_abuse_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_abuse_ip ON public.auth_abuse_events (ip_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_auth_abuse_stats(_hours int DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from timestamptz := now() - make_interval(hours => GREATEST(LEAST(_hours, 720), 1));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN jsonb_build_object(
    'total', (SELECT COUNT(*) FROM public.auth_abuse_events WHERE created_at >= _from),
    'by_type', COALESCE((
      SELECT jsonb_object_agg(event_type, c)
      FROM (SELECT event_type, COUNT(*) c FROM public.auth_abuse_events
            WHERE created_at >= _from GROUP BY event_type) t
    ), '{}'::jsonb),
    'by_endpoint', COALESCE((
      SELECT jsonb_object_agg(COALESCE(endpoint,'(none)'), c)
      FROM (SELECT endpoint, COUNT(*) c FROM public.auth_abuse_events
            WHERE created_at >= _from GROUP BY endpoint) t
    ), '{}'::jsonb),
    'top_ips', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('ip_hash', ip_hash, 'count', c))
      FROM (SELECT ip_hash, COUNT(*) c FROM public.auth_abuse_events
            WHERE created_at >= _from AND ip_hash IS NOT NULL
            GROUP BY ip_hash ORDER BY c DESC LIMIT 10) t
    ), '[]'::jsonb),
    'top_identifiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('identifier_hash', identifier_hash, 'count', c))
      FROM (SELECT identifier_hash, COUNT(*) c FROM public.auth_abuse_events
            WHERE created_at >= _from AND identifier_hash IS NOT NULL
            GROUP BY identifier_hash ORDER BY c DESC LIMIT 10) t
    ), '[]'::jsonb),
    'hourly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'count', c) ORDER BY bucket)
      FROM (SELECT date_trunc('hour', created_at) bucket, COUNT(*) c
            FROM public.auth_abuse_events WHERE created_at >= _from
            GROUP BY 1 ORDER BY 1) t
    ), '[]'::jsonb),
    'window_hours', _hours,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_abuse_stats(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_auth_abuse_stats(int) TO authenticated;
