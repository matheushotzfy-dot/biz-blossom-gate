
-- Fix: remove overly permissive INSERT policy on transactions
-- Checkout inserts should go through an edge function with service role instead
DROP POLICY IF EXISTS "Public can insert transactions" ON public.transactions;
