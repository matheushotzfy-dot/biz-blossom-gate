CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    WHEN auth.uid() = _user_id THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
    ) THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    ELSE false
  END
$$;

REVOKE EXECUTE ON FUNCTION public.admin_bulk_assign_acquirer(uuid[], uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_acquirer_active(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_seller_acquirer(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_visible_acquirers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_max_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_payment_link_intent_status(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_bulk_assign_acquirer(uuid[], uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_acquirer_active(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_seller_acquirer(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_visible_acquirers() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_max_ticket() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_link_intent_status(uuid) TO service_role;