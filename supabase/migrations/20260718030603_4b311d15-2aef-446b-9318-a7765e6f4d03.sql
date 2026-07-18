
-- Fix 1: payment_links — restrict public exposure via safe view + RPC for clicks
DROP POLICY IF EXISTS public_reads_active_payment_link ON public.payment_links;

-- Ensure owners still see their own (keep existing owner policy; add if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_links' AND policyname='owner_reads_payment_links'
  ) THEN
    CREATE POLICY owner_reads_payment_links ON public.payment_links
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Safe view exposing only non-sensitive columns needed for public checkout
CREATE OR REPLACE VIEW public.payment_links_public
WITH (security_invoker = true) AS
SELECT id, slug, title, description, amount, is_active, accept_pix, accept_card,
       max_uses, current_uses, expires_at
FROM public.payment_links
WHERE is_active = true;

GRANT SELECT ON public.payment_links_public TO anon, authenticated;

-- Since the view is security_invoker, it needs a permissive policy for anon on the base table
-- restricted to only active rows via the view predicate; we instead expose via SECURITY DEFINER function:
DROP VIEW IF EXISTS public.payment_links_public;

CREATE OR REPLACE FUNCTION public.get_public_payment_link(_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, description text, amount numeric,
  is_active boolean, accept_pix boolean, accept_card boolean,
  max_uses integer, current_uses integer, expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, slug, title, description, amount, is_active, accept_pix, accept_card,
         max_uses, current_uses, expires_at
  FROM public.payment_links
  WHERE slug = _slug AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_link(text) TO anon, authenticated;

-- Click counter RPC (avoids exposing UPDATE on the base table)
CREATE OR REPLACE FUNCTION public.increment_payment_link_clicks(_slug text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.payment_links
    SET clicks = COALESCE(clicks, 0) + 1
    WHERE slug = _slug AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_payment_link_clicks(text) TO anon, authenticated;


-- Fix 2: revenue_race_overrides — restrict SELECT to admins only
DROP POLICY IF EXISTS race_overrides_read_authenticated ON public.revenue_race_overrides;

CREATE POLICY race_overrides_read_admin ON public.revenue_race_overrides
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
