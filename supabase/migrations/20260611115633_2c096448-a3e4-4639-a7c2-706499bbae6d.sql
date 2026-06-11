-- Add boleto custom fee columns + missing default platform fees
ALTER TABLE public.custom_user_fees
  ADD COLUMN IF NOT EXISTS boleto_percentage numeric,
  ADD COLUMN IF NOT EXISTS boleto_fixed numeric;

INSERT INTO public.fees (name, value, fee_type)
SELECT 'Taxa Fixa Cartão', 0.00, 'fixed'
WHERE NOT EXISTS (SELECT 1 FROM public.fees WHERE name = 'Taxa Fixa Cartão');

INSERT INTO public.fees (name, value, fee_type)
SELECT 'Taxa Boleto Percentual', 0.00, 'percentage'
WHERE NOT EXISTS (SELECT 1 FROM public.fees WHERE name = 'Taxa Boleto Percentual');

INSERT INTO public.fees (name, value, fee_type)
SELECT 'Taxa Fixa Boleto', 3.49, 'fixed'
WHERE NOT EXISTS (SELECT 1 FROM public.fees WHERE name = 'Taxa Fixa Boleto');