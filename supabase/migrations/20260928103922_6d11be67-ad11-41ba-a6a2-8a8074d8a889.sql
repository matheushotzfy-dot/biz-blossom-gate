DROP POLICY IF EXISTS "Admins view all webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admins view all webhook deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING ((SELECT public.current_user_has_role('admin'::app_role)));
DROP POLICY IF EXISTS "Users view own webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Users view own webhook deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.get_thank_you_summary(_tx_id uuid)
RETURNS TABLE(amount numeric, payment_method text, customer_first_name text, customer_email_masked text, status text, product_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.amount::numeric, t.payment_method::text,
         split_part(coalesce(t.customer_name,''),' ',1),
         CASE WHEN t.customer_email IS NULL OR position('@' in t.customer_email)=0 THEN NULL
              ELSE left(t.customer_email,2) || '***@' || split_part(t.customer_email,'@',2) END,
         t.status::text, t.product_id
  FROM public.transactions t
  WHERE t.id = _tx_id
    AND coalesce(t.is_simulated,false) = false
    AND t.created_at > now() - interval '7 days'
$$;
REVOKE ALL ON FUNCTION public.get_thank_you_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_thank_you_summary(uuid) TO anon, authenticated;