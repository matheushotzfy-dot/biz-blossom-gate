
-- 1) Fix checkout-banners storage delete/update ownership checks
DROP POLICY IF EXISTS "Users can delete own checkout banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own checkout banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own checkout banners" ON storage.objects;

CREATE POLICY "Users can upload own checkout banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = split_part(split_part((storage.filename(objects.name)), '-', 1), '.', 1)
  )
);

CREATE POLICY "Users can update own checkout banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = split_part(split_part((storage.filename(objects.name)), '-', 1), '.', 1)
  )
);

CREATE POLICY "Users can delete own checkout banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checkout-banners'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = split_part(split_part((storage.filename(objects.name)), '-', 1), '.', 1)
  )
);

-- 2) Scope user policies to 'authenticated' role instead of 'public'

-- balance_adjustments
DROP POLICY IF EXISTS "Users can view own adjustments" ON public.balance_adjustments;
CREATE POLICY "Users can view own adjustments" ON public.balance_adjustments
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage balance adjustments" ON public.balance_adjustments;

-- custom_user_fees
DROP POLICY IF EXISTS "Users can view own custom fees" ON public.custom_user_fees;
CREATE POLICY "Users can view own custom fees" ON public.custom_user_fees
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage custom fees" ON public.custom_user_fees;

-- pix_keys
DROP POLICY IF EXISTS "Admins can view all pix keys" ON public.pix_keys;
CREATE POLICY "Admins can view all pix keys" ON public.pix_keys
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own pix keys" ON public.pix_keys;
CREATE POLICY "Users can delete own pix keys" ON public.pix_keys
FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pix keys" ON public.pix_keys;
CREATE POLICY "Users can insert own pix keys" ON public.pix_keys
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own pix keys" ON public.pix_keys;
CREATE POLICY "Users can view own pix keys" ON public.pix_keys
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- retention_settings
DROP POLICY IF EXISTS "Admins can manage retention settings" ON public.retention_settings;
CREATE POLICY "Admins can manage retention settings" ON public.retention_settings
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own retention" ON public.retention_settings;
CREATE POLICY "Users can view own retention" ON public.retention_settings
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- seller_acquirer_config
DROP POLICY IF EXISTS "Admins can manage seller acquirer config" ON public.seller_acquirer_config;
CREATE POLICY "Admins can manage seller acquirer config" ON public.seller_acquirer_config
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own acquirer config" ON public.seller_acquirer_config;
CREATE POLICY "Users can view own acquirer config" ON public.seller_acquirer_config
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- seller_auto_withdraw
DROP POLICY IF EXISTS "Users insert own auto withdraw config" ON public.seller_auto_withdraw;
CREATE POLICY "Users insert own auto withdraw config" ON public.seller_auto_withdraw
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own auto withdraw config" ON public.seller_auto_withdraw;
CREATE POLICY "Users update own auto withdraw config" ON public.seller_auto_withdraw
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
