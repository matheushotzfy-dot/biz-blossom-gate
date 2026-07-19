
-- Fix affiliate_links update policy: scope to authenticated
DROP POLICY IF EXISTS "Affiliates update own links" ON public.affiliate_links;
CREATE POLICY "Affiliates update own links"
ON public.affiliate_links
FOR UPDATE
TO authenticated
USING (affiliate_user_id = auth.uid())
WITH CHECK (affiliate_user_id = auth.uid());

-- Fix webhook_configs insert/update/delete policies: scope to authenticated
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webhook_configs'
      AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.webhook_configs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users insert own webhook configs"
ON public.webhook_configs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own webhook configs"
ON public.webhook_configs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own webhook configs"
ON public.webhook_configs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix race-assets storage: restrict reads to admins only (defense-in-depth)
DROP POLICY IF EXISTS "race_assets_read_authenticated" ON storage.objects;
CREATE POLICY "race_assets_read_admins"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'race-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
