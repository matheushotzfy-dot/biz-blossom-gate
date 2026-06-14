
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS upsell_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upsell_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS upsell_name text,
  ADD COLUMN IF NOT EXISTS upsell_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS upsell_discount integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS upsell_url text,
  ADD COLUMN IF NOT EXISTS downsell_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS downsell_url text,
  ADD COLUMN IF NOT EXISTS downsell_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS downsell_delay integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS email_timing text NOT NULL DEFAULT 'immediate';
