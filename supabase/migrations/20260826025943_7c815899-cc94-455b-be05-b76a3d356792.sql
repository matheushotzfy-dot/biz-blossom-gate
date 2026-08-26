CREATE OR REPLACE FUNCTION public.bump_rate_limit(_bucket_key text, _window_seconds integer, _max_count integer)
 RETURNS TABLE(allowed boolean, current_count integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _window_start timestamptz;
  _new_count int;
BEGIN
  IF _window_seconds IS NULL OR _window_seconds < 1 THEN
    _window_seconds := 60;
  END IF;

  -- Janela alinhada de forma determinística. A versão anterior misturava
  -- date_trunc('second', now()) com o módulo do epoch, o que produzia duas
  -- janelas adjacentes (ex.: 02:44:59 e 02:45:00) para o mesmo período e
  -- permitia mais requisições do que o limite configurado.
  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.api_rate_limit_buckets(bucket_key, window_start, count)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = api_rate_limit_buckets.count + 1
  RETURNING count INTO _new_count;

  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limit_buckets
    WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN QUERY SELECT
    (_new_count <= _max_count),
    _new_count,
    (_window_start + make_interval(secs => _window_seconds));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, integer, integer) TO service_role;