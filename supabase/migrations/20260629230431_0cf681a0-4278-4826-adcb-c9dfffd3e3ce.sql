-- Replace "bump on paid" with atomic reserve-on-insert + release-on-refund
DROP TRIGGER IF EXISTS trg_bump_coupon_usage_on_paid ON public.transactions;

CREATE OR REPLACE FUNCTION public.reserve_coupon_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated int;
BEGIN
  -- Reserve a slot atomically on INSERT
  IF TG_OP = 'INSERT' AND NEW.coupon_id IS NOT NULL THEN
    UPDATE public.coupons
       SET current_uses = current_uses + 1
     WHERE id = NEW.coupon_id
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR current_uses < max_uses);
    GET DIAGNOSTICS _updated = ROW_COUNT;
    IF _updated = 0 THEN
      RAISE EXCEPTION 'Cupom esgotado, expirado ou inválido' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  -- Track total discount + release on refund/chargeback
  IF TG_OP = 'UPDATE' AND NEW.coupon_id IS NOT NULL THEN
    IF NEW.status = 'completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
      UPDATE public.coupons
         SET total_discount_amount = total_discount_amount + COALESCE(NEW.discount_amount, 0)
       WHERE id = NEW.coupon_id;
    ELSIF NEW.status IN ('refunded','chargeback','failed','cancelled')
          AND OLD.status NOT IN ('refunded','chargeback','failed','cancelled') THEN
      UPDATE public.coupons
         SET current_uses = GREATEST(current_uses - 1, 0),
             total_discount_amount = GREATEST(total_discount_amount - COALESCE(NEW.discount_amount, 0), 0)
       WHERE id = NEW.coupon_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reserve_coupon_on_tx
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.reserve_coupon_on_tx();

REVOKE EXECUTE ON FUNCTION public.reserve_coupon_on_tx() FROM PUBLIC, anon, authenticated;