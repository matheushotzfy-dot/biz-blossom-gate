-- Tighten "Buyers view purchased products" policy: only completed transactions where buyer's email matches the auth user.
DROP POLICY IF EXISTS "Buyers view purchased products" ON public.products;
CREATE POLICY "Buyers view purchased products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN auth.users u ON u.id = auth.uid()
    WHERE t.product_id = products.id
      AND t.status = 'completed'
      AND lower(t.customer_email) = lower(u.email)
  )
);