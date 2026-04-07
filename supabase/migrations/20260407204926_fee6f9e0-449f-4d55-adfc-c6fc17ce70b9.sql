-- Fix: authenticated users must also be able to view active products (for checkout)
CREATE POLICY "Authenticated can view active products"
ON public.products
FOR SELECT
TO authenticated
USING (status = 'active');
