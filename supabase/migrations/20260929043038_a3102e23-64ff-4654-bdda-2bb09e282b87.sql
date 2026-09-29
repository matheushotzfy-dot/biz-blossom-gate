DROP VIEW public.products_public;
DROP FUNCTION public.get_public_products(text, uuid[]);
ALTER TABLE public.public_product_catalog DROP COLUMN support_email;

CREATE OR REPLACE FUNCTION public.sync_public_product_catalog_row(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.public_product_catalog (
    id, name, description, price, status, image_url, checkout_url,
    checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled,
    checkout_timer_enabled, checkout_timer_minutes, checkout_social_proof,
    checkout_guarantee_enabled, checkout_address_required, checkout_email_confirm,
    checkout_button_color, checkout_banner_desktop_url, checkout_banner_mobile_url,
    checkout_theme, product_created_at, display_name, delivery_type,
    affiliate_enabled, affiliate_commission, updated_at
  )
  SELECT p.id, p.name, p.description, p.price, p.status, p.image_url, p.checkout_url,
         COALESCE(p.checkout_pix_enabled, false) AND COALESCE(pr.pix_enabled, false),
         COALESCE(p.checkout_boleto_enabled, false) AND COALESCE(pr.boleto_enabled, false),
         COALESCE(p.checkout_credit_card_enabled, false) AND COALESCE(pr.credit_card_enabled, false),
         p.checkout_timer_enabled, p.checkout_timer_minutes, p.checkout_social_proof,
         p.checkout_guarantee_enabled, p.checkout_address_required, p.checkout_email_confirm,
         p.checkout_button_color, p.checkout_banner_desktop_url, p.checkout_banner_mobile_url,
         p.checkout_theme, p.created_at, p.display_name, p.delivery_type,
         p.affiliate_enabled, p.affiliate_commission, now()
  FROM public.products p JOIN public.profiles pr ON pr.user_id=p.user_id
  WHERE p.id=_product_id AND p.status='active' AND p.deleted_at IS NULL
  ON CONFLICT (id) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description, price=EXCLUDED.price,
    status=EXCLUDED.status, image_url=EXCLUDED.image_url, checkout_url=EXCLUDED.checkout_url,
    checkout_pix_enabled=EXCLUDED.checkout_pix_enabled, checkout_boleto_enabled=EXCLUDED.checkout_boleto_enabled,
    checkout_credit_card_enabled=EXCLUDED.checkout_credit_card_enabled,
    checkout_timer_enabled=EXCLUDED.checkout_timer_enabled, checkout_timer_minutes=EXCLUDED.checkout_timer_minutes,
    checkout_social_proof=EXCLUDED.checkout_social_proof, checkout_guarantee_enabled=EXCLUDED.checkout_guarantee_enabled,
    checkout_address_required=EXCLUDED.checkout_address_required, checkout_email_confirm=EXCLUDED.checkout_email_confirm,
    checkout_button_color=EXCLUDED.checkout_button_color, checkout_banner_desktop_url=EXCLUDED.checkout_banner_desktop_url,
    checkout_banner_mobile_url=EXCLUDED.checkout_banner_mobile_url, checkout_theme=EXCLUDED.checkout_theme,
    product_created_at=EXCLUDED.product_created_at, display_name=EXCLUDED.display_name,
    delivery_type=EXCLUDED.delivery_type, affiliate_enabled=EXCLUDED.affiliate_enabled,
    affiliate_commission=EXCLUDED.affiliate_commission, updated_at=now();
  IF NOT FOUND THEN DELETE FROM public.public_product_catalog WHERE id=_product_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.sync_public_product_catalog_row(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_public_product_catalog_row(uuid) TO service_role;

CREATE FUNCTION public.get_public_products(_slug text DEFAULT NULL, _ids uuid[] DEFAULT NULL)
RETURNS SETOF public.public_product_catalog LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT c.* FROM public.public_product_catalog c WHERE CASE
  WHEN _slug IS NOT NULL THEN _slug ~ '^[A-Za-z0-9_-]+$' AND (c.checkout_url=trim(_slug) OR c.checkout_url='/'||trim(_slug) OR c.checkout_url LIKE '%/pay/'||trim(_slug) OR c.checkout_url LIKE '%/checkout/'||trim(_slug))
  WHEN _ids IS NOT NULL AND cardinality(_ids) BETWEEN 1 AND 20 THEN c.id=ANY(_ids)
  ELSE false END
 ORDER BY c.product_created_at DESC LIMIT CASE WHEN _slug IS NOT NULL THEN 1 ELSE 20 END;
$$;
REVOKE ALL ON FUNCTION public.get_public_products(text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_products(text,uuid[]) TO anon,authenticated,service_role;

CREATE VIEW public.products_public WITH (security_invoker=true) AS SELECT
 id,name,description,price::numeric(10,2) AS price,status,image_url,checkout_url,
 checkout_pix_enabled,checkout_boleto_enabled,checkout_credit_card_enabled,
 checkout_timer_enabled,checkout_timer_minutes,checkout_social_proof,checkout_guarantee_enabled,
 checkout_address_required,checkout_email_confirm,checkout_button_color,checkout_banner_desktop_url,
 checkout_banner_mobile_url,checkout_theme,product_created_at AS created_at,display_name,
 delivery_type,affiliate_enabled,affiliate_commission FROM public.public_product_catalog;
GRANT SELECT ON public.products_public TO anon,authenticated,service_role;