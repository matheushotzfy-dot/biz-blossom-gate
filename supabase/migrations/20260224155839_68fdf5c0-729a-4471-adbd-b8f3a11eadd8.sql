
-- Acquirers table
CREATE TABLE public.acquirers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'black' CHECK (type IN ('white', 'black')),
  is_active boolean NOT NULL DEFAULT true,
  api_endpoint text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.acquirers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage acquirers" ON public.acquirers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed PodPay as default black acquirer
INSERT INTO public.acquirers (name, slug, type, is_active, description)
VALUES ('PodPay', 'podpay', 'black', true, 'Adquirente principal - Cash-in e Cash-out via PIX');

-- Add seller classification and acquirer assignment to profiles
ALTER TABLE public.profiles 
  ADD COLUMN seller_type text DEFAULT NULL CHECK (seller_type IS NULL OR seller_type IN ('white', 'black')),
  ADD COLUMN acquirer_id uuid REFERENCES public.acquirers(id) DEFAULT NULL;

-- Seller-specific acquirer overrides table (for granular per-seller assignment)
CREATE TABLE public.seller_acquirer_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  acquirer_id uuid NOT NULL REFERENCES public.acquirers(id),
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  admin_user_id uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, acquirer_id)
);

ALTER TABLE public.seller_acquirer_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seller acquirer config" ON public.seller_acquirer_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own acquirer config" ON public.seller_acquirer_config FOR SELECT USING (auth.uid() = user_id);
