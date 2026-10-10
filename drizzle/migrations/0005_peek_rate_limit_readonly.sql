-- Read-only rate-limit check: returns the current bucket count WITHOUT incrementing.
-- Used by login edge functions so successful logins never consume the lockout budget;
-- bump_rate_limit is only called on failed attempts.
CREATE OR REPLACE FUNCTION public.peek_rate_limit(_bucket_key text, _window_seconds integer, _max_count integer)
 RETURNS TABLE(allowed boolean, current_count integer)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _window_start timestamptz;
  _count int;
BEGIN
  IF _window_seconds IS NULL OR _window_seconds < 1 THEN
    _window_seconds := 60;
  END IF;

  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  SELECT b.count INTO _count
  FROM public.api_rate_limit_buckets b
  WHERE b.bucket_key = _bucket_key
    AND b.window_start = _window_start;

  _count := COALESCE(_count, 0);

  RETURN QUERY SELECT (_count < _max_count), _count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.peek_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peek_rate_limit(text, integer, integer) TO service_role;