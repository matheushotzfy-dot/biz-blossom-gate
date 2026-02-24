
-- Deny all direct INSERT/UPDATE/DELETE on user_roles to prevent privilege escalation
-- Only the handle_new_user() SECURITY DEFINER trigger can insert roles

CREATE POLICY "Prevent direct user_roles INSERT"
ON public.user_roles FOR INSERT
WITH CHECK (false);

CREATE POLICY "Prevent direct user_roles UPDATE"
ON public.user_roles FOR UPDATE
USING (false);

CREATE POLICY "Prevent direct user_roles DELETE"
ON public.user_roles FOR DELETE
USING (false);
