
DROP POLICY IF EXISTS "Product owners manage affiliate links" ON public.affiliate_links;
CREATE POLICY "Product owners manage affiliate links"
ON public.affiliate_links
FOR ALL
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "deny_anon_all_ip_logs"
ON public.ip_logs
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
