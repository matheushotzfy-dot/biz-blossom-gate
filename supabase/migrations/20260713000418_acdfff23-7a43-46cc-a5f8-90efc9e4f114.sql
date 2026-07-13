-- FIX A1: adiciona colunas de presença geradas para nunca precisar transportar
-- os segredos reais até o cliente admin.
ALTER TABLE public.acquirers
  ADD COLUMN IF NOT EXISTS has_api_key boolean
    GENERATED ALWAYS AS (api_key_encrypted IS NOT NULL AND length(api_key_encrypted) > 0) STORED,
  ADD COLUMN IF NOT EXISTS has_api_secret boolean
    GENERATED ALWAYS AS (api_secret_encrypted IS NOT NULL AND length(api_secret_encrypted) > 0) STORED,
  ADD COLUMN IF NOT EXISTS has_webhook_secret boolean
    GENERATED ALWAYS AS (webhook_secret IS NOT NULL AND length(webhook_secret) > 0) STORED;