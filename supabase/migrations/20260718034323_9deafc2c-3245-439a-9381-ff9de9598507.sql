-- 1) Insere a nova adquirente PodPay (versão nova - api.podpay.app)
INSERT INTO public.acquirers (
  slug, name, type, is_active, seller_visible,
  api_endpoint, api_environment, priority,
  supported_methods, allow_failover,
  description, notes
) VALUES (
  'podpay_app',
  'PodPay',
  'white',
  true,
  true,
  'https://api.podpay.app',
  'production',
  20,
  ARRAY['pix']::text[],
  true,
  'PodPay v1 (nova) — autenticação por x-api-key, valores em centavos.',
  'Auth: header x-api-key. Idempotência: X-Idempotency-Key (UUID v4). Amounts em centavos.'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_active = true,
    seller_visible = true,
    api_endpoint = EXCLUDED.api_endpoint,
    api_environment = EXCLUDED.api_environment,
    priority = GREATEST(public.acquirers.priority, EXCLUDED.priority),
    supported_methods = EXCLUDED.supported_methods,
    allow_failover = EXCLUDED.allow_failover,
    description = EXCLUDED.description,
    notes = EXCLUDED.notes,
    updated_at = now();

-- 2) Desativa a PodPay antiga (não remove — preserva histórico de vendas)
UPDATE public.acquirers
SET is_active = false,
    seller_visible = false,
    notes = COALESCE(notes,'') || ' [DEPRECATED — substituída pela linha podpay_app em ' || now()::text || ']',
    updated_at = now()
WHERE slug = 'podpay';

-- 3) Agenda o job de reconciliação (fallback) a cada 2 minutos
DO $$
DECLARE
  proj_url text := 'https://glccldyjevnmoogakqxw.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsY2NsZHlqZXZubW9vZ2FrcXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDUwMjcsImV4cCI6MjA4NzMyMTAyN30.qJ4aqyOufI9D9bSpqpRoDOj-M7plI9HL26sQfbYW1cA';
BEGIN
  PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'podpay_app_poll_pending_every_2min';

  PERFORM cron.schedule(
    'podpay_app_poll_pending_every_2min',
    '*/2 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
    $cron$,
      proj_url || '/functions/v1/podpay-app-poll',
      json_build_object('Content-Type','application/json','apikey',anon_key)::text
    )
  );
END $$;