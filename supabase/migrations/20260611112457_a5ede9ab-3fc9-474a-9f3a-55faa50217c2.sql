INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('require_email_verification', '{"enabled": true}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;