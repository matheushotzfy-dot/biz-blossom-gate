-- ═══════════════════════════════════════════════════════════
-- MODULE 4: RISK & ANTI-FRAUD COMPLIANCE
-- ═══════════════════════════════════════════════════════════

-- 1. Global Blacklist Table
CREATE TABLE IF NOT EXISTS public.global_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('cpf', 'cnpj', 'email', 'ip', 'bin')),
  entry_value text NOT NULL,
  reason text NOT NULL DEFAULT '',
  added_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_type, entry_value)
);

ALTER TABLE public.global_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage blacklist" ON public.global_blacklist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_all_global_blacklist" ON public.global_blacklist
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX idx_blacklist_type_value ON public.global_blacklist (entry_type, entry_value) WHERE is_active = true;
CREATE INDEX idx_blacklist_value ON public.global_blacklist (entry_value) WHERE is_active = true;

-- 2. Velocity Rules Table
CREATE TABLE IF NOT EXISTS public.velocity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('ip_card_fail', 'email_high_value', 'ip_attempts', 'custom')),
  is_enabled boolean NOT NULL DEFAULT false,
  max_attempts integer NOT NULL DEFAULT 5,
  time_window_minutes integer NOT NULL DEFAULT 10,
  threshold_amount numeric DEFAULT NULL,
  action text NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'flag', 'notify')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.velocity_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage velocity rules" ON public.velocity_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_all_velocity_rules" ON public.velocity_rules
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- 3. Fraud Logs Table
CREATE TABLE IF NOT EXISTS public.fraud_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type text NOT NULL CHECK (block_type IN ('blacklist', 'velocity', 'manual')),
  block_reason text NOT NULL,
  matched_value text,
  matched_type text,
  customer_email text,
  customer_document text,
  customer_ip text,
  product_id uuid REFERENCES public.products(id),
  seller_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud logs" ON public.fraud_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_all_fraud_logs" ON public.fraud_logs
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX idx_fraud_logs_created ON public.fraud_logs (created_at DESC);
CREATE INDEX idx_fraud_logs_type ON public.fraud_logs (block_type);

-- 4. Insert default velocity rules
INSERT INTO public.velocity_rules (rule_name, rule_type, max_attempts, time_window_minutes, is_enabled, action) VALUES
  ('Bloquear IP após tentativas de cartão recusado', 'ip_card_fail', 5, 10, true, 'block'),
  ('Bloquear e-mail após compras de alto valor no mesmo dia', 'email_high_value', 3, 1440, false, 'block'),
  ('Bloquear IP após muitas tentativas', 'ip_attempts', 10, 5, true, 'block');

-- 5. Function to check blacklist (used by edge function)
CREATE OR REPLACE FUNCTION public.check_blacklist(
  _email text DEFAULT NULL,
  _document text DEFAULT NULL,
  _ip text DEFAULT NULL
)
RETURNS TABLE (blocked boolean, block_reason text, matched_type text, matched_value text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS blocked,
    'Bloqueado pela Blacklist Global: ' || bl.entry_type || ' = ' || bl.entry_value AS block_reason,
    bl.entry_type AS matched_type,
    bl.entry_value AS matched_value
  FROM public.global_blacklist bl
  WHERE bl.is_active = true
    AND (
      (bl.entry_type = 'email' AND lower(bl.entry_value) = lower(_email))
      OR (bl.entry_type IN ('cpf', 'cnpj') AND bl.entry_value = _document)
      OR (bl.entry_type = 'ip' AND bl.entry_value = _ip)
      OR (bl.entry_type = 'bin' AND _document IS NOT NULL AND bl.entry_value = left(_document, 6))
    )
  LIMIT 1;
END;
$$;

-- 6. Function to check velocity (counts recent failed transactions)
CREATE OR REPLACE FUNCTION public.check_velocity(
  _email text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _rule_type text DEFAULT 'ip_card_fail'
)
RETURNS TABLE (blocked boolean, block_reason text, attempt_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _rule record;
  _count bigint;
BEGIN
  SELECT * INTO _rule FROM public.velocity_rules
  WHERE rule_type = _rule_type AND is_enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ''::text, 0::bigint;
    RETURN;
  END IF;

  IF _rule_type = 'ip_card_fail' AND _ip IS NOT NULL THEN
    SELECT COUNT(*) INTO _count
    FROM public.fraud_logs
    WHERE customer_ip = _ip
      AND block_type = 'velocity'
      AND created_at > now() - (_rule.time_window_minutes || ' minutes')::interval;
    
    SELECT _count + COUNT(*) INTO _count
    FROM public.transactions
    WHERE payment_method = 'credit_card'
      AND status IN ('failed', 'refused')
      AND created_at > now() - (_rule.time_window_minutes || ' minutes')::interval
      AND customer_email = _email;
  ELSIF _rule_type = 'email_high_value' AND _email IS NOT NULL THEN
    SELECT COUNT(*) INTO _count
    FROM public.transactions
    WHERE customer_email = lower(_email)
      AND status IN ('pending', 'completed')
      AND created_at > now() - (_rule.time_window_minutes || ' minutes')::interval;
  ELSIF _rule_type = 'ip_attempts' AND _ip IS NOT NULL THEN
    SELECT COUNT(*) INTO _count
    FROM public.transactions
    WHERE created_at > now() - (_rule.time_window_minutes || ' minutes')::interval
      AND customer_email = _email;
  ELSE
    _count := 0;
  END IF;

  IF _count >= _rule.max_attempts THEN
    RETURN QUERY SELECT true, 
      format('Velocity check: %s tentativas em %s min (limite: %s)', _count, _rule.time_window_minutes, _rule.max_attempts),
      _count;
  ELSE
    RETURN QUERY SELECT false, ''::text, _count;
  END IF;
END;
$$;