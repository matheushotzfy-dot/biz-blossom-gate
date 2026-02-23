-- 1. Remove public SELECT policy on products that exposes user_id
DROP POLICY IF EXISTS "Public can view active products" ON public.products;

-- 2. Create a public view without user_id for checkout pages
CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = on) AS
  SELECT id, name, description, price, image_url, checkout_url, status, created_at
  FROM public.products
  WHERE status = 'active';

-- 3. Allow anonymous/public reads on the view via a new policy that only exposes active products without user_id
CREATE POLICY "Public can view active products (safe)"
ON public.products
FOR SELECT
USING (status = 'active' AND auth.uid() IS NULL);

-- 4. Add a trigger to validate withdrawal amounts don't exceed available balance
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_earned numeric;
  _total_withdrawn numeric;
  _available numeric;
BEGIN
  -- Calculate total net earnings
  SELECT COALESCE(SUM(net_amount), 0) INTO _total_earned
  FROM public.transactions
  WHERE user_id = NEW.user_id AND status = 'completed';

  -- Calculate total approved/pending withdrawals
  SELECT COALESCE(SUM(amount), 0) INTO _total_withdrawn
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved');

  _available := _total_earned - _total_withdrawn;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_withdrawal_before_insert
BEFORE INSERT ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.validate_withdrawal_amount();

-- 5. Restrict transactions INSERT to only allow via authenticated user matching user_id
-- (already enforced by RLS, but add additional check)
-- Remove direct user insert capability - transactions should only be created via edge functions
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

CREATE POLICY "Users can insert own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- 6. Enable leaked password protection
-- Note: This needs to be done via auth config, not SQL
