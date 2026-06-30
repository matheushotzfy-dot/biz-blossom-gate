-- Block dangerous file types across all user-upload buckets.
-- Extends the existing block_svg_uploads_product_images defense.

DROP POLICY IF EXISTS "block_dangerous_uploads_all_user_buckets" ON storage.objects;

CREATE POLICY "block_dangerous_uploads_all_user_buckets"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO public
USING (
  bucket_id NOT IN ('checkout-banners','kyc-documents','dispute-evidence','course-content','withdrawal-proofs')
  OR (
    lower(name) NOT LIKE '%.svg'
    AND lower(name) NOT LIKE '%.svgz'
    AND lower(name) NOT LIKE '%.html'
    AND lower(name) NOT LIKE '%.htm'
    AND lower(name) NOT LIKE '%.xhtml'
    AND lower(name) NOT LIKE '%.js'
    AND lower(name) NOT LIKE '%.mjs'
    AND lower(name) NOT LIKE '%.xml'
    AND lower(name) NOT LIKE '%.swf'
    AND lower(name) NOT LIKE '%.xsl'
  )
)
WITH CHECK (
  bucket_id NOT IN ('checkout-banners','kyc-documents','dispute-evidence','course-content','withdrawal-proofs')
  OR (
    lower(name) NOT LIKE '%.svg'
    AND lower(name) NOT LIKE '%.svgz'
    AND lower(name) NOT LIKE '%.html'
    AND lower(name) NOT LIKE '%.htm'
    AND lower(name) NOT LIKE '%.xhtml'
    AND lower(name) NOT LIKE '%.js'
    AND lower(name) NOT LIKE '%.mjs'
    AND lower(name) NOT LIKE '%.xml'
    AND lower(name) NOT LIKE '%.swf'
    AND lower(name) NOT LIKE '%.xsl'
  )
);