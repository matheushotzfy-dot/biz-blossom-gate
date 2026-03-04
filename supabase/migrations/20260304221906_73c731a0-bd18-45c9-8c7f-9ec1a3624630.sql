-- Fix: Recreate public views WITHOUT security_invoker so anonymous checkout visitors can access them
-- msDev's — Security patch for public checkout access

DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public AS
  SELECT id, name, description, price, image_url, status, checkout_url,
    checkout_pix_enabled, checkout_credit_card_enabled, checkout_boleto_enabled,
    checkout_button_color, checkout_timer_enabled, checkout_timer_minutes,
    checkout_social_proof, checkout_guarantee_enabled, checkout_email_confirm,
    checkout_address_required, checkout_banner_desktop_url, checkout_banner_mobile_url,
    created_at
  FROM products
  WHERE status = 'active';

DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public AS
  SELECT id, product_id, platform, pixel_id, domain, events,
    fire_on_pix_qr, fire_on_boleto, pix_conversion_value, boleto_conversion_value,
    disable_bump_events, is_active
  FROM product_pixels
  WHERE is_active = true;