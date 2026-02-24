
-- Add customer_phone to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_phone text;

-- Create order_bumps table
CREATE TABLE IF NOT EXISTS public.order_bumps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  bump_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, bump_product_id)
);

-- Enable RLS
ALTER TABLE public.order_bumps ENABLE ROW LEVEL SECURITY;

-- Owners can manage their order bumps
CREATE POLICY "Owners manage order bumps" ON public.order_bumps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.products WHERE products.id = order_bumps.product_id AND products.user_id = auth.uid())
  );

-- Public can read active order bumps (for checkout display)
CREATE POLICY "Public can view active order bumps" ON public.order_bumps
  FOR SELECT USING (is_active = true);
