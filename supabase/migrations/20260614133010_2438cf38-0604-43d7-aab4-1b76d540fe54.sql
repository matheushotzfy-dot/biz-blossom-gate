
-- ============== ACQUIRERS: extend with health, fees, limits, methods, keys, webhook, priority ==============
ALTER TABLE public.acquirers
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'online' CHECK (health_status IN ('online','degraded','offline','maintenance')),
  ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_latency_ms integer,
  ADD COLUMN IF NOT EXISTS avg_latency_ms integer,
  ADD COLUMN IF NOT EXISTS uptime_pct numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS min_transaction_amount numeric DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS max_transaction_amount numeric DEFAULT 50000.00,
  ADD COLUMN IF NOT EXISTS supported_methods text[] NOT NULL DEFAULT ARRAY['pix','credit_card']::text[],
  ADD COLUMN IF NOT EXISTS transaction_fee_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_fee_fixed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS api_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS api_environment text DEFAULT 'production' CHECK (api_environment IN ('production','sandbox')),
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_failover boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text;

-- ============== HEALTH EVENT LOG ==============
CREATE TABLE IF NOT EXISTS public.acquirer_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquirer_id uuid NOT NULL REFERENCES public.acquirers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('online','degraded','offline','maintenance','recovered','error','latency_spike')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  message text,
  latency_ms integer,
  error_code text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ahe_acq_created ON public.acquirer_health_events(acquirer_id, created_at DESC);
GRANT SELECT, INSERT ON public.acquirer_health_events TO authenticated;
GRANT ALL ON public.acquirer_health_events TO service_role;
ALTER TABLE public.acquirer_health_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage acquirer health events" ON public.acquirer_health_events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============== FAILOVER EVENT LOG ==============
CREATE TABLE IF NOT EXISTS public.acquirer_failover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_acquirer_id uuid REFERENCES public.acquirers(id) ON DELETE SET NULL,
  to_acquirer_id uuid REFERENCES public.acquirers(id) ON DELETE SET NULL,
  seller_id uuid,
  transaction_id uuid,
  reason text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'auto' CHECK (trigger_type IN ('auto','manual','scheduled')),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_afe_created ON public.acquirer_failover_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_afe_seller ON public.acquirer_failover_events(seller_id);
GRANT SELECT, INSERT ON public.acquirer_failover_events TO authenticated;
GRANT ALL ON public.acquirer_failover_events TO service_role;
ALTER TABLE public.acquirer_failover_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage failover events" ON public.acquirer_failover_events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Sellers view own failovers" ON public.acquirer_failover_events
  FOR SELECT USING (auth.uid() = seller_id);

-- ============== FAILOVER PICKER: respects WHITE→WHITE→BLACK, BLACK→BLACK only ==============
CREATE OR REPLACE FUNCTION public.pick_failover_acquirer(_current_acquirer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_type text;
  _candidate uuid;
BEGIN
  SELECT type INTO _current_type FROM public.acquirers WHERE id = _current_acquirer_id;
  IF _current_type IS NULL THEN RETURN NULL; END IF;

  -- 1) same type first (priority desc, conversion desc)
  SELECT id INTO _candidate FROM public.acquirers
  WHERE id <> _current_acquirer_id
    AND type = _current_type
    AND is_active = true
    AND allow_failover = true
    AND health_status IN ('online','degraded')
  ORDER BY priority DESC, conversion_rate DESC
  LIMIT 1;
  IF _candidate IS NOT NULL THEN RETURN _candidate; END IF;

  -- 2) white can escalate to black; black CANNOT downgrade to white
  IF _current_type = 'white' THEN
    SELECT id INTO _candidate FROM public.acquirers
    WHERE type = 'black'
      AND is_active = true
      AND allow_failover = true
      AND health_status IN ('online','degraded')
    ORDER BY priority DESC, conversion_rate DESC
    LIMIT 1;
    RETURN _candidate;
  END IF;

  RETURN NULL;
END;
$$;

-- ============== BULK ASSIGN: change acquirer for many sellers ==============
CREATE OR REPLACE FUNCTION public.admin_bulk_assign_acquirer(
  _seller_ids uuid[],
  _new_acquirer_id uuid,
  _reason text DEFAULT 'bulk admin assignment'
)
RETURNS TABLE(seller_id uuid, success boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid;
  _old_acq uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF _new_acquirer_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.acquirers WHERE id = _new_acquirer_id) THEN
    RAISE EXCEPTION 'Adquirente inválida';
  END IF;

  FOREACH _sid IN ARRAY _seller_ids LOOP
    BEGIN
      SELECT acquirer_id INTO _old_acq FROM public.profiles WHERE user_id = _sid;
      UPDATE public.profiles SET acquirer_id = _new_acquirer_id, updated_at = now() WHERE user_id = _sid;
      INSERT INTO public.acquirer_failover_events(from_acquirer_id, to_acquirer_id, seller_id, reason, trigger_type, success)
      VALUES (_old_acq, _new_acquirer_id, _sid, _reason, 'manual', true);
      seller_id := _sid; success := true; error := NULL; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      seller_id := _sid; success := false; error := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- ============== AUTO-LOG HEALTH EVENT WHEN STATUS CHANGES ==============
CREATE OR REPLACE FUNCTION public.log_acquirer_health_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.health_status IS DISTINCT FROM NEW.health_status THEN
    INSERT INTO public.acquirer_health_events(acquirer_id, event_type, severity, message, latency_ms)
    VALUES (
      NEW.id,
      NEW.health_status,
      CASE NEW.health_status WHEN 'offline' THEN 'critical' WHEN 'degraded' THEN 'warning' ELSE 'info' END,
      format('Status changed from %s to %s', OLD.health_status, NEW.health_status),
      NEW.last_latency_ms
    );
    IF NEW.health_status = 'offline' THEN
      NEW.last_failure_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_acquirer_health_change ON public.acquirers;
CREATE TRIGGER trg_acquirer_health_change
  BEFORE UPDATE ON public.acquirers
  FOR EACH ROW EXECUTE FUNCTION public.log_acquirer_health_change();
