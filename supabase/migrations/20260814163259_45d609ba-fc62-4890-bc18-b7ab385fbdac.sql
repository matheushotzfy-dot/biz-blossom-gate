CREATE OR REPLACE FUNCTION public.guard_product_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  -- service_role / internal jobs pass through
  IF _caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(_caller, 'admin'::app_role)
     OR public.has_role(_caller, 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Admin-only columns are silently preserved
  NEW.classification := OLD.classification;
  NEW.rejection_reason := OLD.rejection_reason;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Sellers may only: submit for review, pause, or resume an already approved product
    IF NOT (
      NEW.status = 'pending_review'
      OR (NEW.status = 'inactive')
      OR (NEW.status = 'active' AND OLD.status IN ('active', 'inactive'))
    ) THEN
      RAISE EXCEPTION 'Alteração de status não permitida'
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'product_status_restricted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_self_update ON public.products;
CREATE TRIGGER trg_guard_product_self_update
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_product_self_update();

REVOKE EXECUTE ON FUNCTION public.guard_product_self_update() FROM PUBLIC, anon, authenticated;