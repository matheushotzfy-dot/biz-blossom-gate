-- Webhooks do vendedor: teste com o formato real, reenvio de entregas, chave reconhecível e limites.
--
-- 1) webhook_configs_safe passa a devolver o final da chave (whsec_••••ab12). Antes vinha sempre vazio e o
--    vendedor não tinha como saber qual chave estava valendo.
-- 2) enqueue_test_webhook(config, evento): o teste sai com o mesmo formato dos eventos reais
--    ({event, created_at, data}) e com "test": true, para o vendedor testar o código que vai rodar de verdade.
--    A assinatura antiga (só o id) continua funcionando: o evento padrão é payment.approved.
-- 3) resend_webhook_delivery / resend_failed_webhook_deliveries: reenvio pelo próprio vendedor.
--    O reenvio reaproveita a MESMA entrega (mesmo X-Venxpay-Delivery), então quem ignora repetidos pelo ID continua certo.
-- 4) Limites: no máximo 50 entregas abertas na fila por conta para teste/reenvio, 10 testes por minuto e 10 endpoints
--    por conta. Sem isso, um laço no navegador enchia a fila única do worker (lotes de 20 por minuto) e atrasava os
--    pagamentos de todos os outros vendedores.

-- ── 1) Chave reconhecível ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.webhook_configs_safe
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  wc.id,
  wc.user_id,
  wc.url,
  wc.events,
  wc.is_active,
  wc.created_at,
  wc.updated_at,
  CASE WHEN wc.secret IS NULL OR wc.secret = '' THEN NULL::text ELSE 'whsec_••••' || right(wc.secret, 4) END AS secret_masked
FROM public.webhook_configs wc
WHERE wc.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role);

-- ── 2) Espaço na fila (usado só pelas funções abaixo) ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_user_open
  ON public.webhook_deliveries (user_id)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION app_private.webhook_queue_room(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _open integer;
BEGIN
  SELECT count(*) INTO _open
    FROM public.webhook_deliveries
   WHERE user_id = _user_id AND status IN ('pending', 'processing');
  IF _open >= 50 THEN
    RAISE EXCEPTION 'Há muitas entregas na fila. Aguarde alguns minutos e tente de novo.';
  END IF;
  RETURN 50 - _open;
END;
$$;

REVOKE ALL ON FUNCTION app_private.webhook_queue_room(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3) Teste com o formato real ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.enqueue_test_webhook(uuid);
DROP FUNCTION IF EXISTS app_private.enqueue_test_webhook(uuid);

CREATE OR REPLACE FUNCTION app_private.enqueue_test_webhook(_config_id uuid, _event text DEFAULT 'payment.approved')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cfg record;
  _id uuid;
  _data jsonb;
  _status text;
  _recent integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, user_id, is_active INTO _cfg
    FROM public.webhook_configs
   WHERE id = _config_id AND user_id = auth.uid();
  IF _cfg IS NULL THEN
    RAISE EXCEPTION 'Endpoint não encontrado';
  END IF;
  IF NOT _cfg.is_active THEN
    RAISE EXCEPTION 'Endpoint pausado';
  END IF;

  IF _event IS NULL OR _event NOT IN (
    'payment.created', 'payment.approved', 'payment.failed', 'payment.expired', 'payment.refunded',
    'chargeback.received', 'payout.approved', 'payout.rejected'
  ) THEN
    RAISE EXCEPTION 'Evento inválido';
  END IF;

  SELECT count(*) INTO _recent
    FROM public.webhook_deliveries
   WHERE user_id = _cfg.user_id
     AND created_at > now() - interval '1 minute'
     AND payload->>'test' = 'true';
  IF _recent >= 10 THEN
    RAISE EXCEPTION 'Muitos testes seguidos. Aguarde um minuto.';
  END IF;
  PERFORM app_private.webhook_queue_room(_cfg.user_id);

  IF _event LIKE 'payout.%' THEN
    -- Mesmo formato de enqueue_webhook_on_withdrawal_change.
    _data := jsonb_build_object(
      'id', gen_random_uuid(),
      'status', CASE _event WHEN 'payout.approved' THEN 'approved' ELSE 'rejected' END,
      'amount_cents', 15000,
      'net_amount_cents', 14500,
      'fee_cents', 500,
      'withdrawal_type', 'pix',
      'created_at', now()
    );
  ELSE
    -- Mesmo formato de enqueue_webhook_on_tx_change.
    _status := CASE _event
      WHEN 'payment.created' THEN 'pending'
      WHEN 'payment.approved' THEN 'completed'
      WHEN 'payment.failed' THEN 'failed'
      WHEN 'payment.expired' THEN 'expired'
      WHEN 'payment.refunded' THEN 'refunded'
      ELSE 'chargeback'
    END;
    _data := jsonb_build_object(
      'id', gen_random_uuid(),
      'external_id', 'teste_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
      'status', _status,
      'amount_cents', 4990,
      'net_amount_cents', 4690,
      'payment_method', 'pix',
      'processor', 'hotzfy',
      'customer', jsonb_build_object('name', 'Cliente Teste', 'email', 'cliente.teste@exemplo.com', 'document', '00000000000'),
      'metadata', jsonb_build_object('test', true),
      'created_at', now()
    );
  END IF;

  INSERT INTO public.webhook_deliveries (webhook_config_id, user_id, event, payload, status, next_retry_at)
  VALUES (
    _cfg.id,
    _cfg.user_id,
    _event,
    jsonb_build_object(
      'event', _event,
      'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'test', true,
      'data', _data
    ),
    'pending',
    now()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_test_webhook(_config_id uuid, _event text DEFAULT 'payment.approved')
RETURNS uuid
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $$SELECT app_private.enqueue_test_webhook($1, $2)$$;

REVOKE ALL ON FUNCTION app_private.enqueue_test_webhook(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enqueue_test_webhook(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.enqueue_test_webhook(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_test_webhook(uuid, text) TO authenticated, service_role;

-- ── 4) Reenvio ──────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.resend_webhook_delivery(_delivery_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _d record;
  _active boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, status, webhook_config_id INTO _d
    FROM public.webhook_deliveries
   WHERE id = _delivery_id AND user_id = auth.uid();
  IF _d IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;
  IF _d.status IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Essa entrega ainda está em andamento';
  END IF;

  SELECT is_active INTO _active
    FROM public.webhook_configs
   WHERE id = _d.webhook_config_id AND user_id = auth.uid();
  IF _active IS NULL THEN
    RAISE EXCEPTION 'Endpoint não encontrado';
  END IF;
  IF NOT _active THEN
    RAISE EXCEPTION 'Endpoint pausado';
  END IF;

  PERFORM app_private.webhook_queue_room(auth.uid());

  UPDATE public.webhook_deliveries
     SET status = 'pending', attempt = 0, next_retry_at = now(),
         error = NULL, response_status = NULL, response_body = NULL, delivered_at = NULL
   WHERE id = _d.id AND status IN ('success', 'exhausted', 'failed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Essa entrega ainda está em andamento';
  END IF;

  RETURN _d.id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.resend_failed_webhook_deliveries(_config_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _active boolean;
  _room integer;
  _n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT is_active INTO _active
    FROM public.webhook_configs
   WHERE id = _config_id AND user_id = auth.uid();
  IF _active IS NULL THEN
    RAISE EXCEPTION 'Endpoint não encontrado';
  END IF;
  IF NOT _active THEN
    RAISE EXCEPTION 'Endpoint pausado';
  END IF;

  _room := app_private.webhook_queue_room(auth.uid());

  WITH picked AS (
    SELECT id FROM public.webhook_deliveries
     WHERE webhook_config_id = _config_id AND user_id = auth.uid() AND status IN ('exhausted', 'failed')
     ORDER BY created_at DESC
     LIMIT LEAST(_room, 25)
     FOR UPDATE SKIP LOCKED
  ), moved AS (
    UPDATE public.webhook_deliveries d
       SET status = 'pending', attempt = 0, next_retry_at = now(),
           error = NULL, response_status = NULL, response_body = NULL, delivered_at = NULL
      FROM picked
     WHERE d.id = picked.id
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM moved;

  RETURN _n;
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_webhook_delivery(_delivery_id uuid)
RETURNS uuid
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $$SELECT app_private.resend_webhook_delivery($1)$$;

CREATE OR REPLACE FUNCTION public.resend_failed_webhook_deliveries(_config_id uuid)
RETURNS integer
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $$SELECT app_private.resend_failed_webhook_deliveries($1)$$;

REVOKE ALL ON FUNCTION app_private.resend_webhook_delivery(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resend_webhook_delivery(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.resend_failed_webhook_deliveries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resend_failed_webhook_deliveries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.resend_webhook_delivery(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resend_webhook_delivery(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.resend_failed_webhook_deliveries(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resend_failed_webhook_deliveries(uuid) TO authenticated, service_role;

-- ── 5) Limite de endpoints por conta ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.enforce_max_webhook_configs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT count(*) FROM public.webhook_configs WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 endpoints por conta';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.enforce_max_webhook_configs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_max_webhook_configs ON public.webhook_configs;
CREATE TRIGGER trg_enforce_max_webhook_configs
  BEFORE INSERT ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_max_webhook_configs();
