DROP POLICY IF EXISTS "Employees can view all transactions" ON public.transactions;
CREATE POLICY "Employees can view all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));