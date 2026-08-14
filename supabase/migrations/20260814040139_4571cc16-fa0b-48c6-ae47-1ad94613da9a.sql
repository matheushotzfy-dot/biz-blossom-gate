
-- 1) Sellers precisam ler as taxas padrão da plataforma (a tabela `fees` é restrita a admin).
CREATE OR REPLACE FUNCTION public.get_platform_fees()
RETURNS TABLE(name text, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.name, f.value FROM public.fees f ORDER BY f.name;
$$;
REVOKE ALL ON FUNCTION public.get_platform_fees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_fees() TO authenticated, service_role;

-- 2) Teste de webhook: o dono do endpoint enfileira um evento de teste.
CREATE OR REPLACE FUNCTION public.enqueue_test_webhook(_config_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg record;
  _id uuid;
BEGIN
  SELECT id, user_id, is_active INTO _cfg
    FROM public.webhook_configs
   WHERE id = _config_id AND user_id = auth.uid();

  IF _cfg IS NULL THEN
    RAISE EXCEPTION 'Endpoint não encontrado';
  END IF;
  IF NOT _cfg.is_active THEN
    RAISE EXCEPTION 'Endpoint pausado';
  END IF;

  INSERT INTO public.webhook_deliveries (webhook_config_id, user_id, event, payload, next_retry_at)
  VALUES (
    _cfg.id,
    _cfg.user_id,
    'webhook.test',
    jsonb_build_object(
      'event', 'webhook.test',
      'test', true,
      'sent_at', now(),
      'data', jsonb_build_object(
        'transaction_id', gen_random_uuid(),
        'status', 'paid',
        'amount', 49.90,
        'payment_method', 'pix',
        'customer', jsonb_build_object('name','Cliente Teste','email','teste@hotzfy.com.br')
      )
    ),
    now()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_test_webhook(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_test_webhook(uuid) TO authenticated;

-- 3) Worker de webhooks nunca era executado: agendar a cada minuto.
SELECT cron.unschedule('webhook_dispatcher_every_min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhook_dispatcher_every_min');

SELECT cron.schedule(
  'webhook_dispatcher_every_min',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://glccldyjevnmoogakqxw.supabase.co/functions/v1/webhook-dispatcher',
      headers := '{"Content-Type":"application/json","x-cron-secret":"d22ec61e3c41f5cb126b864c16bb3e202a172d4d01ea16017f0566fcb525a394"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 28000
    );
  $cron$
);

SELECT cron.unschedule('apps_dispatcher_every_min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apps_dispatcher_every_min');

SELECT cron.schedule(
  'apps_dispatcher_every_min',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://glccldyjevnmoogakqxw.supabase.co/functions/v1/apps-dispatcher',
      headers := '{"Content-Type":"application/json","x-cron-secret":"d22ec61e3c41f5cb126b864c16bb3e202a172d4d01ea16017f0566fcb525a394"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 28000
    );
  $cron$
);
