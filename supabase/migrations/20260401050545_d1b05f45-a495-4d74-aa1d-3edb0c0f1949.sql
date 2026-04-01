
-- Table for 2FA OTP codes (admin login)
CREATE TABLE public.admin_2fa_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  temp_token text,
  access_token text,
  refresh_token text,
  role text,
  expires_at timestamptz NOT NULL,
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Auto-cleanup expired codes
CREATE INDEX idx_admin_2fa_codes_email ON public.admin_2fa_codes(email);
CREATE INDEX idx_admin_2fa_codes_temp_token ON public.admin_2fa_codes(temp_token);

-- RLS: only service_role can access this table
ALTER TABLE public.admin_2fa_codes ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role key can read/write
