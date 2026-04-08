
-- FIX 1: Make deny policies RESTRICTIVE on affiliate_links
DROP POLICY IF EXISTS "deny_anon_all_affiliate_links" ON public.affiliate_links;
CREATE POLICY "deny_anon_all_affiliate_links" ON public.affiliate_links
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- Remove the overly permissive anon SELECT on affiliate_links (redundant with affiliate_links_public view)
DROP POLICY IF EXISTS "Anon can view active affiliate links" ON public.affiliate_links;

-- FIX 2: Make deny policies RESTRICTIVE on notifications
DROP POLICY IF EXISTS "deny_anon_all_notifications" ON public.notifications;
CREATE POLICY "deny_anon_all_notifications" ON public.notifications
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- FIX 3: Make service_insert_ledger RESTRICTIVE to block authenticated inserts properly
DROP POLICY IF EXISTS "service_insert_ledger" ON public.financial_ledger;
CREATE POLICY "service_insert_ledger" ON public.financial_ledger
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);

-- FIX 4: Make deny_anon_all_ledger RESTRICTIVE
DROP POLICY IF EXISTS "deny_anon_all_ledger" ON public.financial_ledger;
CREATE POLICY "deny_anon_all_ledger" ON public.financial_ledger
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
