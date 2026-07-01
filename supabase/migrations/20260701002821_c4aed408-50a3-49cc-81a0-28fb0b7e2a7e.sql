CREATE OR REPLACE FUNCTION public.backfill_financial_ledger_for_completed_tx(_limit int DEFAULT 1000)
RETURNS TABLE(processed int, credited numeric, feed numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx record;
  _fee_amount numeric;
  _processed int := 0;
  _credited numeric := 0;
  _feed numeric := 0;
  _bal numeric;
BEGIN
  -- Only admins can execute
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR _tx IN
    SELECT t.id, t.user_id, t.amount, t.net_amount
    FROM public.transactions t
    WHERE t.status = 'completed'
      AND NOT EXISTS (SELECT 1 FROM public.financial_ledger f WHERE f.transaction_id = t.id AND f.entry_type = 'credit')
    ORDER BY t.created_at ASC
    LIMIT GREATEST(1, LEAST(_limit, 5000))
  LOOP
    _fee_amount := COALESCE(_tx.amount, 0) - COALESCE(_tx.net_amount, 0);

    -- Current seller balance (net of all entries)
    SELECT COALESCE(SUM(amount), 0) INTO _bal
    FROM public.financial_ledger WHERE user_id = _tx.user_id;

    -- Credit entry for seller
    INSERT INTO public.financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES (_tx.user_id, _tx.id, 'credit', COALESCE(_tx.net_amount, 0), _bal + COALESCE(_tx.net_amount, 0),
            'Backfill — venda aprovada', 'backfill_credit_' || _tx.id)
    ON CONFLICT (idempotency_key) DO NOTHING;

    -- Fee entry (platform revenue)
    IF _fee_amount > 0 THEN
      INSERT INTO public.financial_ledger (user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (_tx.user_id, _tx.id, 'fee', _fee_amount, _bal + COALESCE(_tx.net_amount, 0),
              'Backfill — taxa da plataforma', 'backfill_fee_' || _tx.id)
      ON CONFLICT (idempotency_key) DO NOTHING;
      _feed := _feed + _fee_amount;
    END IF;

    _credited := _credited + COALESCE(_tx.net_amount, 0);
    _processed := _processed + 1;
  END LOOP;

  RETURN QUERY SELECT _processed, _credited, _feed;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_financial_ledger_for_completed_tx(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backfill_financial_ledger_for_completed_tx(int) TO authenticated, service_role;

-- Companion diagnostic function for admins to see the gap without side effects
CREATE OR REPLACE FUNCTION public.get_ledger_integrity_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'total_completed_tx',            (SELECT COUNT(*) FROM public.transactions WHERE status = 'completed'),
    'total_completed_tx_amount',     (SELECT COALESCE(SUM(net_amount), 0) FROM public.transactions WHERE status = 'completed'),
    'total_ledger_credit',           (SELECT COALESCE(SUM(amount), 0) FROM public.financial_ledger WHERE entry_type = 'credit'),
    'completed_tx_without_ledger',   (SELECT COUNT(*) FROM public.transactions t WHERE t.status = 'completed'
                                        AND NOT EXISTS (SELECT 1 FROM public.financial_ledger f WHERE f.transaction_id = t.id AND f.entry_type = 'credit')),
    'total_withdrawals',             (SELECT COALESCE(SUM(amount), 0) FROM public.withdrawals WHERE status IN ('approved','paid','completed','processing')),
    'sellers_with_negative_balance', (SELECT COUNT(*) FROM (SELECT user_id, SUM(amount) AS bal FROM public.financial_ledger GROUP BY user_id HAVING SUM(amount) < 0) x)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ledger_integrity_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ledger_integrity_report() TO authenticated, service_role;
