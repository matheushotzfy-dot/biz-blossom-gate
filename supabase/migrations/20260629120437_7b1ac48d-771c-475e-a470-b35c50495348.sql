
CREATE OR REPLACE FUNCTION public.get_admin_inactive_sellers(_days_threshold integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cutoff timestamptz := now() - make_interval(days => _days_threshold);
  _result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH agg AS (
    SELECT
      user_id,
      COUNT(*) AS tx_count,
      COUNT(*) FILTER (WHERE status IN ('completed','approved')) AS tx_approved,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','approved')),0)::numeric AS gross,
      COALESCE(SUM(net_amount) FILTER (WHERE status IN ('completed','approved')),0)::numeric AS net,
      COALESCE(SUM(fee_amount) FILTER (WHERE status IN ('completed','approved')),0)::numeric AS fees,
      COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'),0)::numeric AS refunded,
      COALESCE(SUM(amount) FILTER (WHERE status = 'chargeback'),0)::numeric AS chargeback,
      MAX(created_at) AS last_tx_at
    FROM public.transactions
    GROUP BY user_id
  ),
  rows AS (
    SELECT
      p.id,
      p.user_id,
      p.full_name,
      p.email,
      p.phone,
      p.document_number,
      p.seller_type,
      p.created_at AS profile_created_at,
      p.admin_notes,
      p.last_login_at,
      COALESCE(a.tx_count, 0) AS tx_count,
      COALESCE(a.tx_approved, 0) AS tx_approved,
      COALESCE(a.gross, 0) AS gross,
      COALESCE(a.net, 0) AS net,
      COALESCE(a.fees, 0) AS fees,
      COALESCE(a.refunded, 0) AS refunded,
      COALESCE(a.chargeback, 0) AS chargeback,
      a.last_tx_at,
      GREATEST(
        COALESCE(p.last_login_at, 'epoch'::timestamptz),
        COALESCE(a.last_tx_at, 'epoch'::timestamptz),
        COALESCE(p.created_at, 'epoch'::timestamptz)
      ) AS last_activity
    FROM public.profiles p
    LEFT JOIN agg a ON a.user_id = p.user_id
  ),
  filtered AS (
    SELECT *,
      GREATEST(0, EXTRACT(EPOCH FROM (now() - last_activity)) / 86400)::int AS days_since
    FROM rows
    WHERE last_activity < _cutoff
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'count', (SELECT COUNT(*) FROM filtered),
      'gross', (SELECT COALESCE(SUM(gross),0) FROM filtered),
      'fees',  (SELECT COALESCE(SUM(fees),0) FROM filtered),
      'avg_days', (SELECT COALESCE(ROUND(AVG(days_since))::int, 0) FROM filtered),
      'critical', (SELECT COUNT(*) FROM filtered WHERE days_since >= 30)
    ),
    'sellers', COALESCE((SELECT jsonb_agg(to_jsonb(filtered.*) ORDER BY days_since DESC) FROM filtered), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_inactive_sellers(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_admin_inactive_sellers(integer) TO authenticated;
