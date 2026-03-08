
-- =============================================
-- STRESS TEST 200 SELLERS: Critical fixes
-- =============================================

-- FIX 1: Storage bucket security - restrict KYC uploads to images only, max 10MB
UPDATE storage.buckets SET 
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
WHERE id = 'kyc-documents';

-- FIX 2: Product images bucket - restrict to images, max 5MB
UPDATE storage.buckets SET 
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE id = 'product-images';

-- FIX 3: Checkout banners - restrict to images, max 5MB
UPDATE storage.buckets SET 
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'checkout-banners';

-- FIX 4: Enforce max 3 PIX keys per user via trigger (current unique index doesn't enforce count)
CREATE OR REPLACE FUNCTION public.enforce_max_pix_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.pix_keys WHERE user_id = NEW.user_id;
  IF _count >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 chaves PIX atingido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_pix_keys_trigger ON public.pix_keys;
CREATE TRIGGER enforce_max_pix_keys_trigger
  BEFORE INSERT ON public.pix_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_pix_keys();

-- FIX 5: user_progress missing anon deny policy (security gap under load)
CREATE POLICY "deny_anon_all_user_progress" ON public.user_progress
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- FIX 6: Unique constraint on checkout_url to prevent slug collisions at 200 sellers
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_checkout_url_unique 
  ON public.products(checkout_url) WHERE checkout_url IS NOT NULL;

-- FIX 7: withdrawals missing DELETE deny for anon
CREATE POLICY "deny_anon_delete_withdrawals" ON public.withdrawals
  AS RESTRICTIVE FOR DELETE TO anon USING (false);

-- FIX 8: Composite index for fees lookup (queried on every single transaction)
CREATE INDEX IF NOT EXISTS idx_fees_name_type ON public.fees(name, fee_type);
