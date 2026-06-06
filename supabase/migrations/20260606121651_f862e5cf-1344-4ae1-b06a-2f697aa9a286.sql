-- 1) Queue table
CREATE TABLE IF NOT EXISTS public.app_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.app_integrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  app_name text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  attempt integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  response_status integer,
  response_body text,
  error text,
  next_retry_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_deliv_pending ON public.app_deliveries (next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_app_deliv_user_created ON public.app_deliveries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_deliv_integration ON public.app_deliveries (integration_id, created_at DESC);

GRANT SELECT ON public.app_deliveries TO authenticated;
GRANT ALL ON public.app_deliveries TO service_role;

ALTER TABLE public.app_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own app deliveries"
ON public.app_deliveries FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins view all app deliveries"
ON public.app_deliveries FOR SELECT
TO authenticated
USING (public.current_user_has_role('admin'::app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_app_deliveries_updated_at ON public.app_deliveries;
CREATE TRIGGER trg_app_deliveries_updated_at
BEFORE UPDATE ON public.app_deliveries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Enqueue trigger function
CREATE OR REPLACE FUNCTION public.enqueue_app_dispatch_on_tx_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event text;
  _ai record;
  _payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      _event := CASE NEW.payment_method
        WHEN 'pix' THEN 'PixGenerated'
        WHEN 'boleto' THEN 'BoletoGenerated'
        ELSE 'InitiateCheckout'
      END;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    _event := CASE NEW.status
      WHEN 'completed' THEN 'Purchase'
      WHEN 'refunded' THEN 'Refund'
      WHEN 'chargeback' THEN 'Chargeback'
      ELSE NULL
    END;
  ELSE
    RETURN NEW;
  END IF;

  IF _event IS NULL THEN RETURN NEW; END IF;

  _payload := jsonb_build_object(
    'event', _event,
    'transaction', jsonb_build_object(
      'id', NEW.id,
      'external_id', NEW.external_id,
      'status', NEW.status,
      'amount', NEW.amount,
      'net_amount', NEW.net_amount,
      'payment_method', NEW.payment_method,
      'product_id', NEW.product_id,
      'created_at', NEW.created_at
    ),
    'customer', jsonb_build_object(
      'name', NEW.customer_name,
      'email', NEW.customer_email,
      'document', NEW.customer_document,
      'phone', NEW.customer_phone
    ),
    'utm', COALESCE(NEW.metadata->'utm', '{}'::jsonb)
  );

  FOR _ai IN
    SELECT id, app_name FROM public.app_integrations
    WHERE user_id = NEW.user_id
      AND is_active = true
      AND (product_id IS NULL OR product_id = NEW.product_id)
      AND app_name IN ('zapi','utmify')
      AND (events ? _event)
  LOOP
    INSERT INTO public.app_deliveries(
      integration_id, user_id, transaction_id, app_name, event, payload, status, next_retry_at
    ) VALUES (
      _ai.id, NEW.user_id, NEW.id, _ai.app_name, _event, _payload, 'pending', now()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_app_dispatch ON public.transactions;
CREATE TRIGGER trg_enqueue_app_dispatch
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_app_dispatch_on_tx_change();