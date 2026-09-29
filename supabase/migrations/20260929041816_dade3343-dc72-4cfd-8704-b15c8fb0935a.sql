CREATE OR REPLACE FUNCTION public.guard_profile_payment_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.pix_enabled IS DISTINCT FROM NEW.pix_enabled
     OR OLD.credit_card_enabled IS DISTINCT FROM NEW.credit_card_enabled
     OR OLD.boleto_enabled IS DISTINCT FROM NEW.boleto_enabled THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Somente administradores podem alterar métodos de pagamento';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_payment_permissions_tg ON public.profiles;
CREATE TRIGGER guard_profile_payment_permissions_tg
BEFORE UPDATE OF pix_enabled, credit_card_enabled, boleto_enabled
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_payment_permissions();

CREATE OR REPLACE FUNCTION public.propagate_seller_payment_method_blocks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.pix_enabled AND NOT NEW.pix_enabled THEN
    UPDATE public.products SET checkout_pix_enabled = false WHERE user_id = NEW.user_id AND checkout_pix_enabled IS DISTINCT FROM false;
    UPDATE public.payment_links SET accept_pix = false WHERE user_id = NEW.user_id AND accept_pix IS DISTINCT FROM false;
  END IF;
  IF OLD.credit_card_enabled AND NOT NEW.credit_card_enabled THEN
    UPDATE public.products SET checkout_credit_card_enabled = false WHERE user_id = NEW.user_id AND checkout_credit_card_enabled IS DISTINCT FROM false;
    UPDATE public.payment_links SET accept_card = false WHERE user_id = NEW.user_id AND accept_card IS DISTINCT FROM false;
  END IF;
  IF OLD.boleto_enabled AND NOT NEW.boleto_enabled THEN
    UPDATE public.products SET checkout_boleto_enabled = false WHERE user_id = NEW.user_id AND checkout_boleto_enabled IS DISTINCT FROM false;
    UPDATE public.payment_links SET accept_boleto = false WHERE user_id = NEW.user_id AND accept_boleto IS DISTINCT FROM false;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(), 'update_seller_payment_methods', 'profile', NEW.user_id::text,
      jsonb_build_object(
        'before', jsonb_build_object('pix', OLD.pix_enabled, 'credit_card', OLD.credit_card_enabled, 'boleto', OLD.boleto_enabled),
        'after', jsonb_build_object('pix', NEW.pix_enabled, 'credit_card', NEW.credit_card_enabled, 'boleto', NEW.boleto_enabled)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER VIEW public.products_public SET (security_invoker = false);

REVOKE ALL ON FUNCTION public.guard_profile_payment_permissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_profile_payment_permissions() TO service_role;