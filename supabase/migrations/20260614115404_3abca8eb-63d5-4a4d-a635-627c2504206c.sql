ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS boleto_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS credit_card_enabled boolean NOT NULL DEFAULT true;