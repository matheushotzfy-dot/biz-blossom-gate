
CREATE OR REPLACE FUNCTION app_private.revoke_access_for_tx(_tx uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_access SET status='revoked', revoked_at=now() WHERE transaction_id=_tx AND status IS DISTINCT FROM 'revoked';
$$;
REVOKE ALL ON FUNCTION app_private.revoke_access_for_tx(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION app_private.admin_resolve_dispute(_dispute_id uuid, _outcome text, _fee numeric DEFAULT 0, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _d public.disputes%ROWTYPE; _bal numeric; _fee_v numeric := ROUND(COALESCE(_fee,0),2);
BEGIN
  IF _outcome NOT IN ('seller','buyer') THEN RAISE EXCEPTION 'resultado inválido'; END IF;
  IF _fee_v < 0 OR _fee_v > 10000 THEN RAISE EXCEPTION 'taxa inválida'; END IF;
  SELECT * INTO _d FROM public.disputes WHERE id = _dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não encontrada'; END IF;
  IF _d.status NOT IN ('open','in_review') THEN RAISE EXCEPTION 'disputa já encerrada'; END IF;

  UPDATE public.disputes SET status = CASE WHEN _outcome='seller' THEN 'resolved_seller' ELSE 'resolved_buyer' END,
    won_by_seller = (_outcome='seller'), admin_user_id = _admin, fee_amount = CASE WHEN _outcome='buyer' THEN _fee_v ELSE 0 END,
    admin_notes = COALESCE(left(_note,2000), admin_notes), resolved_at = now()
  WHERE id = _dispute_id;

  IF _outcome = 'buyer' THEN
    IF _d.transaction_id IS NOT NULL THEN PERFORM app_private.revoke_access_for_tx(_d.transaction_id); END IF;
    IF _fee_v > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext(_d.seller_user_id::text));
      _bal := public.calculate_ledger_balance(_d.seller_user_id);
      INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (_d.seller_user_id, _d.transaction_id, 'debit', _fee_v, _bal - _fee_v, 'Taxa de disputa', 'dispute_fee_'||_dispute_id)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note)
  VALUES (_dispute_id, _admin, CASE WHEN _outcome='seller' THEN 'won_by_seller' ELSE 'lost_by_seller' END, _note);
  PERFORM app_private.admin_audit(_admin,'dispute_resolve','dispute',_dispute_id::text, jsonb_build_object('outcome',_outcome,'fee',_fee_v));
END $$;

CREATE OR REPLACE FUNCTION app_private.admin_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := app_private.assert_admin(); _res jsonb;
BEGIN
  _res := public.record_transaction_refund(_transaction_id, ROUND(_amount,2), _reason, _admin);
  IF NOT (_res->>'partial')::boolean THEN PERFORM app_private.revoke_access_for_tx(_transaction_id); END IF;
  PERFORM app_private.admin_audit(_admin,'transaction_refund','transaction',_transaction_id::text,
    jsonb_build_object('amount',_amount,'reason',left(_reason,500)) || _res);
  RETURN _res;
END $$;
