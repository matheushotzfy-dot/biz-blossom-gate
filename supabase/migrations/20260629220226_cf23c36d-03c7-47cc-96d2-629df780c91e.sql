-- RESTRICTIVE policy: aplicada em AND com as policies normais.
-- Qualquer INSERT/UPDATE no bucket product-images que tente subir .svg/.svgz é negado.
CREATE POLICY "block_svg_uploads_product_images"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO public
USING (
  bucket_id <> 'product-images'
  OR lower(name) !~ '\.svgz?$'
)
WITH CHECK (
  bucket_id <> 'product-images'
  OR lower(name) !~ '\.svgz?$'
);