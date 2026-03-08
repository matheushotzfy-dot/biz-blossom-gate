
-- Fix: The previous policy was too restrictive (AND admin check).
-- Sellers should access disputes ONLY through the disputes_seller view.
-- Drop the incorrect combined policy
DROP POLICY IF EXISTS "Sellers view disputes via view only" ON public.disputes;

-- Allow sellers to see their own disputes (needed for the view with security_invoker)
CREATE POLICY "Sellers can view own disputes via view"
ON public.disputes
FOR SELECT
TO authenticated
USING (auth.uid() = seller_user_id);
