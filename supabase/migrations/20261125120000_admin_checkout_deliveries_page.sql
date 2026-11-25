-- Admin > Entregas do checkout: lista paginada com busca no banco inteiro e contagem por situação.
--
-- Antes a tela buscava 50 linhas e filtrava a busca só dentro delas, e as contagens eram as da página.
-- Agora uma função devolve a página (com nome do produto, do vendedor e dados da transação) e um resumo
-- com a contagem de cada situação para o que bate com a busca. Entregas com problema vêm primeiro.
CREATE OR REPLACE FUNCTION app_private.get_admin_checkout_deliveries_page(
  _search text DEFAULT NULL::text,
  _status text DEFAULT 'all'::text,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 50), 1), 100);
  v_page int := GREATEST(COALESCE(_page, 1), 1);
  v_like text := CASE WHEN NULLIF(trim(COALESCE(_search, '')), '') IS NULL THEN NULL
                      ELSE '%' || replace(replace(replace(trim(_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH base AS (
    SELECT d.id, d.transaction_id, d.product_id, d.seller_user_id, d.buyer_user_id, d.customer_email, d.status,
           d.attempt_count, d.last_error, d.delivered_at, d.last_attempt_at, d.created_at,
           pr.name AS product_name, sp.full_name AS seller_name, sp.email AS seller_email,
           t.amount AS tx_amount, t.status AS tx_status
    FROM public.checkout_delivery_attempts d
    LEFT JOIN public.products pr ON pr.id = d.product_id
    LEFT JOIN public.profiles sp ON sp.user_id = d.seller_user_id
    LEFT JOIN public.transactions t ON t.id = d.transaction_id
    WHERE v_like IS NULL
       OR d.customer_email ILIKE v_like
       OR d.transaction_id::text ILIKE v_like
       OR COALESCE(pr.name, '') ILIKE v_like
       OR COALESCE(sp.full_name, '') ILIKE v_like
       OR COALESCE(sp.email, '') ILIKE v_like
  ), filtered AS (
    SELECT * FROM base b WHERE _status IS NULL OR _status = 'all' OR b.status = _status
  ), paged AS (
    SELECT * FROM filtered f
    ORDER BY CASE f.status WHEN 'failed' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, f.created_at DESC, f.id
    LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY CASE paged.status WHEN 'failed' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, paged.created_at DESC, paged.id) FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'summary', jsonb_build_object(
      'total',     (SELECT count(*) FROM base),
      'pending',   (SELECT count(*) FROM base b WHERE b.status = 'pending'),
      'failed',    (SELECT count(*) FROM base b WHERE b.status = 'failed'),
      'delivered', (SELECT count(*) FROM base b WHERE b.status = 'delivered'),
      'revoked',   (SELECT count(*) FROM base b WHERE b.status = 'revoked'),
      'oldest_open', (SELECT min(b.created_at) FROM base b WHERE b.status IN ('pending', 'failed'))
    )
  ) INTO result;
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.get_admin_checkout_deliveries_page(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_checkout_deliveries_page(text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_checkout_deliveries_page(
  _search text DEFAULT NULL::text,
  _status text DEFAULT 'all'::text,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_checkout_deliveries_page($1, $2, $3, $4)$function$;

REVOKE ALL ON FUNCTION public.get_admin_checkout_deliveries_page(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_checkout_deliveries_page(text, text, integer, integer) TO authenticated, service_role;
