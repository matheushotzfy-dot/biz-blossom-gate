ALTER TABLE public.admin_login_attempts
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'admin';

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_email_scope_created
  ON public.admin_login_attempts (email, scope, created_at DESC);