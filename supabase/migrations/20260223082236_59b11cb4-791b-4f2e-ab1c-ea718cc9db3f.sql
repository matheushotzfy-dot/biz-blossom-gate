
-- Fix: Make products_public view use SECURITY INVOKER (default, safe)
ALTER VIEW public.products_public SET (security_invoker = on);
