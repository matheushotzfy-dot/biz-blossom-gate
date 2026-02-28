
-- FIX: product_pixels exposes api_token to anon users
-- Remove the permissive anon read policy and replace with one that excludes api_token
-- Since we can't filter columns via RLS, we need a different approach:
-- Drop the anon permissive policy and create a public view without api_token

DROP POLICY IF EXISTS "anon_read_active_pixels" ON public.product_pixels;

-- Create a safe public view for pixel configs (no api_token exposed)
CREATE OR REPLACE VIEW public.product_pixels_public
  WITH (security_invoker = true)
AS
  SELECT 
    id, platform, pixel_id, product_id, events,
    fire_on_pix_qr, fire_on_boleto, pix_conversion_value,
    boleto_conversion_value, disable_bump_events, is_active, domain
  FROM public.product_pixels
  WHERE is_active = true;

GRANT SELECT ON public.product_pixels_public TO anon;
GRANT SELECT ON public.product_pixels_public TO authenticated;
