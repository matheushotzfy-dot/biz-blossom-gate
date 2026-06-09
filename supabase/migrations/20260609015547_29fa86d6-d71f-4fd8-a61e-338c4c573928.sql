-- Add SELECT policy for webhook_configs owners (the `secret` column already has SELECT revoked from authenticated)
CREATE POLICY "Owners can view their own webhook configs"
ON public.webhook_configs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);