CREATE OR REPLACE FUNCTION public.get_seller_product_revenue()
RETURNS TABLE(product_id uuid, net_revenue numeric, approved_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.product_id,
         COALESCE(SUM(t.net_amount), 0)::numeric,
         COUNT(*)::bigint
  FROM public.transactions t
  WHERE t.user_id = auth.uid()
    AND t.product_id IS NOT NULL
    AND t.status IN ('approved','paid','completed')
  GROUP BY t.product_id
$$;

REVOKE ALL ON FUNCTION public.get_seller_product_revenue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_product_revenue() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_seller_month_revenue(_month text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(t.net_amount), 0)::numeric
  FROM public.transactions t
  WHERE t.user_id = auth.uid()
    AND t.status IN ('approved','paid','completed')
    AND t.created_at >= to_date(_month, 'YYYY-MM')
    AND t.created_at < (to_date(_month, 'YYYY-MM') + interval '1 month')
$$;

REVOKE ALL ON FUNCTION public.get_seller_month_revenue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_month_revenue(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_seller_anticipation_summary(_max_days integer DEFAULT 15)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT t.retained_amount,
           GREATEST(0, CEIL(EXTRACT(EPOCH FROM (t.retained_until - now())) / 86400))::int AS days_remaining
    FROM public.transactions t
    WHERE t.user_id = auth.uid()
      AND t.status IN ('approved','paid','completed')
      AND COALESCE(t.is_simulated, false) = false
      AND t.retained_amount > 0
      AND COALESCE(t.retention_released, false) = false
      AND t.retained_until IS NOT NULL
      AND t.retained_until > now()
  ), elig AS (
    SELECT * FROM base WHERE days_remaining <= GREATEST(0, _max_days)
  )
  SELECT jsonb_build_object(
    'retained_total', COALESCE((SELECT SUM(retained_amount) FROM base), 0),
    'eligible_count', COALESCE((SELECT COUNT(*) FROM base), 0),
    'calc_count', COALESCE((SELECT COUNT(*) FROM elig), 0),
    'calc_total', COALESCE((SELECT SUM(retained_amount) FROM elig), 0),
    'calc_fee', COALESCE((SELECT SUM(retained_amount * 0.025 * LEAST(days_remaining::numeric / 15, 1)) FROM elig), 0),
    'calc_net', COALESCE((SELECT SUM(retained_amount - (retained_amount * 0.025 * LEAST(days_remaining::numeric / 15, 1))) FROM elig), 0)
  )
$$;

REVOKE ALL ON FUNCTION public.get_seller_anticipation_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_anticipation_summary(integer) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_transactions_user_product_paid
  ON public.transactions (user_id, product_id)
  WHERE status IN ('approved','paid','completed') AND product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_retained
  ON public.transactions (user_id, retained_until)
  WHERE retained_amount > 0 AND retention_released IS NOT TRUE;