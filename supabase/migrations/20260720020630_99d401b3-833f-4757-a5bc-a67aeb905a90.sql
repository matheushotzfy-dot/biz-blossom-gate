ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS cover_url text;

DROP FUNCTION IF EXISTS public.get_public_payment_link(text);

CREATE OR REPLACE FUNCTION public.get_public_payment_link(_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, description text, cover_url text, amount numeric,
  is_active boolean, accept_pix boolean, accept_card boolean,
  max_uses integer, current_uses integer, expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, slug, title, description, cover_url, amount, is_active, accept_pix, accept_card,
         max_uses, current_uses, expires_at
  FROM public.payment_links
  WHERE slug = _slug AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_link(text) TO anon, authenticated;