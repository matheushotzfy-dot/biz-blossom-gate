
-- ====== ITEM 3: Anti-abuse rate limits (per user, per minute) ======
CREATE OR REPLACE FUNCTION public.rate_limit_products_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  -- Admins exempt
  IF NEW.user_id IS NULL OR public.has_role(NEW.user_id, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO recent_count
  FROM public.products
  WHERE user_id = NEW.user_id
    AND created_at >= now() - interval '60 seconds';
  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: máximo de 30 produtos por minuto. Aguarde antes de criar mais.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_rate_limit_products ON public.products;
CREATE TRIGGER trg_rate_limit_products
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_products_insert();

CREATE OR REPLACE FUNCTION public.rate_limit_coupons_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  IF NEW.user_id IS NULL OR public.has_role(NEW.user_id, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO recent_count
  FROM public.coupons
  WHERE user_id = NEW.user_id
    AND created_at >= now() - interval '60 seconds';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: máximo de 10 cupons por minuto. Aguarde antes de criar mais.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_rate_limit_coupons ON public.coupons;
CREATE TRIGGER trg_rate_limit_coupons
  BEFORE INSERT ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_coupons_insert();

-- ====== ITEM 5: Lock down SECURITY DEFINER functions in public from anon/PUBLIC ======
-- Postgres grants EXECUTE to PUBLIC by default. Strip it from every SECURITY DEFINER
-- function in `public`. Authenticated/service_role keep access via explicit grants.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS fname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.fname, r.args);
  END LOOP;
END $$;
