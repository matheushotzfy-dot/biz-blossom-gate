CREATE TABLE public.public_product_catalog (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  status text NOT NULL,
  image_url text,
  checkout_url text,
  checkout_pix_enabled boolean NOT NULL DEFAULT false,
  checkout_boleto_enabled boolean NOT NULL DEFAULT false,
  checkout_credit_card_enabled boolean NOT NULL DEFAULT false,
  checkout_timer_enabled boolean,
  checkout_timer_minutes integer,
  checkout_social_proof boolean,
  checkout_guarantee_enabled boolean,
  checkout_address_required boolean,
  checkout_email_confirm boolean,
  checkout_button_color text,
  checkout_banner_desktop_url text,
  checkout_banner_mobile_url text,
  checkout_theme text,
  product_created_at timestamptz NOT NULL,
  support_email text,
  display_name text,
  delivery_type text,
  affiliate_enabled boolean,
  affiliate_commission numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_product_catalog TO anon, authenticated;
GRANT ALL ON public.public_product_catalog TO service_role;
ALTER TABLE public.public_product_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_product_catalog_read ON public.public_product_catalog FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_product_catalog_row(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_product_catalog (
    id, name, description, price, status, image_url, checkout_url,
    checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
    checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
    checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
    checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
    checkout_theme, product_created_at, support_email, display_name, delivery_type,
    affiliate_enabled, affiliate_commission, updated_at
  )
  SELECT p.id, p.name, p.description, p.price, p.status, p.image_url, p.checkout_url,
         COALESCE(p.checkout_pix_enabled, false) AND COALESCE(pr.pix_enabled, false),
         COALESCE(p.checkout_boleto_enabled, false) AND COALESCE(pr.boleto_enabled, false),
         COALESCE(p.checkout_credit_card_enabled, false) AND COALESCE(pr.credit_card_enabled, false),
         p.checkout_timer_enabled, p.checkout_timer_minutes, p.checkout_social_proof,
         p.checkout_guarantee_enabled, p.checkout_address_required, p.checkout_email_confirm,
         p.checkout_button_color, p.checkout_banner_desktop_url, p.checkout_banner_mobile_url,
         p.checkout_theme, p.created_at, p.support_email, p.display_name, p.delivery_type,
         p.affiliate_enabled, p.affiliate_commission, now()
  FROM public.products p
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = _product_id AND p.status = 'active' AND p.deleted_at IS NULL
  ON CONFLICT (id) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description, price=EXCLUDED.price,
    status=EXCLUDED.status, image_url=EXCLUDED.image_url, checkout_url=EXCLUDED.checkout_url,
    checkout_pix_enabled=EXCLUDED.checkout_pix_enabled,
    checkout_boleto_enabled=EXCLUDED.checkout_boleto_enabled,
    checkout_credit_card_enabled=EXCLUDED.checkout_credit_card_enabled,
    checkout_timer_enabled=EXCLUDED.checkout_timer_enabled,
    checkout_timer_minutes=EXCLUDED.checkout_timer_minutes,
    checkout_social_proof=EXCLUDED.checkout_social_proof,
    checkout_guarantee_enabled=EXCLUDED.checkout_guarantee_enabled,
    checkout_address_required=EXCLUDED.checkout_address_required,
    checkout_email_confirm=EXCLUDED.checkout_email_confirm,
    checkout_button_color=EXCLUDED.checkout_button_color,
    checkout_banner_desktop_url=EXCLUDED.checkout_banner_desktop_url,
    checkout_banner_mobile_url=EXCLUDED.checkout_banner_mobile_url,
    checkout_theme=EXCLUDED.checkout_theme, product_created_at=EXCLUDED.product_created_at,
    support_email=EXCLUDED.support_email, display_name=EXCLUDED.display_name,
    delivery_type=EXCLUDED.delivery_type, affiliate_enabled=EXCLUDED.affiliate_enabled,
    affiliate_commission=EXCLUDED.affiliate_commission, updated_at=now();

  IF NOT FOUND THEN
    DELETE FROM public.public_product_catalog WHERE id = _product_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_public_product_catalog_row(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_public_product_catalog_row(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_public_product_catalog_from_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.sync_public_product_catalog_row(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_public_product_catalog_from_product() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_public_product_catalog_from_product() TO service_role;
CREATE TRIGGER sync_public_product_catalog_product
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_public_product_catalog_from_product();

CREATE OR REPLACE FUNCTION public.sync_public_product_catalog_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid;
BEGIN
  IF OLD.pix_enabled IS DISTINCT FROM NEW.pix_enabled
     OR OLD.credit_card_enabled IS DISTINCT FROM NEW.credit_card_enabled
     OR OLD.boleto_enabled IS DISTINCT FROM NEW.boleto_enabled THEN
    FOR _id IN SELECT id FROM public.products WHERE user_id = NEW.user_id LOOP
      PERFORM public.sync_public_product_catalog_row(_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_public_product_catalog_from_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_public_product_catalog_from_profile() TO service_role;
CREATE TRIGGER sync_public_product_catalog_profile
AFTER UPDATE OF pix_enabled, credit_card_enabled, boleto_enabled ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_product_catalog_from_profile();

SELECT public.sync_public_product_catalog_row(id) FROM public.products;

DROP FUNCTION public.get_public_products(text, uuid[]);
CREATE OR REPLACE FUNCTION public.get_public_products(_slug text DEFAULT NULL, _ids uuid[] DEFAULT NULL)
RETURNS SETOF public.public_product_catalog
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT c.* FROM public.public_product_catalog c
  WHERE
    CASE
      WHEN _slug IS NOT NULL THEN _slug ~ '^[A-Za-z0-9_-]+$' AND (
        c.checkout_url = trim(_slug) OR c.checkout_url = '/' || trim(_slug)
        OR c.checkout_url LIKE '%/pay/' || trim(_slug)
        OR c.checkout_url LIKE '%/checkout/' || trim(_slug)
      )
      WHEN _ids IS NOT NULL AND cardinality(_ids) BETWEEN 1 AND 20 THEN c.id = ANY(_ids)
      ELSE false
    END
  ORDER BY c.product_created_at DESC
  LIMIT CASE WHEN _slug IS NOT NULL THEN 1 ELSE 20 END;
$$;
REVOKE ALL ON FUNCTION public.get_public_products(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_products(text, uuid[]) TO anon, authenticated, service_role;