CREATE OR REPLACE FUNCTION app_private.get_product_link_status(_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.status FROM public.products p
  WHERE _slug ~ '^[A-Za-z0-9_-]{1,64}$' AND p.deleted_at IS NULL
    AND (p.checkout_url LIKE '%/pay/' || _slug OR p.checkout_url LIKE '%/checkout/' || _slug OR p.checkout_url = _slug)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.get_product_link_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.get_product_link_status(text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_product_link_status(_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$ SELECT app_private.get_product_link_status(_slug) $$;
REVOKE ALL ON FUNCTION public.get_product_link_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_link_status(text) TO anon, authenticated;