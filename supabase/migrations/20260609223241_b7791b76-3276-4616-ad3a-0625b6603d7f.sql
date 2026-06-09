
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS apply_to_bumps boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _product_id uuid, _amount numeric)
RETURNS TABLE(valid boolean, coupon_id uuid, discount_amount numeric, discount_type text, discount_value numeric, apply_to_bumps boolean, error text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _c record;
  _disc numeric := 0;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Código vazio'; RETURN;
  END IF;
  SELECT user_id INTO _owner FROM public.products WHERE id = _product_id AND status = 'active' LIMIT 1;
  IF _owner IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Produto inválido'; RETURN;
  END IF;
  SELECT * INTO _c FROM public.coupons
   WHERE user_id = _owner
     AND upper(code) = upper(trim(_code))
     AND is_active = true
   LIMIT 1;
  IF _c IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom expirado'; RETURN;
  END IF;
  IF _c.max_uses IS NOT NULL AND _c.current_uses >= _c.max_uses THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom esgotado'; RETURN;
  END IF;
  IF _c.product_id IS NOT NULL AND _c.product_id <> _product_id THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom não válido para este produto'; RETURN;
  END IF;
  IF _c.discount_type = 'percentage' THEN
    _disc := ROUND((_amount * _c.discount_value / 100)::numeric, 2);
  ELSE
    _disc := _c.discount_value;
  END IF;
  IF _disc > _amount - 0.01 THEN _disc := GREATEST(_amount - 0.01, 0); END IF;
  IF _disc < 0 THEN _disc := 0; END IF;
  RETURN QUERY SELECT true, _c.id, _disc, _c.discount_type, _c.discount_value, _c.apply_to_bumps, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bump_coupon_usage_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    UPDATE public.coupons
       SET current_uses = current_uses + 1,
           total_discount_amount = total_discount_amount + COALESCE(NEW.discount_amount, 0)
     WHERE id = NEW.coupon_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_coupon_usage_on_paid ON public.transactions;
CREATE TRIGGER trg_bump_coupon_usage_on_paid
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.bump_coupon_usage_on_paid();
