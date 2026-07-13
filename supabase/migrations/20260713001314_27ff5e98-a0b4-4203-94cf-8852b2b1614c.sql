-- R1: garantir e-mail único em profiles (defesa em profundidade contra multi-conta)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_key' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- R5: remover constraints únicas duplicadas (uma cópia é suficiente)
ALTER TABLE public.custom_user_fees   DROP CONSTRAINT IF EXISTS custom_user_fees_user_id_unique;
ALTER TABLE public.seller_auto_withdraw DROP CONSTRAINT IF EXISTS seller_auto_withdraw_user_id_unique;
ALTER TABLE public.retention_settings  DROP CONSTRAINT IF EXISTS retention_settings_user_id_unique;