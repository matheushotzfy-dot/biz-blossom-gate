-- Remove the policy that exposes raw PII to sellers
-- Sellers should use disputes_seller view which masks buyer data
DROP POLICY IF EXISTS "Sellers can view own disputes" ON public.disputes;