
-- =============================================
-- 1. Fix affiliate_links: remove leaky anon SELECT + fix deny to RESTRICTIVE
-- =============================================
DROP POLICY IF EXISTS "Public read active affiliate links (restricted)" ON public.affiliate_links;
DROP POLICY IF EXISTS "deny_anon_all_affiliate_links" ON public.affiliate_links;

CREATE POLICY "deny_anon_all_affiliate_links"
ON public.affiliate_links FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =============================================
-- 2. Fix notifications: restrict "view own" to authenticated only
-- =============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR (user_id IS NULL));

-- Fix anon deny policies to be proper denies
DROP POLICY IF EXISTS "deny_anon_select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "deny_anon_delete_notifications" ON public.notifications;
DROP POLICY IF EXISTS "deny_anon_update_notifications" ON public.notifications;

CREATE POLICY "deny_anon_all_notifications"
ON public.notifications FOR ALL
TO anon
USING (false)
WITH CHECK (false);
