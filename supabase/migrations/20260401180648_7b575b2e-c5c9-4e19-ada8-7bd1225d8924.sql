
-- Add conversion_rate and seller_visible to acquirers
ALTER TABLE public.acquirers
  ADD COLUMN IF NOT EXISTS conversion_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_visible boolean NOT NULL DEFAULT false;

-- Allow sellers to see acquirers that are active AND visible
CREATE POLICY "Sellers can view visible acquirers"
ON public.acquirers
FOR SELECT
TO authenticated
USING (is_active = true AND seller_visible = true);
