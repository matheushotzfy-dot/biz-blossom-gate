-- Admin > Links de Pagamento: grupos de situação que batem com as contagens e resumo do período inteiro.
--
-- Antes: "Ativos" excluía links em revisão (que continuam funcionando), "Pausados" misturava arquivados,
-- não havia filtro de revisão e o total só existia para o filtro atual. Agora a função devolve, junto da página,
-- um resumo com a contagem de cada grupo (respeitando só a busca), e os grupos são:
--   active   = aberto, não bloqueado, não arquivado (inclui "em revisão")
--   paused   = pausado pelo vendedor, não bloqueado, não arquivado
--   blocked  = bloqueado pela equipe (mesmo que o vendedor tenha arquivado)
--   review   = marcado para revisão pela equipe
--   archived = arquivado pelo vendedor
-- A busca passa a tratar % e _ como texto comum.
CREATE OR REPLACE FUNCTION app_private.get_admin_payment_links_page(
  _search text DEFAULT NULL::text,
  _status text DEFAULT 'all'::text,
  _billing_type text DEFAULT 'all'::text,
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
    SELECT p.*, pr.full_name AS seller_name, pr.email AS seller_email
    FROM public.payment_links p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE (v_like IS NULL OR p.title ILIKE v_like OR p.slug ILIKE v_like OR COALESCE(pr.full_name, '') ILIKE v_like OR COALESCE(pr.email, '') ILIKE v_like)
      AND (_billing_type IS NULL OR _billing_type = 'all' OR p.billing_type = _billing_type)
  ), filtered AS (
    SELECT * FROM base b
    WHERE _status IS NULL OR _status = 'all'
       OR (_status = 'blocked'  AND b.admin_status = 'blocked')
       OR (_status = 'review'   AND b.admin_status = 'review')
       OR (_status = 'archived' AND b.archived_at IS NOT NULL)
       OR (_status = 'active'   AND b.is_active AND b.archived_at IS NULL AND b.admin_status <> 'blocked')
       OR (_status = 'paused'   AND NOT b.is_active AND b.archived_at IS NULL AND b.admin_status <> 'blocked')
  ), paged AS (
    SELECT f.*,
      (SELECT count(*) FROM public.transactions t WHERE t.payment_link_id = f.id AND t.status = 'pending') AS pending_count,
      (SELECT COALESCE(sum(t.net_amount), 0) FROM public.transactions t WHERE t.payment_link_id = f.id AND t.status IN ('approved', 'completed', 'paid')) AS net_revenue,
      (SELECT max(t.created_at) FROM public.transactions t WHERE t.payment_link_id = f.id) AS last_payment_at
    FROM filtered f
    ORDER BY f.created_at DESC, f.id
    LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY paged.created_at DESC, paged.id) FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'summary', jsonb_build_object(
      'total',    (SELECT count(*) FROM base),
      'active',   (SELECT count(*) FROM base b WHERE b.is_active AND b.archived_at IS NULL AND b.admin_status <> 'blocked'),
      'paused',   (SELECT count(*) FROM base b WHERE NOT b.is_active AND b.archived_at IS NULL AND b.admin_status <> 'blocked'),
      'blocked',  (SELECT count(*) FROM base b WHERE b.admin_status = 'blocked'),
      'review',   (SELECT count(*) FROM base b WHERE b.admin_status = 'review'),
      'archived', (SELECT count(*) FROM base b WHERE b.archived_at IS NOT NULL),
      'net_revenue', (SELECT COALESCE(sum(t.net_amount), 0) FROM public.transactions t WHERE t.payment_link_id IN (SELECT id FROM base) AND t.status IN ('approved', 'completed', 'paid'))
    )
  ) INTO result;
  RETURN result;
END;
$function$;
