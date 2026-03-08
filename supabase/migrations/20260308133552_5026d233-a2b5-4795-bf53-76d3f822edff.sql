
-- Fix disputes_seller view
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller WITH (security_invoker = true) AS
SELECT
  d.id,
  d.type,
  d.status,
  d.amount,
  d.reason,
  d.admin_notes,
  d.seller_user_id,
  d.transaction_id,
  d.created_at,
  d.updated_at,
  d.resolved_at,
  LEFT(d.buyer_name, 2) || '***' AS buyer_name_masked,
  LEFT(d.buyer_email, 3) || '***@***' AS buyer_email_masked,
  d.buyer_phone
FROM public.disputes d;

-- Fix webhook_configs_safe view
DROP VIEW IF EXISTS public.webhook_configs_safe;
CREATE VIEW public.webhook_configs_safe WITH (security_invoker = true) AS
SELECT
  wc.id,
  wc.user_id,
  wc.url,
  wc.events,
  wc.is_active,
  wc.created_at,
  wc.updated_at,
  CASE WHEN wc.secret IS NOT NULL THEN LEFT(wc.secret, 4) || '****' ELSE NULL END AS secret_masked
FROM public.webhook_configs wc;

-- Fix product_pixels_public view
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public WITH (security_invoker = true) AS
SELECT
  pp.id,
  pp.product_id,
  pp.platform,
  pp.pixel_id,
  pp.events,
  pp.is_active,
  pp.fire_on_pix_qr,
  pp.fire_on_boleto,
  pp.boleto_conversion_value,
  pp.pix_conversion_value,
  pp.disable_bump_events,
  pp.domain
FROM public.product_pixels pp;

-- Fix products_public view
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.description,
  p.price,
  p.image_url,
  p.status,
  p.created_at,
  p.checkout_url,
  p.checkout_pix_enabled,
  p.checkout_credit_card_enabled,
  p.checkout_boleto_enabled,
  p.checkout_timer_enabled,
  p.checkout_timer_minutes,
  p.checkout_guarantee_enabled,
  p.checkout_social_proof,
  p.checkout_email_confirm,
  p.checkout_address_required,
  p.checkout_button_color,
  p.checkout_banner_desktop_url,
  p.checkout_banner_mobile_url
FROM public.products p
WHERE p.status = 'active';
