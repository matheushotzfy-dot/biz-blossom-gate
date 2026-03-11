
-- Add drip_days to lessons for content drip scheduling
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS drip_days integer DEFAULT 0;

-- Add rejection_reason to products for moderation
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Change default product status to pending_review for new products
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'pending_review';
