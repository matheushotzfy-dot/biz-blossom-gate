
CREATE OR REPLACE FUNCTION public.get_admin_analytics(_period_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_employee boolean;
  v_now timestamptz := now();
  v_start timestamptz;
  v_prev_start timestamptz;
  v_result jsonb;
  v_totals jsonb;
  v_prev_totals jsonb;
  v_daily jsonb;
  v_methods jsonb;
  v_status_mix jsonb;
  v_top_sellers jsonb;
  v_heatmap jsonb;
  v_funnel jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT public.has_role(v_uid, 'admin')    INTO v_is_admin;
  SELECT public.has_role(v_uid, 'employee') INTO v_is_employee;
  IF NOT (v_is_admin OR v_is_employee) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _period_days IS NULL OR _period_days < 1 THEN _period_days := 30; END IF;
  IF _period_days > 730 THEN _period_days := 730; END IF;

  v_start := v_now - make_interval(days => _period_days);
  v_prev_start := v_start - make_interval(days => _period_days);

  -- Totals current (profit = fee_amount - acquirer_fee_amount)
  SELECT jsonb_build_object(
    'tx_count',      count(*),
    'approved',      count(*) FILTER (WHERE status IN ('approved','completed')),
    'failed',        count(*) FILTER (WHERE status IN ('failed','expired')),
    'refunded',      count(*) FILTER (WHERE status IN ('refunded','chargeback')),
    'pending',       count(*) FILTER (WHERE status = 'pending'),
    'tpv',           coalesce(sum(amount) FILTER (WHERE status IN ('approved','completed')), 0),
    'profit',        coalesce(sum(coalesce(fee_amount,0) - coalesce(acquirer_fee_amount,0)) FILTER (WHERE status IN ('approved','completed')), 0),
    'active_sellers',count(DISTINCT user_id) FILTER (WHERE status IN ('approved','completed'))
  )
  INTO v_totals
  FROM public.transactions
  WHERE created_at >= v_start AND created_at <= v_now;

  SELECT jsonb_build_object(
    'tx_count',      count(*),
    'approved',      count(*) FILTER (WHERE status IN ('approved','completed')),
    'tpv',           coalesce(sum(amount) FILTER (WHERE status IN ('approved','completed')), 0),
    'profit',        coalesce(sum(coalesce(fee_amount,0) - coalesce(acquirer_fee_amount,0)) FILTER (WHERE status IN ('approved','completed')), 0),
    'active_sellers',count(DISTINCT user_id) FILTER (WHERE status IN ('approved','completed'))
  )
  INTO v_prev_totals
  FROM public.transactions
  WHERE created_at >= v_prev_start AND created_at < v_start;

  WITH days AS (
    SELECT generate_series(date_trunc('day', v_start), date_trunc('day', v_now), interval '1 day')::date AS d
  ),
  cur AS (
    SELECT date_trunc('day', created_at)::date AS d,
           sum(amount) FILTER (WHERE status IN ('approved','completed')) AS tpv,
           sum(coalesce(fee_amount,0) - coalesce(acquirer_fee_amount,0)) FILTER (WHERE status IN ('approved','completed')) AS profit,
           count(*) FILTER (WHERE status IN ('approved','completed')) AS vendas
    FROM public.transactions
    WHERE created_at >= v_start AND created_at <= v_now
    GROUP BY 1
  ),
  prev AS (
    SELECT (date_trunc('day', created_at)::date + (_period_days || ' days')::interval)::date AS d,
           sum(amount) FILTER (WHERE status IN ('approved','completed')) AS prev_tpv
    FROM public.transactions
    WHERE created_at >= v_prev_start AND created_at < v_start
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', to_char(days.d, 'DD/MM'),
    'tpv', coalesce(cur.tpv, 0),
    'profit', coalesce(cur.profit, 0),
    'vendas', coalesce(cur.vendas, 0),
    'prev', coalesce(prev.prev_tpv, 0)
  ) ORDER BY days.d), '[]'::jsonb)
  INTO v_daily
  FROM days
  LEFT JOIN cur ON cur.d = days.d
  LEFT JOIN prev ON prev.d = days.d;

  SELECT coalesce(jsonb_agg(row_to_json(m) ORDER BY (m.volume) DESC), '[]'::jsonb)
  INTO v_methods
  FROM (
    SELECT
      coalesce(payment_method, 'other') AS method,
      count(*) AS total,
      count(*) FILTER (WHERE status IN ('approved','completed')) AS approved,
      coalesce(sum(amount) FILTER (WHERE status IN ('approved','completed')), 0) AS volume,
      coalesce(sum(coalesce(fee_amount,0) - coalesce(acquirer_fee_amount,0)) FILTER (WHERE status IN ('approved','completed')), 0) AS profit
    FROM public.transactions
    WHERE created_at >= v_start AND created_at <= v_now
    GROUP BY 1
  ) m;

  SELECT coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_status_mix
  FROM (
    SELECT status, count(*) AS c
    FROM public.transactions
    WHERE created_at >= v_start AND created_at <= v_now
    GROUP BY status
  ) s;

  SELECT coalesce(jsonb_agg(row_to_json(ts) ORDER BY ts.volume DESC), '[]'::jsonb)
  INTO v_top_sellers
  FROM (
    SELECT t.user_id,
           coalesce(sum(t.amount), 0) AS volume,
           count(*) AS vendas,
           coalesce(p.full_name, split_part(p.email, '@', 1), substr(t.user_id::text, 1, 6)) AS name
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE t.created_at >= v_start AND t.created_at <= v_now
      AND t.status IN ('approved','completed')
    GROUP BY t.user_id, p.full_name, p.email
    ORDER BY volume DESC
    LIMIT 10
  ) ts;

  SELECT coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'volume', volume)), '[]'::jsonb)
  INTO v_heatmap
  FROM (
    SELECT extract(dow from created_at)::int AS dow,
           extract(hour from created_at)::int AS hour,
           coalesce(sum(amount), 0) AS volume
    FROM public.transactions
    WHERE created_at >= v_start AND created_at <= v_now
      AND status IN ('approved','completed')
    GROUP BY 1, 2
  ) h;

  WITH approved_buyers AS (
    SELECT customer_email, count(*) AS n
    FROM public.transactions
    WHERE created_at >= v_start AND created_at <= v_now
      AND status IN ('approved','completed')
      AND customer_email IS NOT NULL AND customer_email <> ''
    GROUP BY customer_email
  )
  SELECT jsonb_build_object(
    'unique_buyers', count(*),
    'repeat_buyers', count(*) FILTER (WHERE n > 1)
  )
  INTO v_funnel
  FROM approved_buyers;

  v_result := jsonb_build_object(
    'period_days', _period_days,
    'from', v_start,
    'to', v_now,
    'totals', v_totals,
    'previous', v_prev_totals,
    'daily', v_daily,
    'methods', v_methods,
    'status_mix', v_status_mix,
    'top_sellers', v_top_sellers,
    'heatmap', v_heatmap,
    'funnel', v_funnel
  );

  RETURN v_result;
END;
$function$;
