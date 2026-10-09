CREATE OR REPLACE FUNCTION public.pin_affiliate_commission_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric;
BEGIN
  SELECT affiliate_commission INTO _pct FROM public.products WHERE id = NEW.product_id;
  NEW.commission_pct := COALESCE(_pct, 30);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.pin_affiliate_commission_on_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pin_affiliate_commission ON public.affiliate_links;
CREATE TRIGGER trg_pin_affiliate_commission BEFORE INSERT ON public.affiliate_links
FOR EACH ROW EXECUTE FUNCTION public.pin_affiliate_commission_on_insert();