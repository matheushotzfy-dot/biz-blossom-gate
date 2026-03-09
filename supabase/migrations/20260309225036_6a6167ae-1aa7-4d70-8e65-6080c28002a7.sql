
-- =====================================================
-- FIX #6: Missing anon deny on seller_acquirer_config
-- =====================================================
CREATE POLICY "deny_anon_all_seller_acquirer_config"
ON public.seller_acquirer_config
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =====================================================
-- FIX #7: Missing anon deny on platform_settings
-- =====================================================
CREATE POLICY "deny_anon_all_platform_settings"
ON public.platform_settings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =====================================================
-- FIX #8: user_roles Block policies must be RESTRICTIVE
-- =====================================================
DROP POLICY IF EXISTS "Block user_roles DELETE" ON public.user_roles;
DROP POLICY IF EXISTS "Block user_roles INSERT" ON public.user_roles;
DROP POLICY IF EXISTS "Block user_roles UPDATE" ON public.user_roles;

CREATE POLICY "block_user_roles_delete"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "block_user_roles_insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "block_user_roles_update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false);

-- =====================================================
-- FIX #11: deny_anon_all_user_roles must be RESTRICTIVE
-- =====================================================
DROP POLICY IF EXISTS "deny_anon_all_user_roles" ON public.user_roles;

CREATE POLICY "deny_anon_all_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =====================================================
-- FIX #9/#12: Server-side withdrawal net_amount & fee validation
-- Prevents client-side tampering of net_amount/fee_amount
-- =====================================================
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _fee numeric;
BEGIN
  -- Get the standard withdrawal fee from fees table
  SELECT COALESCE(value, 5.00) INTO _fee
  FROM public.fees
  WHERE name = 'Taxa de Saque' AND fee_type = 'fixed'
  LIMIT 1;

  -- If no fee row found, use default R$ 5.00
  IF _fee IS NULL THEN
    _fee := 5.00;
  END IF;

  -- Force server-side calculation regardless of what client sent
  NEW.fee_amount := _fee;
  NEW.net_amount := NEW.amount - _fee;

  -- Validate net_amount is positive
  IF NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'Valor de saque deve ser maior que a taxa de R$ %', ROUND(_fee, 2);
  END IF;

  -- Force pending status on insert
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_withdrawal_fee_trigger
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_withdrawal_fee();

-- =====================================================
-- FIX #10: Secure checkout polling via RPC
-- Allows anonymous users to check transaction status
-- without exposing the full transactions table
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_checkout_status(_transaction_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT status FROM public.transactions WHERE id = _transaction_id LIMIT 1;
$$;

-- Grant execute to anon so checkout can poll
GRANT EXECUTE ON FUNCTION public.get_checkout_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_checkout_status(uuid) TO authenticated;

-- =====================================================
-- Add missing anon deny on seller_auto_withdraw  
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'seller_auto_withdraw' 
    AND policyname = 'deny_anon_all_seller_auto_withdraw'
  ) THEN
    CREATE POLICY "deny_anon_all_seller_auto_withdraw"
    ON public.seller_auto_withdraw
    AS RESTRICTIVE
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);
  END IF;
END;
$$;
