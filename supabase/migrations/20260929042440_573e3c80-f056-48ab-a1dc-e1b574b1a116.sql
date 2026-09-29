CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = true)
AS
SELECT
  id, name, description, price::numeric(10,2) AS price, status, image_url, checkout_url,
  checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
  checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
  checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
  checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
  checkout_theme, product_created_at AS created_at, support_email, display_name,
  delivery_type, affiliate_enabled, affiliate_commission
FROM public.public_product_catalog;
GRANT SELECT ON public.products_public TO anon, authenticated, service_role;