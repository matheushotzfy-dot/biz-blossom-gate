
-- Add support_email and display_name columns to products
ALTER TABLE public.products ADD COLUMN support_email text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN display_name text DEFAULT NULL;

-- Recreate products_public view to include new columns
CREATE OR REPLACE VIEW public.products_public AS
SELECT id, name, description, price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  created_at, support_email, display_name
FROM products WHERE status = 'active';
