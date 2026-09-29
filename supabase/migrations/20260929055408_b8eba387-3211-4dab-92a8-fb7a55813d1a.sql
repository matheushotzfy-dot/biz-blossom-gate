CREATE OR REPLACE FUNCTION app_private.get_my_payment_links_page(
  _search text DEFAULT NULL,
  _status text DEFAULT 'all',
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_page integer := GREATEST(COALESCE(_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(_page_size, 20), 1), 50);
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF COALESCE(_status, 'all') NOT IN ('all', 'active', 'paused', 'blocked', 'review', 'archived', 'expired') THEN
    RAISE EXCEPTION 'invalid status filter';
  END IF;

  WITH mine AS (
    SELECT p.*
    FROM public.payment_links p
    WHERE p.user_id = v_user_id
      AND (
        NULLIF(btrim(COALESCE(_search, '')), '') IS NULL
        OR p.title ILIKE '%' || btrim(_search) || '%'
        OR p.slug ILIKE '%' || btrim(_search) || '%'
      )
      AND (
        COALESCE(_status, 'all') = 'all'
        OR (_status = 'active' AND p.is_active AND p.archived_at IS NULL AND p.admin_status = 'clear' AND (p.expires_at IS NULL OR p.expires_at > now()) AND (p.max_uses IS NULL OR p.current_uses < p.max_uses))
        OR (_status = 'paused' AND NOT p.is_active AND p.archived_at IS NULL)
        OR (_status = 'blocked' AND p.admin_status = 'blocked' AND p.archived_at IS NULL)
        OR (_status = 'review' AND p.admin_status = 'review' AND p.archived_at IS NULL)
        OR (_status = 'archived' AND p.archived_at IS NOT NULL)
        OR (_status = 'expired' AND p.archived_at IS NULL AND (p.expires_at <= now() OR (p.max_uses IS NOT NULL AND p.current_uses >= p.max_uses)))
      )
  ), paged AS (
    SELECT *
    FROM mine
    ORDER BY created_at DESC
    LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
  ), totals AS (
    SELECT
      count(*)::integer AS total,
      COALESCE(sum(total_revenue), 0)::numeric AS revenue,
      COALESCE(sum(clicks), 0)::bigint AS clicks,
      COALESCE(sum(current_uses), 0)::bigint AS uses,
      count(*) FILTER (
        WHERE is_active AND archived_at IS NULL AND admin_status = 'clear'
          AND (expires_at IS NULL OR expires_at > now())
          AND (max_uses IS NULL OR current_uses < max_uses)
      )::integer AS active
    FROM public.payment_links
    WHERE user_id = v_user_id
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY created_at DESC) FROM paged), '[]'::jsonb),
    'filtered_total', (SELECT count(*) FROM mine),
    'total', totals.total,
    'revenue', totals.revenue,
    'clicks', totals.clicks,
    'uses', totals.uses,
    'active', totals.active
  )
  INTO v_result
  FROM totals;

  RETURN COALESCE(v_result, jsonb_build_object('items', '[]'::jsonb, 'filtered_total', 0, 'total', 0, 'revenue', 0, 'clicks', 0, 'uses', 0, 'active', 0));
END;
$$;

REVOKE ALL ON FUNCTION app_private.get_my_payment_links_page(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_my_payment_links_page(text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_payment_links_page(
  _search text DEFAULT NULL,
  _status text DEFAULT 'all',
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT app_private.get_my_payment_links_page(_search, _status, _page, _page_size);
$$;

REVOKE ALL ON FUNCTION public.get_my_payment_links_page(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payment_links_page(text, text, integer, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_payment_links_page(text, text, integer, integer) IS 'Returns the authenticated seller own payment links with server-side search, status filtering, pagination and aggregate counters.';