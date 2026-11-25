-- Admin › Top Produtos
--  • ANTES: a aba somava, no navegador, as 5000 transações mais recentes (e só os produtos já carregados). Com volume, o
--    ranking e os totais saíam errados em silêncio, e "Hoje/7/30 dias" usavam o fuso do navegador.
--  • AGORA: ranking calculado no servidor, no mesmo período do topo do painel (dias de São Paulo), com busca, ordenação e
--    paginação. Os grupos de status são os mesmos da aba Transações (venda paga = approved/paid/completed), então os totais
--    batem com o resto do painel. Vendas simuladas ficam fora.

CREATE OR REPLACE FUNCTION app_private.get_admin_top_products(
  _from date, _to date, _search text DEFAULT NULL, _sort text DEFAULT 'gross', _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from timestamptz; v_to timestamptz;
  v_q    text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat  text;
  v_sort text := COALESCE(NULLIF(btrim(COALESCE(_sort, '')), ''), 'gross');
  v_ps   int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_page int  := GREATEST(COALESCE(_page, 1), 1);
  v_out  jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 366 THEN RAISE EXCEPTION 'período inválido'; END IF;
  IF v_sort NOT IN ('gross', 'sales', 'risk') THEN RAISE EXCEPTION 'ordenação inválida'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  v_from := _from::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_to   := (_to + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  WITH tx AS MATERIALIZED (
    SELECT t.product_id, t.amount, t.net_amount, t.fee_amount, t.customer_email, COALESCE(t.refunded_amount, 0) AS refunded_amount,
           CASE
             WHEN t.status IN ('approved', 'paid', 'completed') THEN 'paid'
             WHEN t.status IN ('chargeback', 'chargedback', 'charged_back') THEN 'chargeback'
             WHEN t.status IN ('refunded', 'partially_refunded') THEN 'refunded'
             ELSE 'other' END AS grp
      FROM public.transactions t
     WHERE t.product_id IS NOT NULL AND NOT COALESCE(t.is_simulated, false)
       AND t.created_at >= v_from AND t.created_at < v_to
  ),
  agg AS (
    SELECT product_id,
           count(*) AS attempts,
           count(*) FILTER (WHERE grp = 'paid') AS sales,
           COALESCE(sum(amount) FILTER (WHERE grp = 'paid'), 0) AS gross,
           COALESCE(sum(net_amount) FILTER (WHERE grp = 'paid'), 0) AS net,
           COALESCE(sum(fee_amount) FILTER (WHERE grp = 'paid'), 0) AS fees,
           count(DISTINCT lower(btrim(customer_email))) FILTER (WHERE grp = 'paid' AND COALESCE(btrim(customer_email), '') <> '') AS buyers,
           count(*) FILTER (WHERE grp = 'refunded') AS refunds,
           COALESCE(sum(CASE WHEN refunded_amount > 0 THEN refunded_amount ELSE amount END) FILTER (WHERE grp = 'refunded'), 0) AS refunded,
           count(*) FILTER (WHERE grp = 'chargeback') AS chargebacks,
           COALESCE(sum(amount) FILTER (WHERE grp = 'chargeback'), 0) AS chargeback_amount
      FROM tx GROUP BY product_id
  ),
  totals AS (
    SELECT COALESCE(sum(gross), 0) AS gross, COALESCE(sum(sales), 0) AS sales, COALESCE(sum(net), 0) AS net, COALESCE(sum(fees), 0) AS fees,
           count(*) FILTER (WHERE sales > 0) AS selling, count(*) FILTER (WHERE sales = 0) AS without_sales,
           COALESCE(sum(refunds), 0) AS refunds, COALESCE(sum(refunded), 0) AS refunded,
           COALESCE(sum(chargebacks), 0) AS chargebacks, COALESCE(sum(chargeback_amount), 0) AS chargeback_amount
      FROM agg
  ),
  ranked AS (
    SELECT a.*, p.name, p.image_url, p.price, p.status AS product_status, p.deleted_at, p.classification, p.user_id AS seller_user_id,
           pr.full_name AS seller_name, pr.email AS seller_email
      FROM agg a
      JOIN public.products p ON p.id = a.product_id
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
     WHERE a.sales > 0
       AND (v_q IS NULL OR p.name ILIKE v_pat OR pr.full_name ILIKE v_pat OR pr.email ILIKE v_pat OR p.id::text ILIKE v_pat)
  ),
  numbered AS (
    SELECT r.*, row_number() OVER (
             ORDER BY CASE v_sort WHEN 'gross' THEN r.gross WHEN 'sales' THEN r.sales::numeric ELSE (r.refunds + r.chargebacks)::numeric END DESC,
                      r.gross DESC, r.sales DESC, r.product_id) AS rn,
           count(*) OVER () AS total_rows
      FROM ranked r
  ),
  paged AS (SELECT * FROM numbered WHERE rn > (v_page - 1) * v_ps AND rn <= v_page * v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'product_id', p.product_id, 'name', p.name, 'image_url', p.image_url, 'price', p.price,
        'product_status', p.product_status, 'deleted', p.deleted_at IS NOT NULL, 'classification', COALESCE(p.classification, 'white'),
        'seller_user_id', p.seller_user_id, 'seller_name', p.seller_name, 'seller_email', p.seller_email,
        'rank', p.rn, 'attempts', p.attempts, 'sales', p.sales, 'gross', p.gross, 'net', p.net, 'fees', p.fees, 'buyers', p.buyers,
        'refunds', p.refunds, 'refunded', p.refunded, 'chargebacks', p.chargebacks, 'chargeback_amount', p.chargeback_amount
      ) ORDER BY p.rn) FROM paged p), '[]'::jsonb),
    'total', COALESCE((SELECT max(total_rows) FROM numbered), 0),
    'page', v_page, 'page_size', v_ps,
    'summary', (SELECT jsonb_build_object('gross', gross, 'sales', sales, 'net', net, 'fees', fees, 'selling', selling,
                  'without_sales', without_sales, 'refunds', refunds, 'refunded', refunded,
                  'chargebacks', chargebacks, 'chargeback_amount', chargeback_amount) FROM totals),
    'from', _from, 'to', _to, 'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_top_products(
  _from date, _to date, _search text DEFAULT NULL, _sort text DEFAULT 'gross', _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_top_products(_from, _to, _search, _sort, _page, _page_size); $$;

REVOKE ALL ON FUNCTION app_private.get_admin_top_products(date, date, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_top_products(date, date, text, text, integer, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_admin_top_products(date, date, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_top_products(date, date, text, text, integer, integer) TO authenticated, service_role;
