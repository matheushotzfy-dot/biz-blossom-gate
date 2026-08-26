DROP POLICY IF EXISTS "Users insert own auto withdraw config" ON public.seller_auto_withdraw;
DROP POLICY IF EXISTS "Users update own auto withdraw config" ON public.seller_auto_withdraw;

REVOKE INSERT, UPDATE ON TABLE public.seller_auto_withdraw FROM authenticated;