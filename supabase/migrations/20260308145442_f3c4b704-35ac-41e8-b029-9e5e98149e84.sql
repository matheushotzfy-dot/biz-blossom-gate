-- =============================================
-- CRITICAL FIX 1: Remove transaction INSERT for authenticated users
-- Only Edge Functions (service_role) should create transactions
-- This prevents sellers from faking completed payments
-- =============================================

-- Drop the dangerous INSERT policy
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

-- Create a restrictive policy: only service_role can insert (via edge functions)
-- No INSERT policy for authenticated = no direct inserts allowed
-- Edge functions use service_role which bypasses RLS

-- Also add a trigger to prevent status manipulation on INSERT
-- Even if somehow a row is inserted, force status to 'pending'
CREATE OR REPLACE FUNCTION public.force_pending_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Force all new transactions to start as pending
  -- Only postback webhook (via service_role) can set other statuses
  IF NEW.status != 'pending' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_pending_status_trigger ON public.transactions;
CREATE TRIGGER force_pending_status_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.force_pending_on_insert();

-- Revoke direct function access
REVOKE EXECUTE ON FUNCTION public.force_pending_on_insert() FROM anon;

-- =============================================
-- CRITICAL FIX 2: Prevent role enumeration
-- Create current_user_has_role that only checks auth.uid()
-- =============================================

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Revoke has_role from authenticated (keep for admin RLS policies internally)
-- Note: has_role is still used in RLS policies which execute as the table owner
-- But we prevent direct calls from authenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

-- Grant the new safe function
GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO authenticated;

-- =============================================
-- FIX 3: Prevent users from updating transaction status
-- Only admins should be able to update (already restricted by RLS)
-- But add extra safety: users should NOT update status field
-- =============================================

CREATE OR REPLACE FUNCTION public.protect_transaction_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only service_role or admin can change status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  
  -- Prevent amount manipulation
  NEW.amount := OLD.amount;
  NEW.fee_amount := OLD.fee_amount;
  NEW.net_amount := OLD.net_amount;
  NEW.user_id := OLD.user_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_transaction_status_trigger ON public.transactions;
CREATE TRIGGER protect_transaction_status_trigger
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_transaction_status();

REVOKE EXECUTE ON FUNCTION public.protect_transaction_status() FROM anon;