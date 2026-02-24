
-- Pixel tracking per product
CREATE TABLE public.product_pixels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- facebook, google_ads, google_analytics, tiktok, kwai
  pixel_id TEXT NOT NULL,
  api_token TEXT, -- API de conversão token
  domain TEXT,
  events JSONB NOT NULL DEFAULT '["Purchase","PageView","InitiateCheckout"]'::jsonb,
  fire_on_pix_qr BOOLEAN NOT NULL DEFAULT false,
  fire_on_boleto BOOLEAN NOT NULL DEFAULT false,
  pix_conversion_value INTEGER NOT NULL DEFAULT 100,
  boleto_conversion_value INTEGER NOT NULL DEFAULT 100,
  disable_bump_events BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pixels" ON public.product_pixels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pixels" ON public.product_pixels
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
