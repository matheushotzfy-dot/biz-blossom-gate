
-- 1) Unlimited API keys
DROP TRIGGER IF EXISTS enforce_max_api_keys_trigger ON public.api_keys;
DROP TRIGGER IF EXISTS trg_enforce_max_api_keys ON public.api_keys;
-- catch any other trigger name pointing at the function
DO $$
DECLARE _t record;
BEGIN
  FOR _t IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.api_keys'::regclass
      AND NOT tgisinternal
      AND tgfoid = 'public.enforce_max_api_keys'::regproc
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.api_keys', _t.tgname);
  END LOOP;
END $$;

-- 2) Webhook events: use UI-facing names (payment.* / chargeback.received)
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
$function$;

-- 3) Withdrawal -> payout.approved webhook
CREATE OR REPLACE FUNCTION public.enqueue_webhook_on_withdrawal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _event text;
  _wc record;
  _payload jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  _event := CASE NEW.status
    WHEN 'approved' THEN 'payout.approved'
    WHEN 'rejected' THEN 'payout.rejected'
    ELSE NULL
  END;

  IF _event IS NULL THEN RETURN NEW; END IF;

  _payload := jsonb_build_object(
    'event', _event,
    'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'data', jsonb_build_object(
      'id', NEW.id,
      'status', NEW.status,
      'amount_cents', (NEW.amount * 100)::int,
      'net_amount_cents', (NEW.net_amount * 100)::int,
      'fee_cents', (COALESCE(NEW.fee_amount,0) * 100)::int,
      'withdrawal_type', COALESCE(NEW.withdrawal_type, 'pix'),
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
        _wc.id, _wc.user_id, NULL, _event, _payload, 'pending', now()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_webhook_on_withdrawal ON public.withdrawals;
CREATE TRIGGER trg_enqueue_webhook_on_withdrawal
AFTER UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_webhook_on_withdrawal_change();

-- 4) Remove duplicated webhook url validation trigger
DROP TRIGGER IF EXISTS validate_webhook_url_trigger ON public.webhook_configs;
