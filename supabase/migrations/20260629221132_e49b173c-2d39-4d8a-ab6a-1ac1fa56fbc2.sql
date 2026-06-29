
-- ============ Immutable security audit log ============
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_role text,
  event_type text NOT NULL,
  endpoint text,
  ip_hash text,
  user_agent text,
  status_code int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read security audit"
  ON public.security_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_sec_audit_created ON public.security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_audit_user ON public.security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_audit_event ON public.security_audit_log(event_type, created_at DESC);

-- Immutability: block UPDATE and DELETE for everyone (including service_role)
CREATE OR REPLACE FUNCTION public.security_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_log is immutable (op=%)', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_security_audit_no_update ON public.security_audit_log;
CREATE TRIGGER trg_security_audit_no_update
  BEFORE UPDATE OR DELETE ON public.security_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.security_audit_immutable();

-- Helper for service_role to insert audit rows (PostgREST safe)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _endpoint text,
  _user_id uuid DEFAULT NULL,
  _actor_role text DEFAULT NULL,
  _ip_hash text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _status_code int DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.security_audit_log
    (user_id, actor_role, event_type, endpoint, ip_hash, user_agent, status_code, metadata)
  VALUES (_user_id, _actor_role, _event_type, _endpoint, _ip_hash,
          left(COALESCE(_user_agent,''), 200), _status_code, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.log_security_event(text,text,uuid,text,text,text,int,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,uuid,text,text,text,int,jsonb) TO service_role;

-- ============ Temporary abuse blocks ============
CREATE TABLE IF NOT EXISTS public.abuse_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  endpoint text,
  reason text,
  blocked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.abuse_blocks TO authenticated;
GRANT ALL ON public.abuse_blocks TO service_role;

ALTER TABLE public.abuse_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read abuse blocks"
  ON public.abuse_blocks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_abuse_blocks_ip ON public.abuse_blocks(ip_hash, blocked_until DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_blocks_until ON public.abuse_blocks(blocked_until DESC);

-- Check if IP is currently blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(_ip_hash text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.abuse_blocks
    WHERE ip_hash = _ip_hash AND blocked_until > now()
  );
$$;
REVOKE ALL ON FUNCTION public.is_ip_blocked(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text) TO service_role;

-- Insurgency detector — very conservative thresholds so innocent users
-- never get caught. Defaults: 100 events in 10s → 15 minutes block.
CREATE OR REPLACE FUNCTION public.check_and_block_abuse(
  _ip_hash text,
  _endpoint text,
  _window_seconds int DEFAULT 10,
  _max_events int DEFAULT 100,
  _block_minutes int DEFAULT 15
) RETURNS TABLE(blocked boolean, count_in_window int, blocked_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cnt int;
  _until timestamptz;
  _existing timestamptz;
BEGIN
  -- If already blocked, just return current block
  SELECT ab.blocked_until INTO _existing
  FROM public.abuse_blocks ab
  WHERE ab.ip_hash = _ip_hash AND ab.blocked_until > now()
  ORDER BY ab.blocked_until DESC LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT true, 0, _existing;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _cnt
  FROM public.auth_abuse_events
  WHERE ip_hash = _ip_hash
    AND created_at > now() - make_interval(secs => GREATEST(_window_seconds, 1));

  IF _cnt >= _max_events THEN
    _until := now() + make_interval(mins => GREATEST(_block_minutes, 1));
    INSERT INTO public.abuse_blocks(ip_hash, endpoint, reason, blocked_until)
    VALUES (_ip_hash, _endpoint,
            format('Auto-block: %s events in %ss', _cnt, _window_seconds), _until);

    -- Also write an immutable audit row + alert event
    INSERT INTO public.security_audit_log
      (event_type, endpoint, ip_hash, status_code, metadata)
    VALUES ('abuse_auto_block', _endpoint, _ip_hash, 429,
            jsonb_build_object('count', _cnt, 'window_seconds', _window_seconds,
                               'blocked_minutes', _block_minutes));
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT ur.user_id,
           '🚨 Abuso detectado',
           format('Endpoint %s: %s eventos em %ss — IP bloqueado por %s min.',
                  _endpoint, _cnt, _window_seconds, _block_minutes),
           'security'
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::app_role;

    RETURN QUERY SELECT true, _cnt, _until;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, _cnt, NULL::timestamptz;
END;
$$;
REVOKE ALL ON FUNCTION public.check_and_block_abuse(text,text,int,int,int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_block_abuse(text,text,int,int,int) TO service_role;
