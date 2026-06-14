
CREATE TABLE IF NOT EXISTS public.ip_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip text NOT NULL,
  user_agent text,
  country text,
  source text DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_logs_user_created ON public.ip_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_logs_ip ON public.ip_logs(ip);

GRANT SELECT, INSERT ON public.ip_logs TO authenticated;
GRANT ALL ON public.ip_logs TO service_role;

ALTER TABLE public.ip_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read ip_logs" ON public.ip_logs;
CREATE POLICY "Admins read ip_logs" ON public.ip_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own ip_logs" ON public.ip_logs;
CREATE POLICY "Users read own ip_logs" ON public.ip_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ip_logs" ON public.ip_logs;
CREATE POLICY "Users insert own ip_logs" ON public.ip_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
