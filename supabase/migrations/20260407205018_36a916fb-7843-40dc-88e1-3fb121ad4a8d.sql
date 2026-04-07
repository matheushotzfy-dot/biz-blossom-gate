-- Add restrictive anon deny policy for subscription_plans
CREATE POLICY "deny_anon_all_subscription_plans"
ON public.subscription_plans
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Allow sellers to view their own disputes
CREATE POLICY "Sellers can view own disputes"
ON public.disputes
FOR SELECT
TO authenticated
USING (seller_user_id = auth.uid());
