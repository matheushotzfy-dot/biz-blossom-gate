
-- Fix security definer view issue
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public 
  WITH (security_invoker = true)
AS
  SELECT 
    id, name, description, price, image_url, status,
    checkout_url, checkout_pix_enabled, checkout_credit_card_enabled,
    checkout_boleto_enabled, checkout_button_color, checkout_timer_enabled,
    checkout_timer_minutes, checkout_social_proof, checkout_guarantee_enabled,
    checkout_email_confirm, checkout_address_required,
    checkout_banner_desktop_url, checkout_banner_mobile_url,
    created_at
  FROM public.products
  WHERE status = 'active';

GRANT SELECT ON public.products_public TO anon;
GRANT SELECT ON public.products_public TO authenticated;
