
-- Notify sellers on KYC approve/reject and freeze actions, and expose a single
-- canonical seller-balance source so admin views agree with the seller dashboard.

CREATE OR REPLACE FUNCTION public.admin_approve_kyc(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
     SET account_status = 'approved',
         kyc_rejection_reason = NULL
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (_caller, 'approve_kyc', 'profile', _user_id::text,
          jsonb_build_object('new_status', 'approved'));

  INSERT INTO public.notifications (user_id, title, message, type, created_by)
  VALUES (_user_id, 'KYC aprovado',
          'Seu cadastro foi aprovado. Você já pode operar normalmente na plataforma.',
          'success', _caller);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_kyc(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _r text := COALESCE(NULLIF(btrim(_reason), ''), 'sem motivo informado');
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
     SET account_status = 'rejected',
         kyc_rejection_reason = _r
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (_caller, 'reject_kyc', 'profile', _user_id::text,
          jsonb_build_object('reason', _r));

  INSERT INTO public.notifications (user_id, title, message, type, created_by)
  VALUES (_user_id, 'KYC recusado',
          'Seu cadastro foi recusado. Motivo: ' || _r || '. Ajuste e reenvie a documentação.',
          'warning', _caller);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_freeze_account(_user_id uuid, _freeze boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
     SET balance_frozen = _freeze
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (_caller,
          CASE WHEN _freeze THEN 'freeze_balance' ELSE 'unfreeze_balance' END,
          'profile', _user_id::text,
          jsonb_build_object('freeze', _freeze, 'reason', _reason));

  INSERT INTO public.notifications (user_id, title, message, type, created_by)
  VALUES (_user_id,
          CASE WHEN _freeze THEN 'Saldo congelado' ELSE 'Saldo descongelado' END,
          CASE WHEN _freeze
               THEN 'Seu saldo foi congelado pelo time de risco. Saques estão temporariamente bloqueados.' ||
                    COALESCE(' Motivo: ' || _reason, '')
               ELSE 'Seu saldo foi descongelado. Saques liberados novamente.' END,
          CASE WHEN _freeze THEN 'warning' ELSE 'success' END,
          _caller);
END;
$$;

-- Canonical per-seller balance for admin listings. Mirrors get_ledger_balance
-- conceptually but returns one row per user in a single round trip.
CREATE OR REPLACE FUNCTION public.admin_get_seller_balances()
RETURNS TABLE(user_id uuid, balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH net_in AS (
    SELECT t.user_id, COALESCE(SUM(t.net_amount), 0) AS v
      FROM public.transactions t
     WHERE t.status IN ('approved','completed')
     GROUP BY t.user_id
  ),
  approved_out AS (
    SELECT w.user_id, COALESCE(SUM(w.amount), 0) AS v
      FROM public.withdrawals w
     WHERE w.status = 'approved'
     GROUP BY w.user_id
  ),
  pending_out AS (
    SELECT w.user_id, COALESCE(SUM(w.amount), 0) AS v
      FROM public.withdrawals w
     WHERE w.status = 'pending'
     GROUP BY w.user_id
  ),
  adj AS (
    SELECT a.user_id,
           COALESCE(SUM(CASE WHEN a.type='credit' THEN a.amount ELSE -a.amount END), 0) AS v
      FROM public.balance_adjustments a
     GROUP BY a.user_id
  ),
  ids AS (
    SELECT user_id FROM net_in
    UNION SELECT user_id FROM approved_out
    UNION SELECT user_id FROM pending_out
    UNION SELECT user_id FROM adj
  )
  SELECT i.user_id,
         COALESCE(n.v,0) - COALESCE(ao.v,0) - COALESCE(po.v,0) + COALESCE(aj.v,0)
    FROM ids i
    LEFT JOIN net_in       n  ON n.user_id  = i.user_id
    LEFT JOIN approved_out ao ON ao.user_id = i.user_id
    LEFT JOIN pending_out  po ON po.user_id = i.user_id
    LEFT JOIN adj          aj ON aj.user_id = i.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_freeze_account(uuid, boolean, text) TO authenticated;
