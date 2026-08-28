CREATE OR REPLACE FUNCTION public.get_seller_dashboard_stats(
  _from timestamptz,
  _to timestamptz,
  _bucket text DEFAULT 'day'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _len interval;
  _prev_from timestamptz;
  _prev_to timestamptz;
  _cur jsonb;
  _prev jsonb;
  _series jsonb;
  _global jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  _len := _to - _from;
  _prev_to := _from - interval '1 millisecond';
  _prev_from := _prev_to - _len;

  SELECT jsonb_build_object(
    'total_count', count(*),
    'approved_count', count(*) FILTER (WHERE status IN ('approved','completed','paid')),
    'revenue', COALESCE(sum(amount) FILTER (WHERE status IN ('approved','completed','paid')), 0),
    'net_revenue', COALESCE(sum(net_amount) FILTER (WHERE status IN ('approved','completed','paid')), 0),
    'unique_customers', count(DISTINCT customer_email),
    'chargeback_count', count(*) FILTER (WHERE status = 'chargeback'),
    'pix_total', count(*) FILTER (WHERE payment_method = 'pix'),
    'pix_approved', count(*) FILTER (WHERE payment_method = 'pix' AND status IN ('approved','completed','paid')),
    'card_total', count(*) FILTER (WHERE payment_method IN ('credit_card','card')),
    'card_approved', count(*) FILTER (WHERE payment_method IN ('credit_card','card') AND status IN ('approved','completed','paid')),
    'boleto_total', count(*) FILTER (WHERE payment_method = 'boleto'),
    'boleto_approved', count(*) FILTER (WHERE payment_method = 'boleto' AND status IN ('approved','completed','paid'))
  )
  INTO _cur
  FROM public.transactions
  WHERE user_id = _uid AND created_at >= _from AND created_at <= _to;

  SELECT jsonb_build_object(
    'approved_count', count(*) FILTER (WHERE status IN ('approved','completed','paid')),
    'revenue', COALESCE(sum(amount) FILTER (WHERE status IN ('approved','completed','paid')), 0)
  )
  INTO _prev
  FROM public.transactions
  WHERE user_id = _uid AND created_at >= _prev_from AND created_at <= _prev_to;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', b, 'revenue', rev, 'count', cnt) ORDER BY b), '[]'::jsonb)
  INTO _series
  FROM (
    SELECT
      CASE
        WHEN _bucket = 'hour' THEN date_trunc('hour', created_at AT TIME ZONE 'America/Sao_Paulo')
        WHEN _bucket = 'month' THEN date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo')
        ELSE date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')
      END AS b,
      COALESCE(sum(amount), 0) AS rev,
      count(*) AS cnt
    FROM public.transactions
    WHERE user_id = _uid
      AND created_at >= _from AND created_at <= _to
      AND status IN ('approved','completed','paid')
    GROUP BY 1
  ) s;

  SELECT jsonb_build_object(
    'pending_balance', COALESCE(sum(
        CASE WHEN status IN ('approved','completed','paid') AND retained_until IS NOT NULL AND retained_until > now()
             THEN GREATEST(net_amount, 0) ELSE 0 END), 0),
    'received_today', COALESCE(sum(
        CASE WHEN status IN ('approved','completed','paid')
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
             THEN amount ELSE 0 END), 0),
    'disputed_amount', COALESCE(sum(
        CASE WHEN status IN ('med','mediation','dispute','disputed','chargeback') THEN amount ELSE 0 END), 0)
  )
  INTO _global
  FROM public.transactions
  WHERE user_id = _uid AND created_at >= now() - interval '400 days';

  RETURN jsonb_build_object(
    'current', _cur,
    'previous', _prev,
    'series', _series,
    'global', _global,
    'range', jsonb_build_object('from', _from, 'to', _to, 'bucket', _bucket)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_dashboard_stats(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_dashboard_stats(timestamptz, timestamptz, text) TO authenticated;