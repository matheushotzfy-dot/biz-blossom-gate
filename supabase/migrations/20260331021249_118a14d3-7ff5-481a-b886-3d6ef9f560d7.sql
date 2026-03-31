
-- Add delivery_type column to products
ALTER TABLE public.products ADD COLUMN delivery_type text NOT NULL DEFAULT 'digital';

-- Update products_public view to include delivery_type
CREATE OR REPLACE VIEW public.products_public AS
SELECT id, name, description, price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  created_at, support_email, display_name, delivery_type
FROM products WHERE status = 'active';
