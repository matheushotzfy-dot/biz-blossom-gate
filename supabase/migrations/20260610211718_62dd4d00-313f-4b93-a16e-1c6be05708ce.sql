
-- 1. Update global fees to new defaults
UPDATE public.fees SET value = 5.99 WHERE name = 'Taxa Cartão';
UPDATE public.fees SET value = 4.99 WHERE name = 'Taxa PIX';
UPDATE public.fees SET value = 0 WHERE name = 'Taxa Fixa por Transação';

INSERT INTO public.fees (name, description, fee_type, value)
SELECT 'Taxa Fixa PIX', 'Taxa fixa adicional por transação PIX', 'fixed', 3.99
WHERE NOT EXISTS (SELECT 1 FROM public.fees WHERE name = 'Taxa Fixa PIX');

-- 2. Add per-method columns to custom_user_fees
ALTER TABLE public.custom_user_fees
  ADD COLUMN IF NOT EXISTS pix_percentage numeric,
  ADD COLUMN IF NOT EXISTS pix_fixed numeric,
  ADD COLUMN IF NOT EXISTS card_percentage numeric,
  ADD COLUMN IF NOT EXISTS card_fixed numeric;

-- 3. Update validation trigger to cover new columns
CREATE OR REPLACE FUNCTION public.validate_custom_fees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.transaction_percentage IS NOT NULL AND (NEW.transaction_percentage < 0 OR NEW.transaction_percentage > 50) THEN
    RAISE EXCEPTION 'Taxa percentual deve ser entre 0%% e 50%%';
  END IF;
  IF NEW.transaction_fixed IS NOT NULL AND (NEW.transaction_fixed < 0 OR NEW.transaction_fixed > 100) THEN
    RAISE EXCEPTION 'Taxa fixa deve ser entre R$ 0 e R$ 100';
  END IF;
  IF NEW.withdrawal_fee IS NOT NULL AND (NEW.withdrawal_fee < 0 OR NEW.withdrawal_fee > 500) THEN
    RAISE EXCEPTION 'Taxa de saque deve ser entre R$ 0 e R$ 500';
  END IF;
  IF NEW.pix_percentage IS NOT NULL AND (NEW.pix_percentage < 0 OR NEW.pix_percentage > 50) THEN
    RAISE EXCEPTION 'Taxa percentual PIX deve ser entre 0%% e 50%%';
  END IF;
  IF NEW.card_percentage IS NOT NULL AND (NEW.card_percentage < 0 OR NEW.card_percentage > 50) THEN
    RAISE EXCEPTION 'Taxa percentual Cartão deve ser entre 0%% e 50%%';
  END IF;
  IF NEW.pix_fixed IS NOT NULL AND (NEW.pix_fixed < 0 OR NEW.pix_fixed > 100) THEN
    RAISE EXCEPTION 'Taxa fixa PIX deve ser entre R$ 0 e R$ 100';
  END IF;
  IF NEW.card_fixed IS NOT NULL AND (NEW.card_fixed < 0 OR NEW.card_fixed > 100) THEN
    RAISE EXCEPTION 'Taxa fixa Cartão deve ser entre R$ 0 e R$ 100';
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Fix integration URL validator — only validates when value looks like a URL
CREATE OR REPLACE FUNCTION public.validate_integration_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.api_url IS NOT NULL AND length(trim(NEW.api_url)) > 0 AND NEW.api_url ~* '^https?://' THEN
    IF NOT (NEW.api_url LIKE 'https://%') THEN
      RAISE EXCEPTION 'URL da integração deve usar HTTPS';
    END IF;
    IF NEW.api_url ~* 'https?://(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|\[fc|\[fd)' THEN
      RAISE EXCEPTION 'URL da integração não pode apontar para endereços internos';
    END IF;
  END IF;
  IF NEW.webhook_url IS NOT NULL AND length(trim(NEW.webhook_url)) > 0 AND NEW.webhook_url ~* '^https?://' THEN
    IF NOT (NEW.webhook_url LIKE 'https://%') THEN
      RAISE EXCEPTION 'Webhook URL deve usar HTTPS';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Auto-invoke apps-dispatcher via pg_net after enqueue
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.enqueue_app_dispatch_on_tx_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event text;
  _ai record;
  _payload jsonb;
  _enqueued_count int := 0;
  _supabase_url text;
  _service_key text;
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
    _enqueued_count := _enqueued_count + 1;
  END LOOP;

  -- Fire-and-forget invoke apps-dispatcher (best-effort, swallow errors)
  IF _enqueued_count > 0 THEN
    BEGIN
      _supabase_url := current_setting('app.settings.supabase_url', true);
      _service_key := current_setting('app.settings.service_role_key', true);
      IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := _supabase_url || '/functions/v1/apps-dispatcher',
          body := '{}'::jsonb,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_key
          ),
          timeout_milliseconds := 2000
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- ignore — podpay-postback also invokes the dispatcher as backup
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
