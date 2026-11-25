-- Pendente há mais de 24h (ou com o PIX vencido) conta como expirada, igual ao selo que a tela mostra na linha.
-- Transações do admin: os filtros de status passam a usar os mesmos grupos da contagem
-- (antes "Pendentes", "Recusadas" etc. filtravam por um único status e a lista não batia com o número do botão),
-- o resumo (volume, taxas, contagens) vem do banco sobre TODO o período filtrado, e a paginação ganha desempate por id.
CREATE OR REPLACE FUNCTION public.get_admin_transactions_page(
  _from timestamp with time zone, _to timestamp with time zone,
  _page integer DEFAULT 1, _page_size integer DEFAULT 80,
  _status text DEFAULT NULL::text, _method text DEFAULT NULL::text,
  _seller_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _safe_page integer := GREATEST(COALESCE(_page,1),1);
  _safe_size integer := LEAST(GREATEST(COALESCE(_page_size,80),1),200);
  _offset integer;
  _items jsonb; _total bigint; _summary jsonb;
  _st text := NULLIF(btrim(COALESCE(_status,'')),'');
  _q text := NULLIF(btrim(COALESCE(_search,'')),'');
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid,'admin'::app_role) OR public.has_role(_uid,'employee'::app_role)) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  _offset := (_safe_page-1)*_safe_size;
  IF _st = 'all' THEN _st := NULL; END IF;

  -- resumo: respeita período, método, seller e busca, mas NÃO o status (os botões de status mostram a contagem de cada um)
  WITH g AS (
    SELECT t.*, CASE
      WHEN t.status IN ('approved','paid','completed') THEN 'completed'
      WHEN t.status IN ('chargeback','chargedback','charged_back') THEN 'chargeback'
      WHEN t.status IN ('refunded','partially_refunded') THEN 'refunded'
      WHEN t.status IN ('failed','expired','rejected','refused','error','cancelled','canceled')
        OR (t.status IN ('pending','processing','waiting_payment','authorized') AND (t.created_at <= now() - interval '24 hours' OR (t.pix_expires_at IS NOT NULL AND t.pix_expires_at < now()))) THEN 'failed'
      WHEN t.status IN ('pending','processing','waiting_payment','authorized') THEN 'pending'
      ELSE 'other' END AS grp
    FROM public.transactions t LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE t.is_simulated = false AND t.created_at >= _from AND t.created_at <= _to
      AND (_method IS NULL OR _method IN ('','all') OR t.payment_method = _method)
      AND (_seller_id IS NULL OR t.user_id = _seller_id)
      AND (_q IS NULL OR t.id::text ILIKE '%'||_q||'%' OR COALESCE(t.external_id,'') ILIKE '%'||_q||'%'
           OR COALESCE(t.customer_name,'') ILIKE '%'||_q||'%' OR COALESCE(t.customer_email,'') ILIKE '%'||_q||'%'
           OR COALESCE(t.customer_document,'') ILIKE '%'||_q||'%' OR COALESCE(p.full_name,'') ILIKE '%'||_q||'%'
           OR COALESCE(p.email,'') ILIKE '%'||_q||'%')
  )
  SELECT
    jsonb_build_object(
      'total', count(*),
      'gross', COALESCE(sum(amount) FILTER (WHERE grp='completed'),0),
      'net', COALESCE(sum(net_amount) FILTER (WHERE grp='completed'),0),
      'fees', COALESCE(sum(fee_amount) FILTER (WHERE grp='completed'),0),
      'approved', count(*) FILTER (WHERE grp='completed'),
      'pending', count(*) FILTER (WHERE grp='pending'),
      'failed', count(*) FILTER (WHERE grp='failed'),
      'refunded', count(*) FILTER (WHERE grp='refunded'),
      'chargeback', count(*) FILTER (WHERE grp='chargeback'),
      'chargeback_amount', COALESCE(sum(amount) FILTER (WHERE grp='chargeback'),0),
      'refunded_amount', COALESCE(sum(COALESCE(refunded_amount,0)),0)),
    count(*) FILTER (WHERE _st IS NULL OR grp = _st OR (_st NOT IN ('completed','pending','failed','refunded','chargeback') AND status = _st))
  INTO _summary, _total FROM g;

  WITH g AS (
    SELECT t.*, CASE
      WHEN t.status IN ('approved','paid','completed') THEN 'completed'
      WHEN t.status IN ('chargeback','chargedback','charged_back') THEN 'chargeback'
      WHEN t.status IN ('refunded','partially_refunded') THEN 'refunded'
      WHEN t.status IN ('failed','expired','rejected','refused','error','cancelled','canceled')
        OR (t.status IN ('pending','processing','waiting_payment','authorized') AND (t.created_at <= now() - interval '24 hours' OR (t.pix_expires_at IS NOT NULL AND t.pix_expires_at < now()))) THEN 'failed'
      WHEN t.status IN ('pending','processing','waiting_payment','authorized') THEN 'pending'
      ELSE 'other' END AS grp
    FROM public.transactions t LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE t.is_simulated = false AND t.created_at >= _from AND t.created_at <= _to
      AND (_method IS NULL OR _method IN ('','all') OR t.payment_method = _method)
      AND (_seller_id IS NULL OR t.user_id = _seller_id)
      AND (_q IS NULL OR t.id::text ILIKE '%'||_q||'%' OR COALESCE(t.external_id,'') ILIKE '%'||_q||'%'
           OR COALESCE(t.customer_name,'') ILIKE '%'||_q||'%' OR COALESCE(t.customer_email,'') ILIKE '%'||_q||'%'
           OR COALESCE(t.customer_document,'') ILIKE '%'||_q||'%' OR COALESCE(p.full_name,'') ILIKE '%'||_q||'%'
           OR COALESCE(p.email,'') ILIKE '%'||_q||'%')
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(x) - 'grp' ORDER BY x.created_at DESC, x.id DESC), '[]'::jsonb) INTO _items FROM (
    SELECT * FROM g
    WHERE _st IS NULL OR grp = _st OR (_st NOT IN ('completed','pending','failed','refunded','chargeback') AND status = _st)
    ORDER BY created_at DESC, id DESC LIMIT _safe_size OFFSET _offset
  ) x;

  RETURN jsonb_build_object('items', _items, 'total', _total, 'page', _safe_page, 'page_size', _safe_size, 'summary', _summary, 'totals', _summary);
END;
$function$;
