
DROP VIEW IF EXISTS public.acquirers_public;

CREATE OR REPLACE FUNCTION public.list_visible_acquirers()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  type text,
  description text,
  conversion_rate numeric,
  is_active boolean,
  seller_visible boolean,
  priority integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, type, description, conversion_rate, is_active, seller_visible, priority
  FROM public.acquirers
  WHERE is_active = true AND seller_visible = true
  ORDER BY conversion_rate DESC;
$$;

REVOKE ALL ON FUNCTION public.list_visible_acquirers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_acquirers() TO authenticated;
