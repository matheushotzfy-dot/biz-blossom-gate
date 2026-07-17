
-- =========================================================
-- Transaction Events (audit timeline)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  acquirer_slug text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','admin')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_events_tx ON public.transaction_events(transaction_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_events_seller ON public.transaction_events(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_events_type ON public.transaction_events(event_type);

GRANT SELECT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;

ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to tx events"
  ON public.transaction_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers view public events of own tx"
  ON public.transaction_events FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    AND seller_id = auth.uid()
  );

-- =========================================================
-- Helper: log an event (SECURITY DEFINER so edge functions & triggers can use)
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_transaction_event(
  _transaction_id uuid,
  _event_type text,
  _description text,
  _actor text DEFAULT 'system',
  _acquirer_slug text DEFAULT NULL,
  _visibility text DEFAULT 'public',
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller uuid;
  _event_id uuid;
BEGIN
  SELECT user_id INTO _seller FROM public.transactions WHERE id = _transaction_id;
  INSERT INTO public.transaction_events(
    transaction_id, seller_id, event_type, description, actor,
    acquirer_slug, visibility, metadata
  ) VALUES (
    _transaction_id, _seller, _event_type, _description,
    COALESCE(_actor, 'system'),
    _acquirer_slug,
    COALESCE(_visibility, 'public'),
    COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO _event_id;
  RETURN _event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_transaction_event(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_transaction_event(uuid, text, text, text, text, text, jsonb) TO authenticated, service_role;

-- =========================================================
-- Auto-log trigger: creation + status transitions
-- =========================================================
CREATE OR REPLACE FUNCTION public.tx_events_auto_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _acq text;
BEGIN
  _acq := COALESCE(NEW.metadata->>'acquirer_slug', NEW.metadata->>'acquirer', NEW.source);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_events(
      transaction_id, seller_id, event_type, description, actor,
      acquirer_slug, visibility, metadata
    ) VALUES (
      NEW.id, NEW.user_id, 'created',
      'Transação criada' || CASE WHEN _acq IS NOT NULL THEN ' via ' || upper(_acq) ELSE '' END,
      'system', _acq, 'public',
      jsonb_build_object(
        'amount', NEW.amount,
        'payment_method', NEW.payment_method,
        'source', NEW.source,
        'external_id', NEW.external_id
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.transaction_events(
      transaction_id, seller_id, event_type, description, actor,
      acquirer_slug, visibility, metadata
    ) VALUES (
      NEW.id, NEW.user_id,
      CASE NEW.status
        WHEN 'paid' THEN 'paid'
        WHEN 'approved' THEN 'paid'
        WHEN 'expired' THEN 'expired'
        WHEN 'refunded' THEN 'refunded'
        WHEN 'chargeback' THEN 'chargeback'
        WHEN 'disputed' THEN 'dispute_opened'
        WHEN 'canceled' THEN 'canceled'
        ELSE 'status_changed'
      END,
      CASE NEW.status
        WHEN 'paid' THEN 'Pagamento confirmado'
        WHEN 'approved' THEN 'Pagamento aprovado'
        WHEN 'expired' THEN 'Transação expirada'
        WHEN 'refunded' THEN 'Reembolso processado'
        WHEN 'chargeback' THEN 'Chargeback registrado'
        WHEN 'disputed' THEN 'Disputa aberta'
        WHEN 'canceled' THEN 'Transação cancelada'
        ELSE 'Status alterado para ' || NEW.status
      END,
      'system', _acq, 'public',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'paid_at', CASE WHEN NEW.status IN ('paid','approved') THEN NEW.updated_at END,
        'pix_expires_at', NEW.pix_expires_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tx_events_auto_log ON public.transactions;
CREATE TRIGGER trg_tx_events_auto_log
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tx_events_auto_log();

-- =========================================================
-- Backfill from existing rows (idempotent — only if empty)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transaction_events LIMIT 1) THEN
    INSERT INTO public.transaction_events(
      transaction_id, seller_id, event_type, description, actor,
      acquirer_slug, visibility, metadata, created_at
    )
    SELECT
      t.id, t.user_id, 'created',
      'Transação criada' ||
        CASE WHEN COALESCE(t.metadata->>'acquirer_slug', t.metadata->>'acquirer', t.source) IS NOT NULL
             THEN ' via ' || upper(COALESCE(t.metadata->>'acquirer_slug', t.metadata->>'acquirer', t.source))
             ELSE '' END,
      'system',
      COALESCE(t.metadata->>'acquirer_slug', t.metadata->>'acquirer', t.source),
      'public',
      jsonb_build_object('backfilled', true, 'amount', t.amount, 'payment_method', t.payment_method),
      t.created_at
    FROM public.transactions t;

    INSERT INTO public.transaction_events(
      transaction_id, seller_id, event_type, description, actor,
      acquirer_slug, visibility, metadata, created_at
    )
    SELECT
      t.id, t.user_id,
      CASE t.status
        WHEN 'paid' THEN 'paid' WHEN 'approved' THEN 'paid'
        WHEN 'expired' THEN 'expired' WHEN 'refunded' THEN 'refunded'
        WHEN 'chargeback' THEN 'chargeback' WHEN 'disputed' THEN 'dispute_opened'
        WHEN 'canceled' THEN 'canceled' ELSE 'status_changed'
      END,
      CASE t.status
        WHEN 'paid' THEN 'Pagamento confirmado' WHEN 'approved' THEN 'Pagamento aprovado'
        WHEN 'expired' THEN 'Transação expirada' WHEN 'refunded' THEN 'Reembolso processado'
        WHEN 'chargeback' THEN 'Chargeback registrado' WHEN 'disputed' THEN 'Disputa aberta'
        WHEN 'canceled' THEN 'Transação cancelada' ELSE 'Status: ' || t.status
      END,
      'system',
      COALESCE(t.metadata->>'acquirer_slug', t.metadata->>'acquirer', t.source),
      'public',
      jsonb_build_object('backfilled', true, 'to', t.status),
      COALESCE(t.updated_at, t.created_at)
    FROM public.transactions t
    WHERE t.status NOT IN ('pending','processing');
  END IF;
END $$;
