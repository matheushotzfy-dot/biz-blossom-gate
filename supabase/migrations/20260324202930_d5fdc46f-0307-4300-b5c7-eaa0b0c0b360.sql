
-- ===== AUDIT LOG IMMUTABILITY =====
-- Prevent ANY user (including admin) from deleting or updating audit logs
-- Only service_role can bypass RLS, and we don't expose that

-- Deny delete for all authenticated users
CREATE POLICY "deny_delete_audit_logs"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (false);

-- Deny update for all authenticated users  
CREATE POLICY "deny_update_audit_logs"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (false);

-- Deny anon delete
CREATE POLICY "deny_anon_delete_audit_logs"
ON public.audit_logs
FOR DELETE
TO anon
USING (false);

-- Deny anon update
CREATE POLICY "deny_anon_update_audit_logs"
ON public.audit_logs
FOR UPDATE
TO anon
USING (false);

-- ===== ADMIN LOGIN ATTEMPTS - allow service_role INSERT (already bypasses RLS) =====
-- But also add explicit deny for regular users trying to manipulate attempts
CREATE POLICY "deny_insert_login_attempts"
ON public.admin_login_attempts
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "deny_update_login_attempts"
ON public.admin_login_attempts
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "deny_delete_login_attempts"
ON public.admin_login_attempts
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "deny_anon_all_login_attempts"
ON public.admin_login_attempts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
