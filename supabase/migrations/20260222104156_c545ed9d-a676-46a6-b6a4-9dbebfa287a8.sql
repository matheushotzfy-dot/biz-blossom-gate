
-- Add account_status to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending_review';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key_type text;

-- Webhook configurations
CREATE TABLE public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhooks" ON public.webhook_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own webhooks" ON public.webhook_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own webhooks" ON public.webhook_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own webhooks" ON public.webhook_configs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all webhooks" ON public.webhook_configs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Coupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coupons" ON public.coupons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coupons" ON public.coupons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own coupons" ON public.coupons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own coupons" ON public.coupons FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update profiles (for account status changes)
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update withdrawals (for approve/reject)  
CREATE POLICY "Admins can update withdrawals" ON public.withdrawals FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update transactions
CREATE POLICY "Admins can update transactions" ON public.transactions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow public access to products for checkout (no auth required)
CREATE POLICY "Public can view active products" ON public.products FOR SELECT USING (status = 'active');

-- Allow public to insert transactions (for checkout)
CREATE POLICY "Public can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_webhook_configs_updated_at BEFORE UPDATE ON public.webhook_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
