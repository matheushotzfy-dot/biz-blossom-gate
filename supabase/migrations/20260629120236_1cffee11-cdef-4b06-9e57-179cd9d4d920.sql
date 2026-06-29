
CREATE OR REPLACE FUNCTION public.get_admin_top_sellers(_period_days integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from timestamptz := CASE WHEN _period_days IS NULL THEN NULL ELSE now() - make_interval(days => _period_days) END;
  _result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT t.*
    FROM public.transactions t
    WHERE (_from IS NULL OR t.created_at >= _from)
  ),
  per_seller AS (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE status IN ('completed','approved')) AS tx_approved,
      COUNT(*) AS tx_count,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','approved')), 0)::numeric AS gross,
      COALESCE(SUM(net_amount) FILTER (WHERE status IN ('completed','approved')), 0)::numeric AS net,
      COALESCE(SUM(fee_amount) FILTER (WHERE status IN ('completed','approved')), 0)::numeric AS fees,
      COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'), 0)::numeric AS refunded,
      COALESCE(SUM(amount) FILTER (WHERE status = 'chargeback'), 0)::numeric AS chargeback,
      MAX(created_at) FILTER (WHERE status IN ('completed','approved')) AS last_sale_at
    FROM base
    GROUP BY user_id
  ),
  by_method AS (
    SELECT user_id, payment_method,
      COUNT(*) AS cnt,
      COALESCE(SUM(amount),0)::numeric AS gross
    FROM base
    WHERE status IN ('completed','approved')
    GROUP BY user_id, payment_method
  ),
  methods_agg AS (
    SELECT user_id, jsonb_object_agg(COALESCE(payment_method,'outro'), jsonb_build_object('count', cnt, 'gross', gross)) AS by_method
    FROM by_method GROUP BY user_id
  ),
  by_hour AS (
    SELECT user_id, EXTRACT(HOUR FROM created_at)::int AS hr, COUNT(*) AS cnt
    FROM base WHERE status IN ('completed','approved')
    GROUP BY user_id, EXTRACT(HOUR FROM created_at)
  ),
  peak AS (
    SELECT DISTINCT ON (user_id) user_id, hr AS peak_hour, cnt AS peak_count
    FROM by_hour ORDER BY user_id, cnt DESC, hr ASC
  ),
  totals AS (
    SELECT
      COALESCE(SUM(gross),0)::numeric AS gross,
      COALESCE(SUM(net),0)::numeric AS net,
      COALESCE(SUM(fees),0)::numeric AS fees,
      COALESCE(SUM(tx_approved),0)::bigint AS tx
    FROM per_seller
  ),
  rows AS (
    SELECT
      p.user_id,
      pr.full_name,
      pr.email,
      pr.phone,
      pr.document_number,
      pr.seller_type,
      pr.created_at AS profile_created_at,
      p.tx_approved, p.tx_count, p.gross, p.net, p.fees, p.refunded, p.chargeback, p.last_sale_at,
      COALESCE(m.by_method, '{}'::jsonb) AS by_method,
      COALESCE(pk.peak_hour, 0) AS peak_hour,
      COALESCE(pk.peak_count, 0) AS peak_count
    FROM per_seller p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN methods_agg m ON m.user_id = p.user_id
    LEFT JOIN peak pk ON pk.user_id = p.user_id
    WHERE p.tx_approved > 0
    ORDER BY p.gross DESC
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(totals.*) FROM totals),
    'sellers', COALESCE((SELECT jsonb_agg(to_jsonb(rows.*)) FROM rows), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_top_sellers(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_admin_top_sellers(integer) TO authenticated;
