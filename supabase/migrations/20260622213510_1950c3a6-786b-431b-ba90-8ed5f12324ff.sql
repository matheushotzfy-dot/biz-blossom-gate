
-- 1) Remove seller direct access to acquirers (exposes encrypted keys/secrets)
DROP POLICY IF EXISTS "Sellers can view visible acquirers" ON public.acquirers;

-- Create a safe public view exposing only non-sensitive columns
DROP VIEW IF EXISTS public.acquirers_public;
CREATE VIEW public.acquirers_public
WITH (security_invoker = off) AS
SELECT id, name, slug, type, description, conversion_rate, is_active, seller_visible, priority
FROM public.acquirers
WHERE is_active = true AND seller_visible = true;

GRANT SELECT ON public.acquirers_public TO authenticated, anon;

-- 2) Tighten storage policy for withdrawal proofs (no substring matching)
DROP POLICY IF EXISTS "Sellers read own withdrawal proofs" ON storage.objects;
CREATE POLICY "Sellers read own withdrawal proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'withdrawal-proofs'
  AND EXISTS (
    SELECT 1 FROM public.withdrawals w
    WHERE w.user_id = auth.uid()
      AND (storage.foldername(storage.objects.name))[1] = w.id::text
  )
);
