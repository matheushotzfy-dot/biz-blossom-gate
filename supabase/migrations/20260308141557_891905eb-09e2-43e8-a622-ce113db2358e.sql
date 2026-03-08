-- Remove duplicate index (partial already exists)
DROP INDEX IF EXISTS idx_transactions_podpay_payment_id;

-- Add missing index for webhook_configs lookups (128 seq_scans, 0 idx_scans)
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_active ON public.webhook_configs(user_id, is_active);

-- Add missing index for products user_id lookups (1511 seq_scans)
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);

-- Add index for product_pixels product_id (used in checkout pixel loading)
CREATE INDEX IF NOT EXISTS idx_product_pixels_product_active ON public.product_pixels(product_id) WHERE is_active = true;