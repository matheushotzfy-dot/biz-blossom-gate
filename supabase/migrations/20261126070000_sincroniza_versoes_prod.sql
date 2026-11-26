-- Sincroniza o repositório com o banco de produção.
--
-- A auditoria de 26/11 comparou cada função das migrações com produção.
-- Nada das migrações ficou sem aplicar, mas três funções estão MAIS NOVAS
-- em produção do que no repositório (foram ajustadas direto no banco).
-- Esta migração grava aqui exatamente a versão que já roda em produção,
-- para que um banco novo montado a partir das migrações fique igual.
-- Em produção ela não muda nada.

-- 1) Saldo negativo: olha só quem teve lançamento nos últimos 15 minutos.
CREATE OR REPLACE FUNCTION public.detect_negative_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rec record;
  _found int := 0;
BEGIN
  -- Só é possível surgir saldo negativo onde houve lançamento novo.
  -- Em vez de agregar o ledger INTEIRO a cada 5 min (full scan + GROUP BY
  -- em milhões de linhas), restringimos aos usuários com atividade recente
  -- e somamos apenas o ledger DELES.
  FOR _rec IN
    WITH recent_users AS (
      SELECT DISTINCT user_id
      FROM public.financial_ledger
      WHERE created_at > now() - INTERVAL '15 minutes'
    ), balances AS (
      SELECT f.user_id, COALESCE(SUM(public.ledger_entry_effect(f.entry_type, f.amount)), 0) AS bal
      FROM public.financial_ledger f
      JOIN recent_users ru ON ru.user_id = f.user_id
      GROUP BY f.user_id
      HAVING COALESCE(SUM(public.ledger_entry_effect(f.entry_type, f.amount)), 0) < -0.01
    )
    SELECT * FROM balances
  LOOP
    _found := _found + 1;

    UPDATE public.profiles
    SET frozen = true, balance_frozen = true, updated_at = now()
    WHERE user_id = _rec.user_id AND COALESCE(frozen, false) = false;

    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'negative_balance'
        AND metadata ->> 'user_id' = _rec.user_id::text
        AND resolved_at IS NULL
    ) THEN
      INSERT INTO public.admin_alerts (kind, severity, message, metadata)
      VALUES ('negative_balance', 'critical',
              format('Saldo negativo detectado: R$ %s — conta congelada', to_char(_rec.bal, 'FM999G999D00')),
              jsonb_build_object('user_id', _rec.user_id, 'balance', _rec.bal));

      INSERT INTO public.notifications (user_id, title, message, type)
      SELECT ur.user_id, '🚨 Saldo negativo',
             format('Conta congelada automaticamente. Saldo: R$ %s', to_char(_rec.bal, 'FM999G999D00')),
             'security'
      FROM public.user_roles ur WHERE ur.role = 'admin'::app_role;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('negative_accounts', _found, 'checked_at', now());
END;
$function$;

-- 2) Reconciliação do ledger: roda de verdade uma vez por hora.
CREATE OR REPLACE FUNCTION public.run_ledger_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mismatches int;
  _orphans int;
BEGIN
  -- Reconciliação completa (GROUP BY no ledger inteiro + DISTINCT ON) é
  -- cara demais para rodar a cada 5 min com milhões de linhas.
  -- Executa de verdade apenas uma vez por hora (janela dos primeiros 5 min);
  -- nas outras chamadas retorna um skip barato.
  IF date_part('minute', now())::int >= 5 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'hourly_schedule', 'checked_at', now());
  END IF;

  WITH calculated AS (
    SELECT user_id, COALESCE(SUM(public.ledger_entry_effect(entry_type, amount)), 0) AS bal
    FROM public.financial_ledger GROUP BY user_id
  ), materialized AS (
    SELECT DISTINCT ON (user_id) user_id, balance_after
    FROM public.financial_ledger ORDER BY user_id, created_at DESC, id DESC
  )
  SELECT COUNT(*) INTO _mismatches
  FROM calculated c JOIN materialized m USING (user_id)
  WHERE ROUND(c.bal, 2) IS DISTINCT FROM ROUND(m.balance_after, 2);

  SELECT COUNT(*) INTO _orphans
  FROM public.transactions t
  WHERE t.status = 'completed' AND t.is_simulated = false
    AND t.created_at > now() - interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.financial_ledger f
      WHERE f.transaction_id = t.id AND f.entry_type = 'credit'
    );

  IF _mismatches > 0 OR _orphans > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind = 'ledger_divergence' AND resolved_at IS NULL
        AND created_at > now() - interval '1 hour'
    ) THEN
      INSERT INTO public.admin_alerts (kind, severity, message, metadata)
      VALUES ('ledger_divergence', 'critical',
              format('Reconciliação: %s saldos divergentes, %s vendas sem lançamento', _mismatches, _orphans),
              jsonb_build_object('mismatches', _mismatches, 'orphan_transactions', _orphans));
    END IF;
  END IF;

  RETURN jsonb_build_object('mismatches', _mismatches, 'orphan_transactions', _orphans, 'checked_at', now());
END;
$function$;

REVOKE ALL ON FUNCTION public.detect_negative_balances() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_ledger_reconciliation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_negative_balances() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_ledger_reconciliation() TO service_role;

-- 3) Analytics antigo do admin: lucro = taxa cobrada - custo do adquirente.
CREATE OR REPLACE FUNCTION app_private.get_admin_analytics(_period_days integer DEFAULT 30)
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
