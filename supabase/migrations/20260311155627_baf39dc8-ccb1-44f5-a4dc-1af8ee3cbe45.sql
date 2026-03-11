-- Fix search_path on new functions
ALTER FUNCTION public.validate_balance_adjustment() SET search_path = public;
ALTER FUNCTION public.validate_retention_settings() SET search_path = public;
ALTER FUNCTION public.validate_notification_rate() SET search_path = public;
ALTER FUNCTION public.validate_withdrawal() SET search_path = public;