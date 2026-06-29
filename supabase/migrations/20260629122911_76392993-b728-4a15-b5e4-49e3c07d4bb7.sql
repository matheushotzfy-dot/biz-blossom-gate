
-- 1) Exempt admins from per-creator rate limit (admin broadcasts need to fanout to all sellers).
CREATE OR REPLACE FUNCTION public.validate_notification_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE recent_count integer;
BEGIN
  IF NEW.created_by IS NOT NULL AND public.has_role(NEW.created_by, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO recent_count FROM public.notifications WHERE created_by = NEW.created_by AND created_at > now() - interval '1 hour';
  IF recent_count >= 50 THEN RAISE EXCEPTION 'Rate limit exceeded'; END IF;
  RETURN NEW;
END; $function$;

-- 2) Broadcast RPC: fan-out one row per seller so per-user is_read works and RLS keeps each seller scoped to their own row.
CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  _title text,
  _message text,
  _type text DEFAULT 'info',
  _target text DEFAULT 'all_sellers'  -- 'all_sellers' | 'all_users' | 'active_sellers'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count integer := 0;
  caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can broadcast notifications';
  END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN RAISE EXCEPTION 'Message required'; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, created_by)
  SELECT p.user_id, _title, _message, COALESCE(_type, 'info'), caller
  FROM public.profiles p
  WHERE
    CASE
      WHEN _target = 'active_sellers' THEN COALESCE(p.account_status, 'active') = 'active'
      ELSE true
    END;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(text, text, text, text) TO authenticated;

-- 3) Cleanup helper: drop orphan global-only notifications (user_id IS NULL) that nobody could ever read.
CREATE OR REPLACE FUNCTION public.admin_purge_orphan_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins';
  END IF;
  DELETE FROM public.notifications WHERE user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_orphan_notifications() TO authenticated;
