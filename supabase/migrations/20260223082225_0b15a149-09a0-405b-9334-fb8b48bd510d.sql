
-- Add checkout customization columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS checkout_button_color text DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS checkout_timer_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_timer_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS checkout_banner_desktop_url text,
  ADD COLUMN IF NOT EXISTS checkout_banner_mobile_url text,
  ADD COLUMN IF NOT EXISTS checkout_social_proof boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_guarantee_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_pix_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_boleto_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_credit_card_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_address_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_email_confirm boolean DEFAULT true;

-- Update the products_public view to include new fields
CREATE OR REPLACE VIEW public.products_public AS
  SELECT 
    id, name, description, price, image_url, checkout_url, status, created_at,
    checkout_button_color, checkout_timer_enabled, checkout_timer_minutes,
    checkout_banner_desktop_url, checkout_banner_mobile_url,
    checkout_social_proof, checkout_guarantee_enabled,
    checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
    checkout_address_required, checkout_email_confirm
  FROM public.products
  WHERE status = 'active';

-- Create storage bucket for checkout banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkout-banners', 'checkout-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for checkout banners
CREATE POLICY "Users can upload own checkout banners"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'checkout-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own checkout banners"
ON storage.objects FOR UPDATE
USING (bucket_id = 'checkout-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own checkout banners"
ON storage.objects FOR DELETE
USING (bucket_id = 'checkout-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Checkout banners are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'checkout-banners');
