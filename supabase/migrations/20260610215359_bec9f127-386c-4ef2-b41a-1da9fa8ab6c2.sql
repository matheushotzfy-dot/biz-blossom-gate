
-- Função auxiliar: retorna o email do usuário autenticado sem expor auth.users
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;

-- Substitui policy problemática
DROP POLICY IF EXISTS "Buyers view purchased products" ON public.products;

CREATE POLICY "Buyers view purchased products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.product_id = products.id
      AND t.status = 'completed'
      AND lower(t.customer_email) = public.current_user_email()
  )
);
