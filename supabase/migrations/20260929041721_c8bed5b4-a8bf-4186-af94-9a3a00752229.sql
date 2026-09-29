ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ALTER COLUMN boleto_enabled SET DEFAULT false;

UPDATE public.profiles SET boleto_enabled = false WHERE boleto_enabled IS DISTINCT FROM false;
UPDATE public.products SET checkout_boleto_enabled = false WHERE checkout_boleto_enabled IS DISTINCT FROM false;
UPDATE public.payment_links SET accept_boleto = false WHERE accept_boleto IS DISTINCT FROM false;

CREATE OR REPLACE FUNCTION public.enforce_seller_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pix boolean := false;
  _card boolean := false;
  _boleto boolean := false;
BEGIN
  SELECT p.pix_enabled, p.credit_card_enabled, p.boleto_enabled
    INTO _pix, _card, _boleto
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta do vendedor não encontrada';
  END IF;

  IF TG_TABLE_NAME = 'products' THEN
    IF COALESCE(NEW.checkout_pix_enabled, false) AND NOT _pix THEN
      RAISE EXCEPTION 'PIX não está liberado para esta conta';
    END IF;
    IF COALESCE(NEW.checkout_credit_card_enabled, false) AND NOT _card THEN
      RAISE EXCEPTION 'Cartão não está liberado para esta conta';
    END IF;
    IF COALESCE(NEW.checkout_boleto_enabled, false) AND NOT _boleto THEN
      RAISE EXCEPTION 'Boleto não está liberado para esta conta';
    END IF;
  ELSIF TG_TABLE_NAME = 'payment_links' THEN
    IF COALESCE(NEW.accept_pix, false) AND NOT _pix THEN
      RAISE EXCEPTION 'PIX não está liberado para esta conta';
    END IF;
    IF COALESCE(NEW.accept_card, false) AND NOT _card THEN
      RAISE EXCEPTION 'Cartão não está liberado para esta conta';
    END IF;
    IF COALESCE(NEW.accept_boleto, false) AND NOT _boleto THEN
      RAISE EXCEPTION 'Boleto não está liberado para esta conta';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_seller_payment_methods_products ON public.products;
CREATE TRIGGER enforce_seller_payment_methods_products
BEFORE INSERT OR UPDATE OF user_id, checkout_pix_enabled, checkout_credit_card_enabled, checkout_boleto_enabled
ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_payment_methods();

DROP TRIGGER IF EXISTS enforce_seller_payment_methods_links ON public.payment_links;
CREATE TRIGGER enforce_seller_payment_methods_links
BEFORE INSERT OR UPDATE OF user_id, accept_pix, accept_card, accept_boleto
ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_payment_methods();

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

  IF OLD.pix_enabled IS DISTINCT FROM NEW.pix_enabled
     OR OLD.credit_card_enabled IS DISTINCT FROM NEW.credit_card_enabled
     OR OLD.boleto_enabled IS DISTINCT FROM NEW.boleto_enabled THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'update_seller_payment_methods',
      'profile',
      NEW.user_id::text,
      jsonb_build_object(
        'before', jsonb_build_object('pix', OLD.pix_enabled, 'credit_card', OLD.credit_card_enabled, 'boleto', OLD.boleto_enabled),
        'after', jsonb_build_object('pix', NEW.pix_enabled, 'credit_card', NEW.credit_card_enabled, 'boleto', NEW.boleto_enabled)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_seller_payment_method_blocks_tg ON public.profiles;
CREATE TRIGGER propagate_seller_payment_method_blocks_tg
AFTER UPDATE OF pix_enabled, credit_card_enabled, boleto_enabled
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.propagate_seller_payment_method_blocks();

CREATE OR REPLACE FUNCTION public.get_public_payment_link(_slug text)
RETURNS TABLE(
  id uuid, slug text, title text, description text, cover_url text, amount numeric,
  is_active boolean, accept_pix boolean, accept_card boolean, accept_boleto boolean,
  max_uses integer, current_uses integer, expires_at timestamptz, billing_type text,
  pricing_type text, min_amount numeric, max_amount numeric, suggested_amount numeric,
  allow_quantity boolean, max_quantity integer, reference_code text, instructions text,
  pix_expiration_minutes integer, recurrence_interval text, recurrence_interval_count integer,
  recurrence_cycles integer, trial_days integer, cancellation_policy text, admin_status text,
  redirect_url text, options jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.slug, p.title, p.description, p.cover_url, p.amount,
         p.is_active,
         (p.accept_pix AND COALESCE(pr.pix_enabled, false)),
         (p.accept_card AND COALESCE(pr.credit_card_enabled, false)),
         (p.accept_boleto AND COALESCE(pr.boleto_enabled, false)),
         p.max_uses, p.current_uses, p.expires_at,
         p.billing_type, p.pricing_type, p.min_amount, p.max_amount,
         p.suggested_amount, p.allow_quantity, p.max_quantity,
         p.reference_code, p.instructions, p.pix_expiration_minutes,
         p.recurrence_interval, p.recurrence_interval_count, p.recurrence_cycles,
         p.trial_days, p.cancellation_policy, p.admin_status, p.redirect_url,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'description', o.description, 'amount_delta', o.amount_delta, 'is_required', o.is_required) ORDER BY o.position)
                   FROM public.payment_link_options o WHERE o.payment_link_id = p.id AND o.is_active), '[]'::jsonb)
  FROM public.payment_links p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE lower(p.slug) = lower(trim(_slug)) AND p.archived_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = true)
AS
SELECT p.id, p.name, p.description, p.price, p.status, p.image_url, p.checkout_url,
       (COALESCE(p.checkout_pix_enabled, false) AND COALESCE(pr.pix_enabled, false)) AS checkout_pix_enabled,
       (COALESCE(p.checkout_boleto_enabled, false) AND COALESCE(pr.boleto_enabled, false)) AS checkout_boleto_enabled,
       (COALESCE(p.checkout_credit_card_enabled, false) AND COALESCE(pr.credit_card_enabled, false)) AS checkout_credit_card_enabled,
       p.checkout_timer_enabled, p.checkout_timer_minutes, p.checkout_social_proof,
       p.checkout_guarantee_enabled, p.checkout_address_required, p.checkout_email_confirm,
       p.checkout_button_color, p.checkout_banner_desktop_url, p.checkout_banner_mobile_url,
       p.checkout_theme, p.created_at, p.support_email, p.display_name, p.delivery_type,
       p.affiliate_enabled, p.affiliate_commission
FROM public.products p
JOIN public.profiles pr ON pr.user_id = p.user_id
WHERE p.status = 'active' AND p.deleted_at IS NULL;

GRANT SELECT ON public.products_public TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_max_api_keys_trigger ON public.api_keys;
DROP FUNCTION IF EXISTS public.enforce_max_api_keys();
