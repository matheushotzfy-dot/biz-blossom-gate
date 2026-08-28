DROP FUNCTION IF EXISTS public.get_seller_month_revenue(text);

CREATE OR REPLACE FUNCTION public.get_seller_month_revenue(_month text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'revenue', COALESCE(SUM(t.net_amount), 0),
    'count', COUNT(*)
  )
  FROM public.transactions t
  WHERE t.user_id = auth.uid()
    AND t.status IN ('approved','paid','completed')
    AND t.created_at >= to_date(_month, 'YYYY-MM')
    AND t.created_at < (to_date(_month, 'YYYY-MM') + interval '1 month')
$$;

REVOKE ALL ON FUNCTION public.get_seller_month_revenue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_month_revenue(text) TO authenticated;