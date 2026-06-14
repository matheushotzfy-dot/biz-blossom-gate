ALTER TABLE public.products ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'white';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_classification_check;
ALTER TABLE public.products ADD CONSTRAINT products_classification_check CHECK (classification IN ('white','gray','black'));
CREATE INDEX IF NOT EXISTS idx_products_classification ON public.products(classification);