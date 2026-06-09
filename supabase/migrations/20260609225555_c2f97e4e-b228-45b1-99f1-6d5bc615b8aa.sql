
-- 1. Drop unused admin-SELECT policies that exposed plaintext secrets
DROP POLICY IF EXISTS "Admins can view all integrations" ON public.app_integrations;
DROP POLICY IF EXISTS "Admins can view all webhooks" ON public.webhook_configs;
DROP POLICY IF EXISTS "Admins can view all pixels" ON public.product_pixels;

-- 2. Block clients from setting is_simulated on transactions
CREATE OR REPLACE FUNCTION public.protect_is_simulated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses RLS so auth.uid() is NULL there
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_simulated, false) = true THEN
      NEW.is_simulated := false;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_simulated IS DISTINCT FROM OLD.is_simulated THEN
      NEW.is_simulated := OLD.is_simulated;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_is_simulated ON public.transactions;
CREATE TRIGGER trg_protect_is_simulated
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.protect_is_simulated();
