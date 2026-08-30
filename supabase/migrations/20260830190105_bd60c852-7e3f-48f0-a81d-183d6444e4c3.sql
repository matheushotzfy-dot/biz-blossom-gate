-- 1) checkout-banners: leitura pública apenas de banners que pertencem a um produto existente
DROP POLICY IF EXISTS "Checkout banners are public" ON storage.objects;
CREATE POLICY "Checkout banners public read scoped to product"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'checkout-banners'
  AND array_length(storage.foldername(name), 1) = 1
  AND storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(desktop|mobile)\.(png|jpg|jpeg|webp|gif)$'
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id::text = substring(storage.filename(name), '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
      AND p.user_id::text = (storage.foldername(name))[1]
  )
);

-- 2) product-images: escrita restrita a usuários autenticados, pasta do próprio uid e extensões de imagem
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) BETWEEN 1 AND 2
  AND lower(storage.filename(name)) ~ '^[a-z0-9._-]+\.(png|jpg|jpeg|webp|gif|avif)$'
);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.filename(name)) ~ '^[a-z0-9._-]+\.(png|jpg|jpeg|webp|gif|avif)$'
);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3) race-assets: banners/logos de corrida legíveis por usuários autenticados (admin mantém escrita)
DROP POLICY IF EXISTS "race_assets_read_admins" ON storage.objects;
CREATE POLICY "race_assets_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'race-assets');