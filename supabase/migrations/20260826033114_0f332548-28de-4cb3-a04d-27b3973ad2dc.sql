
-- =========================================================
-- BLOCO 7: limites de saque + antifraude
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _min_amount numeric := 10.00;
  _max_per_day int := 10;
  _max_volume_day numeric := 200000.00;
  _count_day int;
  _volume_day numeric;
  _account_age interval;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount < _min_amount THEN
    RAISE EXCEPTION 'Valor mínimo de saque é R$ %', to_char(_min_amount, 'FM999G999D00');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO _count_day, _volume_day
  FROM public.withdrawals
  WHERE user_id = NEW.user_id
    AND status <> 'rejected'
    AND created_at > now() - interval '24 hours';

  IF _count_day >= _max_per_day THEN
    RAISE EXCEPTION 'Limite de % saques em 24h atingido. Tente novamente mais tarde.', _max_per_day;
  END IF;

  IF (_volume_day + NEW.amount) > _max_volume_day THEN
    RAISE EXCEPTION 'Limite diário de saque excedido (R$ %). Solicitado hoje: R$ %',
      to_char(_max_volume_day, 'FM999G999D00'), to_char(_volume_day, 'FM999G999D00');
  END IF;

  SELECT now() - created_at INTO _account_age
  FROM public.profiles WHERE user_id = NEW.user_id;

  IF NEW.amount >= 20000 OR COALESCE(_account_age, interval '999 days') < interval '24 hours' THEN
    INSERT INTO public.admin_alerts (kind, severity, message, metadata)
    VALUES (
      'withdrawal_risk',
      CASE WHEN NEW.amount >= 50000 THEN 'critical' ELSE 'warning' END,
      format('Saque de risco: R$ %s (conta com %s)',
             to_char(NEW.amount, 'FM999G999D00'), COALESCE(_account_age::text, 'idade desconhecida')),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'amount', NEW.amount,
        'withdrawal_type', COALESCE(NEW.withdrawal_type, 'pix'),
        'account_age', COALESCE(_account_age::text, 'unknown'),
        'withdrawals_last_24h', _count_day
      )
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT ur.user_id,
           '🚨 Saque de risco',
           format('Vendedor solicitou R$ %s. Revise antes de aprovar.', to_char(NEW.amount, 'FM999G999D00')),
           'security'
    FROM public.user_roles ur WHERE ur.role = 'admin'::app_role;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_withdrawal_limits ON public.withdrawals;
CREATE TRIGGER trg_enforce_withdrawal_limits
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_limits();

-- =========================================================
-- Janela máxima para pagamento tardio de cobrança expirada
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_late_payment_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'expired'
     AND NEW.status IN ('completed', 'paid', 'approved')
     AND OLD.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Cobrança expirada há mais de 7 dias não pode ser confirmada como paga';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_late_payment_window ON public.transactions;
CREATE TRIGGER trg_enforce_late_payment_window
BEFORE UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_late_payment_window();

-- =========================================================
-- BLOCO 8: trilha de auditoria em dados sensíveis
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _before jsonb;
  _after jsonb;
  _redact text[] := ARRAY['key_value','key_value_enc','account_number','account_number_enc',
                          'holder_document','holder_document_enc','pix_key','pix_key_enc',
                          'document_number','document_number_enc'];
  _entity_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    _before := to_jsonb(OLD) - _redact;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    _after := to_jsonb(NEW) - _redact;
  END IF;

  _entity_id := COALESCE((_after ->> 'id'), (_before ->> 'id'));

  INSERT INTO public.staff_audit_log (staff_user_id, action, entity_type, entity_id, before, after, metadata)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    _entity_id,
    _before,
    _after,
    jsonb_build_object('at', now(), 'target_user_id', COALESCE(_after ->> 'user_id', _before ->> 'user_id'))
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_fees ON public.fees;
CREATE TRIGGER trg_audit_fees
AFTER INSERT OR UPDATE OR DELETE ON public.fees
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS trg_audit_custom_user_fees ON public.custom_user_fees;
CREATE TRIGGER trg_audit_custom_user_fees
AFTER INSERT OR UPDATE OR DELETE ON public.custom_user_fees
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS trg_audit_pix_keys ON public.pix_keys;
CREATE TRIGGER trg_audit_pix_keys
AFTER INSERT OR UPDATE OR DELETE ON public.pix_keys
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS trg_audit_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trg_audit_bank_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- Imutabilidade do log de auditoria
DROP POLICY IF EXISTS "staff_audit_log_no_update" ON public.staff_audit_log;
CREATE POLICY "staff_audit_log_no_update" ON public.staff_audit_log
AS RESTRICTIVE FOR UPDATE USING (false);

DROP POLICY IF EXISTS "staff_audit_log_no_delete" ON public.staff_audit_log;
CREATE POLICY "staff_audit_log_no_delete" ON public.staff_audit_log
AS RESTRICTIVE FOR DELETE USING (false);

REVOKE UPDATE, DELETE, TRUNCATE ON public.staff_audit_log FROM authenticated, anon;

-- =========================================================
-- Detecção de saldo negativo + reconciliação automática
-- =========================================================
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
  FOR _rec IN
    SELECT user_id, COALESCE(SUM(public.ledger_entry_effect(entry_type, amount)), 0) AS bal
    FROM public.financial_ledger
    GROUP BY user_id
    HAVING COALESCE(SUM(public.ledger_entry_effect(entry_type, amount)), 0) < -0.01
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

-- Integra ao monitoramento automático (cron a cada 5 min)
CREATE OR REPLACE FUNCTION public.run_monitoring_checks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  result := jsonb_build_object(
    'stuck_transactions', public.reconcile_stuck_transactions(),
    'stuck_withdrawals', public.reconcile_stuck_withdrawals(),
    'error_rate', public.check_error_rate(),
    'db_connections', public.check_db_connections(),
    'failed_crons', public.check_failed_crons(),
    'negative_balances', public.detect_negative_balances(),
    'ledger_reconciliation', public.run_ledger_reconciliation(),
    'checked_at', now()
  );
  RETURN result;
END;
$function$;
