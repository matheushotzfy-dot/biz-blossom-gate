
-- 1) Sanitize acquirer traces from webhook payload metadata
CREATE OR REPLACE FUNCTION public.enqueue_webhook_on_tx_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event text;
  _wc record;
  _payload jsonb;
  _safe_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      _event := 'payment.created';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    _event := CASE NEW.status
      WHEN 'completed'  THEN 'payment.approved'
      WHEN 'paid'       THEN 'payment.approved'
      WHEN 'approved'   THEN 'payment.approved'
      WHEN 'refunded'   THEN 'payment.refunded'
      WHEN 'chargeback' THEN 'chargeback.received'
      WHEN 'failed'     THEN 'payment.failed'
      WHEN 'expired'    THEN 'payment.expired'
      ELSE NULL
    END;
  ELSE
    RETURN NEW;
  END IF;

  IF _event IS NULL THEN RETURN NEW; END IF;

  -- Strip every trace of the real acquirer from metadata before delivering it
  -- to the seller's webhook endpoint.
  _safe_meta := COALESCE(NEW.metadata, '{}'::jsonb)
    - 'acquirer'
    - 'acquirer_slug'
    - 'acquirer_id'
    - 'last_veopag_status'
    - 'last_veopag_event_at'
    - 'last_podpay_status'
    - 'last_podpay_event_at'
    - 'superseded_by_acquirer'
    - 'superseded_at'
    - 'veopag_transaction_id'
    - 'podpay_transaction_id'
    - 'gateway'
    - 'gateway_name'
    - 'provider';

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
      'processor', 'hotzfy',
      'customer', jsonb_build_object(
        'name', NEW.customer_name,
        'email', NEW.customer_email,
        'document', NEW.customer_document
      ),
      'metadata', _safe_meta,
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
$function$;

-- 2) Public transaction events: no more "via VEOPAG" in seller-visible descriptions
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
      'Transação criada',
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
        WHEN 'completed' THEN 'paid'
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
        WHEN 'completed' THEN 'Pagamento confirmado'
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
        'paid_at', CASE WHEN NEW.status IN ('paid','approved','completed') THEN NEW.updated_at END,
        'pix_expires_at', NEW.pix_expires_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
