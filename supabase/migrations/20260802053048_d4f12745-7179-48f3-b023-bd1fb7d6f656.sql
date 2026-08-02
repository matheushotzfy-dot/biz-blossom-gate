-- Convert permissive anon-deny policies to RESTRICTIVE (fail-closed by construction)
DROP POLICY IF EXISTS "deny_anon_all_login_attempts" ON public.admin_login_attempts;
CREATE POLICY "deny_anon_all_login_attempts" ON public.admin_login_attempts AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_fraud_logs" ON public.fraud_logs;
CREATE POLICY "deny_anon_all_fraud_logs" ON public.fraud_logs AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_global_blacklist" ON public.global_blacklist;
CREATE POLICY "deny_anon_all_global_blacklist" ON public.global_blacklist AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_lesson_attachments" ON public.lesson_attachments;
CREATE POLICY "deny_anon_all_lesson_attachments" ON public.lesson_attachments AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_manager_assignments" ON public.manager_seller_assignments;
CREATE POLICY "deny_anon_all_manager_assignments" ON public.manager_seller_assignments AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_fee_limits" ON public.manager_fee_limits;
CREATE POLICY "deny_anon_all_fee_limits" ON public.manager_fee_limits AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_referrals" ON public.referrals;
CREATE POLICY "deny_anon_all_referrals" ON public.referrals AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_retention_settings" ON public.retention_settings;
CREATE POLICY "deny_anon_all_retention_settings" ON public.retention_settings AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_seller_notes" ON public.seller_notes;
CREATE POLICY "deny_anon_all_seller_notes" ON public.seller_notes AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_subscriptions" ON public.subscriptions;
CREATE POLICY "deny_anon_all_subscriptions" ON public.subscriptions AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_all_tickets" ON public.support_tickets;
CREATE POLICY "deny_anon_all_tickets" ON public.support_tickets AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_idempotency" ON public.idempotency_keys;
CREATE POLICY "deny_anon_idempotency" ON public.idempotency_keys AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);