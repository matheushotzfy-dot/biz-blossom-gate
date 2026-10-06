CREATE OR REPLACE FUNCTION public.get_app_integration_for_dispatch(_integration_id uuid)
RETURNS TABLE(id uuid, user_id uuid, app_name text, api_key text, api_url text, webhook_url text, is_active boolean, config jsonb)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM app_private.get_app_integration_for_dispatch(_integration_id);
$$;
REVOKE ALL ON FUNCTION public.get_app_integration_for_dispatch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_integration_for_dispatch(uuid) TO service_role;
GRANT USAGE ON SCHEMA app_private TO service_role;