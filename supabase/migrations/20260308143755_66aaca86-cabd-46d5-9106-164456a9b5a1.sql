
-- =============================================
-- RED TEAM 50K HACKERS: Critical security fixes
-- =============================================

-- VULN 1 (CRITICAL): disputes_seller view exposes buyer_phone unmasked
-- AND has no RLS - any authenticated user can see ALL disputes from ALL sellers
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller WITH (security_invoker = true) AS
SELECT 
  id, type, status, amount, reason, admin_notes,
  seller_user_id, transaction_id,
  created_at, updated_at, resolved_at,
  LEFT(buyer_name, 2) || '***' AS buyer_name_masked,
  LEFT(buyer_email, 3) || '***@***' AS buyer_email_masked,
  CASE 
    WHEN buyer_phone IS NOT NULL THEN LEFT(buyer_phone, 4) || '****-****'
    ELSE NULL 
  END AS buyer_phone_masked
FROM disputes;

-- VULN 2 (HIGH): webhook_configs_safe view has no security_invoker
-- Any authenticated user could see ALL webhook configs from ALL users  
DROP VIEW IF EXISTS public.webhook_configs_safe;
CREATE VIEW public.webhook_configs_safe WITH (security_invoker = true) AS
SELECT 
  id, user_id, url, events, is_active, created_at, updated_at,
  CASE WHEN secret IS NOT NULL THEN LEFT(secret, 4) || '****' ELSE NULL END AS secret_masked
FROM webhook_configs;

-- VULN 3 (HIGH): product_pixels_public view could leak pixel configs
-- Recreate with security_invoker
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public WITH (security_invoker = true) AS
SELECT 
  id, product_id, platform, pixel_id, domain, events, is_active,
  fire_on_pix_qr, fire_on_boleto, pix_conversion_value, boleto_conversion_value,
  disable_bump_events
FROM product_pixels
WHERE is_active = true;
