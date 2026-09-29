REVOKE ALL ON FUNCTION public.split_transaction_fee() FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.list_acquirers_basic();
CREATE OR REPLACE FUNCTION app_private.list_acquirers_basic()
RETURNS TABLE(id uuid, name text, is_active boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR app_private.has_financial_permission(auth.uid(),'metrics_view') OR app_private.has_financial_permission(auth.uid(),'request_actions')) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY SELECT a.id, a.name, a.is_active FROM public.acquirers a ORDER BY a.priority NULLS LAST, a.name;
END $$;
REVOKE ALL ON FUNCTION app_private.list_acquirers_basic() FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.list_acquirers_basic()
RETURNS TABLE(id uuid, name text, is_active boolean) LANGUAGE sql STABLE SET search_path TO 'public','app_private' AS $$ SELECT * FROM app_private.list_acquirers_basic() $$;
REVOKE ALL ON FUNCTION public.list_acquirers_basic() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_acquirers_basic() TO authenticated;