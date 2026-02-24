
-- Balance adjustments table (admin manual credits/debits)
CREATE TABLE public.balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'credit' CHECK (type IN ('credit', 'debit')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage balance adjustments" ON public.balance_adjustments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own adjustments" ON public.balance_adjustments
  FOR SELECT USING (auth.uid() = user_id);

-- Custom fees per user
CREATE TABLE public.custom_user_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  transaction_percentage NUMERIC DEFAULT NULL,
  transaction_fixed NUMERIC DEFAULT NULL,
  withdrawal_fee NUMERIC DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_user_id UUID NOT NULL
);
ALTER TABLE public.custom_user_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage custom fees" ON public.custom_user_fees
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own custom fees" ON public.custom_user_fees
  FOR SELECT USING (auth.uid() = user_id);

-- Disputes / MedPix table
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id),
  seller_user_id UUID NOT NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  type TEXT NOT NULL DEFAULT 'medpix' CHECK (type IN ('medpix', 'pre_med_pix', 'refund', 'chargeback')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved_seller', 'resolved_buyer', 'closed')),
  reason TEXT,
  admin_notes TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  admin_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage disputes" ON public.disputes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Sellers can view own disputes" ON public.disputes
  FOR SELECT USING (auth.uid() = seller_user_id);

-- Add last_ip column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip TEXT;
