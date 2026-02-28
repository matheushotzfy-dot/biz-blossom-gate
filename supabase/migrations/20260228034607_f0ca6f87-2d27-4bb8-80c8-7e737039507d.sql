
-- Balance retention settings (global + per seller)
CREATE TABLE public.retention_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL, -- NULL = global, non-null = per seller
  pix_retention_pct numeric NOT NULL DEFAULT 0,
  card_retention_pct numeric NOT NULL DEFAULT 0,
  retention_days integer NOT NULL DEFAULT 14,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage retention settings" ON public.retention_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own retention" ON public.retention_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view global retention" ON public.retention_settings FOR SELECT USING (user_id IS NULL);

-- Insert default global retention
INSERT INTO public.retention_settings (user_id, pix_retention_pct, card_retention_pct, retention_days)
VALUES (NULL, 0, 0, 14);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL, -- NULL = broadcast to all
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- info, warning, success, alert
  is_read boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Retained balance tracking on transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS retained_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS retained_until timestamptz DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS retention_released boolean NOT NULL DEFAULT false;
