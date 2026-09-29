DO $migration$
DECLARE
  fn record;
  call_args text;
  wrapper_sql text;
  volatility_sql text;
BEGIN
  CREATE TEMP TABLE functions_to_wrap ON COMMIT DROP AS
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_function_arguments(p.oid) AS full_args,
    pg_get_function_result(p.oid) AS result_type,
    p.pronargs,
    p.proretset,
    p.provolatile,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgfoid = p.oid AND NOT t.tgisinternal
    )
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  FOR fn IN SELECT * FROM functions_to_wrap ORDER BY proname, identity_args LOOP
    SELECT COALESCE(string_agg('$' || i::text, ', ' ORDER BY i), '')
      INTO call_args
      FROM generate_series(1, fn.pronargs) AS i;

    volatility_sql := CASE fn.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      ELSE 'VOLATILE'
    END;

    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET SCHEMA app_private',
      fn.proname,
      fn.identity_args
    );

    EXECUTE format(
      'REVOKE ALL ON FUNCTION app_private.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname,
      fn.identity_args
    );
    IF fn.anon_execute THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION app_private.%I(%s) TO anon', fn.proname, fn.identity_args);
    END IF;
    IF fn.authenticated_execute THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION app_private.%I(%s) TO authenticated', fn.proname, fn.identity_args);
    END IF;
    IF fn.service_execute THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION app_private.%I(%s) TO service_role', fn.proname, fn.identity_args);
    END IF;

    wrapper_sql := format(
      'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s SECURITY INVOKER SET search_path = public, app_private AS %L',
      fn.proname,
      fn.full_args,
      fn.result_type,
      volatility_sql,
      CASE WHEN fn.proretset
        THEN format('SELECT * FROM app_private.%I(%s)', fn.proname, call_args)
        ELSE format('SELECT app_private.%I(%s)', fn.proname, call_args)
      END
    );
    EXECUTE wrapper_sql;

    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
      fn.proname,
      fn.identity_args
    );
    IF fn.anon_execute THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon', fn.proname, fn.identity_args);
    END IF;
    IF fn.authenticated_execute THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.identity_args);
    END IF;
    IF fn.service_execute THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', fn.proname, fn.identity_args);
    END IF;
  END LOOP;
END
$migration$;

GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;