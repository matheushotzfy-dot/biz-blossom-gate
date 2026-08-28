CREATE OR REPLACE FUNCTION public.admin_get_seller_balances()
RETURNS TABLE(user_id uuid, balance numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT p.user_id,
         COALESCE(SUM(public.ledger_entry_effect(l.entry_type, l.amount)), 0)::numeric AS balance
  FROM public.profiles p
  LEFT JOIN public.financial_ledger l ON l.user_id = p.user_id
  GROUP BY p.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_seller_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_financial_overview(
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
  _summary jsonb;
  _series jsonb;
  _month jsonb;
  _operations jsonb;
BEGIN
  IF _uid IS NULL OR NOT (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'employee'::app_role)
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  IF _from IS NULL OR _to IS NULL OR _from > _to THEN
    RAISE EXCEPTION 'invalid date range';
  END IF;

  SELECT jsonb_build_object(
    'total_count', count(*),
    'approved_count', count(*) FILTER (WHERE status IN ('approved','paid','completed')),
    'pending_count', count(*) FILTER (WHERE status IN ('pending','processing','waiting_payment','authorized')),
    'failed_count', count(*) FILTER (WHERE status IN ('failed','expired','rejected','refused','error','cancelled','canceled')),
    'refunded_count', count(*) FILTER (WHERE status IN ('refunded','partially_refunded') OR refunded_amount > 0),
    'chargeback_count', count(*) FILTER (WHERE status IN ('chargeback','chargedback','charged_back')),
    'disputed_count', count(*) FILTER (WHERE status IN ('med','mediation','dispute','disputed','in_protest')),
    'gross_volume', COALESCE(sum(amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'net_volume', COALESCE(sum(net_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'platform_fees', COALESCE(sum(fee_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'acquirer_fees', COALESCE(sum(acquirer_fee_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'profit', COALESCE(sum(fee_amount-acquirer_fee_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'refunded_amount', COALESCE(sum(refunded_amount),0),
    'retained_amount', COALESCE(sum(retained_amount) FILTER (WHERE status IN ('approved','paid','completed') AND NOT retention_released),0),
    'active_sellers', count(DISTINCT user_id) FILTER (WHERE status IN ('approved','paid','completed')),
    'simulated_count', count(*) FILTER (WHERE is_simulated)
  ) INTO _summary
  FROM public.transactions
  WHERE created_at >= _from AND created_at <= _to;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'bucket', bucket_value,
    'gross', gross,
    'net', net,
    'fees', fees,
    'profit', profit,
    'count', qty
  ) ORDER BY bucket_value), '[]'::jsonb)
  INTO _series
  FROM (
    SELECT CASE
      WHEN _bucket = 'hour' THEN date_trunc('hour', created_at AT TIME ZONE 'America/Sao_Paulo')
      WHEN _bucket = 'month' THEN date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo')
      ELSE date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')
    END AS bucket_value,
    COALESCE(sum(amount),0) AS gross,
    COALESCE(sum(net_amount),0) AS net,
    COALESCE(sum(fee_amount),0) AS fees,
    COALESCE(sum(fee_amount-acquirer_fee_amount),0) AS profit,
    count(*) AS qty
    FROM public.transactions
    WHERE created_at >= _from AND created_at <= _to
      AND status IN ('approved','paid','completed')
    GROUP BY 1
  ) s;

  SELECT jsonb_build_object(
    'gross_volume', COALESCE(sum(amount),0),
    'net_volume', COALESCE(sum(net_amount),0),
    'approved_count', count(*),
    'platform_fees', COALESCE(sum(fee_amount),0),
    'profit', COALESCE(sum(fee_amount-acquirer_fee_amount),0)
  ) INTO _month
  FROM public.transactions
  WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
    AND status IN ('approved','paid','completed');

  SELECT jsonb_build_object(
    'pending_withdrawals_count', (SELECT count(*) FROM public.withdrawals WHERE status IN ('pending','processing')),
    'pending_withdrawals_amount', (SELECT COALESCE(sum(amount),0) FROM public.withdrawals WHERE status IN ('pending','processing')),
    'approved_withdrawals_amount', (SELECT COALESCE(sum(amount),0) FROM public.withdrawals WHERE status = 'approved' AND created_at >= _from AND created_at <= _to),
    'open_disputes_count', (SELECT count(*) FROM public.disputes WHERE status IN ('open','in_review')),
    'open_disputes_amount', (SELECT COALESCE(sum(amount),0) FROM public.disputes WHERE status IN ('open','in_review')),
    'refunds_amount', (SELECT COALESCE(sum(refunded_amount),0) FROM public.transactions WHERE refunded_amount > 0 AND updated_at >= _from AND updated_at <= _to)
  ) INTO _operations;

  RETURN jsonb_build_object('summary',_summary,'series',_series,'month',_month,'operations',_operations);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_financial_overview(timestamptz,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_financial_overview(timestamptz,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_transactions_page(
  _from timestamptz,
  _to timestamptz,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 80,
  _status text DEFAULT NULL,
  _method text DEFAULT NULL,
  _seller_id uuid DEFAULT NULL,
  _search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _safe_page integer := GREATEST(COALESCE(_page,1),1);
  _safe_size integer := LEAST(GREATEST(COALESCE(_page_size,80),1),200);
  _offset integer;
  _items jsonb;
  _total bigint;
  _totals jsonb;
BEGIN
  IF _uid IS NULL OR NOT (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'employee'::app_role)
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  _offset := (_safe_page - 1) * _safe_size;

  WITH filtered AS (
    SELECT t.*
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.user_id=t.user_id
    WHERE t.created_at >= _from AND t.created_at <= _to
      AND (_status IS NULL OR _status='' OR _status='all'
        OR (_status='completed' AND t.status IN ('approved','paid','completed'))
        OR (_status<>'completed' AND t.status=_status))
      AND (_method IS NULL OR _method='' OR _method='all' OR t.payment_method=_method)
      AND (_seller_id IS NULL OR t.user_id=_seller_id)
      AND (_search IS NULL OR btrim(_search)='' OR
        t.id::text ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(t.external_id,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(t.customer_name,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(t.customer_email,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(t.customer_document,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(p.full_name,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(p.email,'') ILIKE '%'||btrim(_search)||'%')
  )
  SELECT count(*), jsonb_build_object(
    'gross',COALESCE(sum(amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'net',COALESCE(sum(net_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'fees',COALESCE(sum(fee_amount) FILTER (WHERE status IN ('approved','paid','completed')),0),
    'approved',count(*) FILTER (WHERE status IN ('approved','paid','completed')),
    'pending',count(*) FILTER (WHERE status IN ('pending','processing','waiting_payment','authorized')),
    'failed',count(*) FILTER (WHERE status IN ('failed','expired','rejected','refused','error','cancelled','canceled')),
    'refunded',count(*) FILTER (WHERE status IN ('refunded','partially_refunded') OR refunded_amount>0),
    'chargeback',count(*) FILTER (WHERE status IN ('chargeback','chargedback','charged_back')),
    'simulated',count(*) FILTER (WHERE is_simulated)
  ) INTO _total,_totals FROM filtered;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO _items
  FROM (
    SELECT t.*
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.user_id=t.user_id
    WHERE t.created_at >= _from AND t.created_at <= _to
      AND (_status IS NULL OR _status='' OR _status='all'
        OR (_status='completed' AND t.status IN ('approved','paid','completed'))
        OR (_status<>'completed' AND t.status=_status))
      AND (_method IS NULL OR _method='' OR _method='all' OR t.payment_method=_method)
      AND (_seller_id IS NULL OR t.user_id=_seller_id)
      AND (_search IS NULL OR btrim(_search)='' OR
        t.id::text ILIKE '%'||btrim(_search)||'%' OR COALESCE(t.external_id,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(t.customer_name,'') ILIKE '%'||btrim(_search)||'%' OR COALESCE(t.customer_email,'') ILIKE '%'||btrim(_search)||'%' OR
        COALESCE(t.customer_document,'') ILIKE '%'||btrim(_search)||'%' OR COALESCE(p.full_name,'') ILIKE '%'||btrim(_search)||'%' OR COALESCE(p.email,'') ILIKE '%'||btrim(_search)||'%')
    ORDER BY t.created_at DESC
    LIMIT _safe_size OFFSET _offset
  ) x;

  RETURN jsonb_build_object('items',_items,'total',_total,'page',_safe_page,'page_size',_safe_size,'totals',_totals);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_transactions_page(timestamptz,timestamptz,integer,integer,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_transactions_page(timestamptz,timestamptz,integer,integer,text,text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_transaction_refund(
  _transaction_id uuid,
  _amount numeric,
  _reason text,
  _admin_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _new_total numeric;
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'service role only';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'invalid refund request';
  END IF;

  SELECT * INTO _tx FROM public.transactions WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;
  IF _tx.is_simulated THEN RAISE EXCEPTION 'simulated transaction cannot be refunded'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed','partially_refunded') THEN
    RAISE EXCEPTION 'transaction is not refundable';
  END IF;

  _new_total := ROUND(COALESCE(_tx.refunded_amount,0)+_amount,2);
  IF _new_total > _tx.amount THEN RAISE EXCEPTION 'refund exceeds remaining amount'; END IF;

  UPDATE public.transactions
  SET refunded_amount=_new_total,
      status=CASE WHEN _new_total >= amount THEN 'refunded' ELSE status END,
      metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
        'last_refund_reason',left(btrim(_reason),500),
        'last_refund_admin_id',_admin_user_id,
        'last_refund_at',now()
      ),
      updated_at=now()
  WHERE id=_transaction_id;

  RETURN jsonb_build_object('transaction_id',_transaction_id,'refunded_amount',_new_total,'partial',_new_total<_tx.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.record_transaction_refund(uuid,numeric,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_transaction_refund(uuid,numeric,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_data(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _tx_limit integer DEFAULT 2000,
  _profile_limit integer DEFAULT 1000,
  _product_limit integer DEFAULT 1000,
  _withdrawal_limit integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx_limit_safe integer := LEAST(GREATEST(COALESCE(_tx_limit, 2000), 1), 5000);
  _profile_limit_safe integer := LEAST(GREATEST(COALESCE(_profile_limit, 1000), 1), 3000);
  _product_limit_safe integer := LEAST(GREATEST(COALESCE(_product_limit, 1000), 1), 3000);
  _withdrawal_limit_safe integer := LEAST(GREATEST(COALESCE(_withdrawal_limit, 2000), 1), 5000);
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role)) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  RETURN jsonb_build_object(
    'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT * FROM public.transactions WHERE created_at>=_from AND created_at<=_to ORDER BY created_at DESC LIMIT _tx_limit_safe)t),'[]'::jsonb),
    'profiles',COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT _profile_limit_safe)p),'[]'::jsonb),
    'products',COALESCE((SELECT jsonb_agg(to_jsonb(pr)) FROM (SELECT * FROM public.products ORDER BY created_at DESC LIMIT _product_limit_safe)pr),'[]'::jsonb),
    'withdrawals',COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM (SELECT * FROM public.withdrawals WHERE (created_at>=_from AND created_at<=_to) OR status IN ('pending','processing') ORDER BY created_at DESC LIMIT _withdrawal_limit_safe)w),'[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_data(timestamptz,timestamptz,integer,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz,timestamptz,integer,integer,integer,integer) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_transactions_created_status ON public.transactions(created_at DESC,status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created_desc ON public.transactions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created_desc ON public.withdrawals(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_type_status_created_desc ON public.disputes(type,status,created_at DESC);