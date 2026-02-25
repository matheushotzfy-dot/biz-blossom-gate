
-- Platform settings (key-value for global config)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (true);

-- Seller auto-withdraw config (per-seller)
CREATE TABLE public.seller_auto_withdraw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  max_amount numeric NOT NULL DEFAULT 0,
  admin_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_auto_withdraw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seller auto withdraw" ON public.seller_auto_withdraw
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own auto withdraw config" ON public.seller_auto_withdraw
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Error logs table
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  stack_trace text,
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage error logs" ON public.error_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add last_login_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('auto_approve_withdrawals', '{"enabled": false, "max_amount": 100}'::jsonb),
  ('fees_white', '{"percentage": 4.99, "fixed": 2.50, "withdrawal": 5.00}'::jsonb),
  ('fees_black', '{"percentage": 4.99, "fixed": 2.50, "withdrawal": 5.00}'::jsonb)
ON CONFLICT (key) DO NOTHING;
