
-- ============================================================
-- 1. Estender api_keys
-- ============================================================
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS ip_allowlist text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT ARRAY['read','write']::text[];

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix_active
  ON public.api_keys(secret_key_prefix) WHERE is_active = true AND revoked_at IS NULL;

-- ============================================================
-- 2. Estender transactions para suportar API pública
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS pix_qrcode text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_transactions_user_external
  ON public.transactions(user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_api_key
  ON public.transactions(api_key_id) WHERE api_key_id IS NOT NULL;

-- ============================================================
-- 3. api_request_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code int NOT NULL,
  latency_ms int NOT NULL DEFAULT 0,
  ip text,
  user_agent text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_created
  ON public.api_request_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_key_created
  ON public.api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_request_id
  ON public.api_request_logs(request_id);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api logs" ON public.api_request_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all api logs" ON public.api_request_logs
  FOR SELECT TO authenticated USING (current_user_has_role('admin'::app_role));

-- ============================================================
-- 4. api_idempotency_keys (separado do legacy idempotency_keys)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  key text NOT NULL,
  request_hash text NOT NULL,
  response_body jsonb NOT NULL,
  response_status int NOT NULL DEFAULT 200,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_key_id, key)
);

CREATE INDEX IF NOT EXISTS idx_api_idem_expires
  ON public.api_idempotency_keys(expires_at);

GRANT ALL ON public.api_idempotency_keys TO service_role;

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service only api idempotency" ON public.api_idempotency_keys
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ============================================================
-- 5. webhook_deliveries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id uuid NOT NULL REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  attempt int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | success | failed | exhausted
  response_status int,
  response_body text,
  error text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliv_user_created
  ON public.webhook_deliveries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_pending
  ON public.webhook_deliveries(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_config
  ON public.webhook_deliveries(webhook_config_id, created_at DESC);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (current_user_has_role('admin'::app_role));

CREATE TRIGGER set_webhook_deliveries_updated
  BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. api_rate_limit_buckets (sliding window counters)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_rate_limit_buckets (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_buckets_window
  ON public.api_rate_limit_buckets(window_start);

GRANT ALL ON public.api_rate_limit_buckets TO service_role;
ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service only rate buckets" ON public.api_rate_limit_buckets
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ============================================================
-- 7. Funções de segurança
-- ============================================================

-- Verifica chave secreta com constant-time compare
CREATE OR REPLACE FUNCTION public.verify_api_secret(_prefix text, _hash text)
RETURNS TABLE (
  api_key_id uuid,
  user_id uuid,
  permissions text[],
  ip_allowlist text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT k.id, k.user_id, k.permissions, k.ip_allowlist
  FROM public.api_keys k
  WHERE k.secret_key_prefix = _prefix
    AND k.secret_key_hash = _hash
    AND k.is_active = true
    AND k.revoked_at IS NULL
    AND (k.expires_at IS NULL OR k.expires_at > now())
  LIMIT 1;
END;
$$;

-- Atualiza last_used_at sem bloquear request
CREATE OR REPLACE FUNCTION public.touch_api_key(_api_key_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys SET last_used_at = now() WHERE id = _api_key_id;
$$;

-- Sliding window rate limiter
CREATE OR REPLACE FUNCTION public.bump_rate_limit(
  _bucket_key text,
  _window_seconds int,
  _max_count int
)
RETURNS TABLE (allowed boolean, current_count int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _new_count int;
BEGIN
  _window_start := date_trunc('second', now()) - 
                   make_interval(secs => extract(epoch FROM now())::int % _window_seconds);

  INSERT INTO public.api_rate_limit_buckets(bucket_key, window_start, count)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = api_rate_limit_buckets.count + 1
  RETURNING count INTO _new_count;

  -- Cleanup old windows occasionally (1% chance)
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limit_buckets
    WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN QUERY SELECT 
    (_new_count <= _max_count),
    _new_count,
    (_window_start + make_interval(secs => _window_seconds));
END;
$$;

-- ============================================================
-- 8. Trigger: enfileira webhook delivery em mudança de status
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_webhook_on_tx_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event text;
  _wc record;
  _payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      _event := 'charge.created';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    _event := CASE NEW.status
      WHEN 'completed' THEN 'charge.paid'
      WHEN 'refunded'  THEN 'charge.refunded'
      WHEN 'chargeback' THEN 'charge.chargeback'
      WHEN 'failed'    THEN 'charge.failed'
      WHEN 'expired'   THEN 'charge.expired'
      ELSE NULL
    END;
  ELSE
    RETURN NEW;
  END IF;

  IF _event IS NULL THEN RETURN NEW; END IF;

  _payload := jsonb_build_object(
    'event', _event,
    'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'data', jsonb_build_object(
      'id', NEW.id,
      'external_id', NEW.external_id,
      'status', NEW.status,
      'amount_cents', (NEW.amount * 100)::int,
      'net_amount_cents', (NEW.net_amount * 100)::int,
      'payment_method', NEW.payment_method,
      'customer', jsonb_build_object(
        'name', NEW.customer_name,
        'email', NEW.customer_email,
        'document', NEW.customer_document
      ),
      'metadata', COALESCE(NEW.metadata, '{}'::jsonb),
      'created_at', NEW.created_at
    )
  );

  FOR _wc IN
    SELECT id, user_id, events FROM public.webhook_configs
    WHERE user_id = NEW.user_id AND is_active = true
  LOOP
    IF _wc.events IS NULL 
       OR array_length(_wc.events,1) IS NULL
       OR _event = ANY(_wc.events) THEN
      INSERT INTO public.webhook_deliveries(
        webhook_config_id, user_id, transaction_id, event, payload, status, next_retry_at
      ) VALUES (
        _wc.id, _wc.user_id, NEW.id, _event, _payload, 'pending', now()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_webhook ON public.transactions;
CREATE TRIGGER trg_enqueue_webhook
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_webhook_on_tx_change();
