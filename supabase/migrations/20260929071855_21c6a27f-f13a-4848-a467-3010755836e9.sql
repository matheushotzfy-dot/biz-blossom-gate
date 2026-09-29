CREATE OR REPLACE FUNCTION app_private.get_financial_series(_from timestamptz, _to timestamptz, _seller uuid, _acquirer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _v uuid := app_private.assert_metrics_viewer();
  _paid text[] := ARRAY['approved','paid','completed','partially_refunded','refunded','chargeback','chargedback'];
  _days jsonb; _sellers jsonb;
BEGIN
  IF _to <= _from OR _to - _from > interval '400 days' THEN RAISE EXCEPTION 'período inválido'; END IF;
  WITH d AS (
    SELECT g::date AS dy FROM generate_series(date_trunc('day', _from AT TIME ZONE 'America/Sao_Paulo'), date_trunc('day', (_to - interval '1 second') AT TIME ZONE 'America/Sao_Paulo'), interval '1 day') g
  ), tin AS (
    SELECT (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dy, sum(t.amount) AS gross, sum(t.fee_amount) AS fee, COALESCE(sum(t.acquirer_fee_amount),0) AS acq
    FROM transactions t WHERE t.status = ANY(_paid) AND t.created_at >= _from AND t.created_at < _to AND NOT COALESCE(t.is_simulated,false)
      AND (_seller IS NULL OR t.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer) GROUP BY 1
  ), tout AS (
    SELECT (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dy, sum(abs(l.amount)) AS outflow
    FROM financial_ledger l LEFT JOIN transactions t ON t.id = l.transaction_id
    WHERE l.entry_type IN ('refund','chargeback','dispute_debit','med_loss') AND l.created_at >= _from AND l.created_at < _to
      AND (_seller IS NULL OR l.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer) GROUP BY 1
  ), wd AS (
    SELECT (w.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dy, sum(w.amount) AS paid
    FROM withdrawals w WHERE w.status IN ('completed','paid') AND w.created_at >= _from AND w.created_at < _to
      AND (_seller IS NULL OR w.user_id = _seller) GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', to_char(d.dy,'YYYY-MM-DD'),
     'entradas', COALESCE(tin.gross,0), 'saidas', COALESCE(tout.outflow,0) + COALESCE(wd.paid,0),
     'taxas', COALESCE(tin.fee,0), 'custo_adquirente', COALESCE(tin.acq,0)) ORDER BY d.dy),'[]') INTO _days
  FROM d LEFT JOIN tin USING(dy) LEFT JOIN tout USING(dy) LEFT JOIN wd USING(dy);

  SELECT COALESCE(jsonb_agg(x.s ORDER BY (x.s->>'entradas')::numeric DESC),'[]') INTO _sellers FROM (
    SELECT jsonb_build_object('seller', t.user_id, 'name', COALESCE(p.full_name, p.email, 'Seller'),
      'entradas', sum(t.amount), 'taxas', sum(t.fee_amount), 'vendas', count(*)) AS s
    FROM transactions t LEFT JOIN profiles p ON p.user_id = t.user_id
    WHERE t.status = ANY(_paid) AND t.created_at >= _from AND t.created_at < _to AND NOT COALESCE(t.is_simulated,false)
      AND (_seller IS NULL OR t.user_id = _seller) AND (_acquirer IS NULL OR t.acquirer_id = _acquirer)
    GROUP BY t.user_id, p.full_name, p.email ORDER BY sum(t.amount) DESC LIMIT 10) x;
  RETURN jsonb_build_object('days', _days, 'sellers', _sellers);
END $$;
REVOKE ALL ON FUNCTION app_private.get_financial_series(timestamptz,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_financial_series(timestamptz,timestamptz,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_financial_series(_from timestamptz, _to timestamptz, _seller uuid DEFAULT NULL, _acquirer uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT app_private.get_financial_series(_from,_to,_seller,_acquirer) $$;
REVOKE ALL ON FUNCTION public.get_financial_series(timestamptz,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_series(timestamptz,timestamptz,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.get_seller_balance_by_acquirer(_seller uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM app_private.assert_admin();
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('acquirer', COALESCE(a.name,'Sem adquirente'), 'vendas', x.n,
      'bruto', x.gross, 'liquido', x.net, 'custo', x.acq, 'reembolsado', x.ref) ORDER BY x.gross DESC),'[]')
    FROM (SELECT t.acquirer_id, count(*) AS n, sum(t.amount) AS gross, sum(t.net_amount) AS net, COALESCE(sum(t.acquirer_fee_amount),0) AS acq, COALESCE(sum(t.refunded_amount),0) AS ref
          FROM transactions t WHERE t.user_id = _seller AND NOT COALESCE(t.is_simulated,false)
            AND t.status IN ('approved','paid','completed','partially_refunded','refunded','chargeback','chargedback')
          GROUP BY t.acquirer_id) x LEFT JOIN acquirers a ON a.id = x.acquirer_id);
END $$;
REVOKE ALL ON FUNCTION app_private.get_seller_balance_by_acquirer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_seller_balance_by_acquirer(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_seller_balance_by_acquirer(_seller uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT app_private.get_seller_balance_by_acquirer(_seller) $$;
REVOKE ALL ON FUNCTION public.get_seller_balance_by_acquirer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_balance_by_acquirer(uuid) TO authenticated;