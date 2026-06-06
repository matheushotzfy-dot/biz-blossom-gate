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
      AND app_name IN ('zapi','utmify','activecampaign','notazz','themembers','spedy','astron','memberkit','smsfunnel','voxuy','cademi')
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