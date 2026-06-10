REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) TO service_role;