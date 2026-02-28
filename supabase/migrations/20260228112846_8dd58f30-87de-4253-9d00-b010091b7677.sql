
-- ============================================================
-- SECURITY FIX: Deny anonymous access to all sensitive tables
-- This prevents unauthenticated users from reading any data
-- ============================================================

-- CRITICAL: profiles
CREATE POLICY "deny_anon_select_profiles" ON public.profiles
  AS RESTRICTIVE FOR SELECT TO anon USING (false);
CREATE POLICY "deny_anon_insert_profiles" ON public.profiles
  AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "deny_anon_update_profiles" ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_profiles" ON public.profiles
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- CRITICAL: bank_accounts
CREATE POLICY "deny_anon_select_bank_accounts" ON public.bank_accounts
  AS RESTRICTIVE FOR SELECT TO anon USING (false);
CREATE POLICY "deny_anon_insert_bank_accounts" ON public.bank_accounts
  AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "deny_anon_update_bank_accounts" ON public.bank_accounts
  AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_bank_accounts" ON public.bank_accounts
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- CRITICAL: transactions
CREATE POLICY "deny_anon_select_transactions" ON public.transactions
  AS RESTRICTIVE FOR SELECT TO anon USING (false);
CREATE POLICY "deny_anon_insert_transactions" ON public.transactions
  AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "deny_anon_update_transactions" ON public.transactions
  AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_transactions" ON public.transactions
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- CRITICAL: disputes
CREATE POLICY "deny_anon_select_disputes" ON public.disputes
  AS RESTRICTIVE FOR SELECT TO anon USING (false);
CREATE POLICY "deny_anon_insert_disputes" ON public.disputes
  AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "deny_anon_update_disputes" ON public.disputes
  AS RESTRICTIVE FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_disputes" ON public.disputes
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- WARNING: activity_logs
CREATE POLICY "deny_anon_all_activity_logs" ON public.activity_logs
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: balance_adjustments
CREATE POLICY "deny_anon_all_balance_adjustments" ON public.balance_adjustments
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: custom_user_fees
CREATE POLICY "deny_anon_all_custom_user_fees" ON public.custom_user_fees
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: withdrawals
CREATE POLICY "deny_anon_all_withdrawals" ON public.withdrawals
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: coupons
CREATE POLICY "deny_anon_all_coupons" ON public.coupons
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: webhook_configs
CREATE POLICY "deny_anon_all_webhook_configs" ON public.webhook_configs
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: pix_keys
CREATE POLICY "deny_anon_all_pix_keys" ON public.pix_keys
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: expenses
CREATE POLICY "deny_anon_all_expenses" ON public.expenses
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- WARNING: product_pixels
CREATE POLICY "deny_anon_all_product_pixels" ON public.product_pixels
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- INFO: user_access
CREATE POLICY "deny_anon_all_user_access" ON public.user_access
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- INFO: audit_logs
CREATE POLICY "deny_anon_all_audit_logs" ON public.audit_logs
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- INFO: error_logs
CREATE POLICY "deny_anon_all_error_logs" ON public.error_logs
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
