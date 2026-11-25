-- Admin › Produtos (curadoria)
--  • ANTES: o admin não conseguia alterar produto de outro seller. A única policy de UPDATE em `products` é a do dono,
--    então Aprovar / Em revisão / Desativar / Classificar / Excluir mostravam "sucesso" e não mudavam nada (o update
--    afetava 0 linhas, sem erro). Agora tudo passa por função de servidor (admin + senha recente + auditoria).
--  • lista paginada no servidor (situação, classificação, busca) com números por produto e resumo que fecha com a lista;
--  • raio-X por produto em uma chamada (seller, financeiro, métodos, vendas recentes, bumps, disputas, afiliados, histórico);
--  • restaurar produto apagado (antes o "histórico" não tinha volta);
--  • remove o gatilho duplicado de log (cada alteração gravava duas linhas em activity_logs).

-- gatilhos registrados duas vezes (mesma função, dois nomes): o log gravava cada alteração em dobro e o preço era validado duas vezes
DROP TRIGGER IF EXISTS log_product_changes_trigger ON public.products;
DROP TRIGGER IF EXISTS validate_product_price_trigger ON public.products;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;

-- ───────────────────────── lista ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_products_page(
  _status text DEFAULT NULL, _class text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text := COALESCE(NULLIF(btrim(COALESCE(_status, '')), ''), 'live');
  v_class  text := NULLIF(btrim(COALESCE(_class, '')), '');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_ps     int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_out    jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_status NOT IN ('live', 'active', 'pending_review', 'draft', 'inactive', 'deleted') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_class = 'all' THEN v_class := NULL; END IF;
  IF v_class IS NOT NULL AND v_class NOT IN ('white', 'gray', 'black') THEN RAISE EXCEPTION 'classificação inválida'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT p.*, pr.full_name AS seller_name, pr.email AS seller_email
      FROM public.products p
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
     WHERE v_q IS NULL OR p.name ILIKE v_pat OR pr.full_name ILIKE v_pat OR pr.email ILIKE v_pat OR p.id::text ILIKE v_pat
  ),
  -- in_class: respeita a classificação escolhida, mostra todas as situações (alimenta os números das abas de situação)
  in_class AS (SELECT * FROM base WHERE v_class IS NULL OR classification = v_class),
  -- in_status: respeita a situação escolhida, mostra todas as classificações (alimenta os números do filtro de classificação)
  in_status AS (
    SELECT * FROM base
     WHERE (v_status = 'live' AND deleted_at IS NULL)
        OR (v_status = 'deleted' AND deleted_at IS NOT NULL)
        OR (v_status NOT IN ('live', 'deleted') AND deleted_at IS NULL AND status = v_status)
  ),
  filt AS (SELECT * FROM in_status WHERE v_class IS NULL OR classification = v_class),
  paged AS (
    SELECT f.*, row_number() OVER (ORDER BY (f.status = 'pending_review' AND f.deleted_at IS NULL) DESC,
                      CASE WHEN f.status = 'pending_review' AND f.deleted_at IS NULL THEN f.created_at END ASC NULLS LAST, f.created_at DESC, f.id) AS rn
      FROM filt f
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'description', left(COALESCE(x.description, ''), 240), 'price', x.price, 'status', x.status,
        'classification', x.classification, 'rejection_reason', x.rejection_reason, 'image_url', x.image_url, 'checkout_url', x.checkout_url,
        'created_at', x.created_at, 'updated_at', x.updated_at, 'deleted_at', x.deleted_at,
        'seller_user_id', x.user_id, 'seller_name', x.seller_name, 'seller_email', x.seller_email,
        'attempts', COALESCE(s.attempts, 0), 'sales', COALESCE(s.sales, 0), 'gross', COALESCE(s.gross, 0),
        'refunds', COALESCE(s.refunds, 0), 'refunded', COALESCE(s.refunded, 0), 'chargebacks', COALESCE(s.chargebacks, 0)
      ) ORDER BY x.rn)
      FROM paged x
      LEFT JOIN LATERAL (
        SELECT count(*) AS attempts,
               count(*) FILTER (WHERE t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')) AS sales,
               COALESCE(sum(t.amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')), 0) AS gross,
               count(*) FILTER (WHERE COALESCE(t.refunded_amount, 0) > 0) AS refunds,
               COALESCE(sum(t.refunded_amount), 0) AS refunded,
               count(*) FILTER (WHERE t.status = 'chargeback') AS chargebacks
          FROM public.transactions t
         WHERE t.product_id = x.id AND NOT COALESCE(t.is_simulated, false)
      ) s ON true
      WHERE x.rn > v_off AND x.rn <= v_off + v_ps
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', jsonb_build_object(
      'live', (SELECT count(*) FROM in_class WHERE deleted_at IS NULL),
      'pending_review', (SELECT count(*) FROM in_class WHERE deleted_at IS NULL AND status = 'pending_review'),
      'active', (SELECT count(*) FROM in_class WHERE deleted_at IS NULL AND status = 'active'),
      'draft', (SELECT count(*) FROM in_class WHERE deleted_at IS NULL AND status = 'draft'),
      'inactive', (SELECT count(*) FROM in_class WHERE deleted_at IS NULL AND status = 'inactive'),
      'deleted', (SELECT count(*) FROM in_class WHERE deleted_at IS NOT NULL)
    ),
    'class_counts', jsonb_build_object(
      'all', (SELECT count(*) FROM in_status),
      'white', (SELECT count(*) FROM in_status WHERE classification = 'white'),
      'gray', (SELECT count(*) FROM in_status WHERE classification = 'gray'),
      'black', (SELECT count(*) FROM in_status WHERE classification = 'black')
    ),
    'generated_at', now()
  ) INTO v_out;
  RETURN v_out;
END $function$;

-- ───────────────────────── raio-X ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_product_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p public.products%ROWTYPE;
  _pr public.profiles%ROWTYPE;
  _doc text;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO _p FROM public.products WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto não encontrado'; END IF;
  SELECT * INTO _pr FROM public.profiles WHERE user_id = _p.user_id;
  _doc := regexp_replace(COALESCE(_pr.document_number, ''), '\D', '', 'g');

  RETURN jsonb_build_object(
    'product', jsonb_build_object(
      'id', _p.id, 'name', _p.name, 'description', _p.description, 'price', _p.price, 'status', _p.status, 'classification', _p.classification,
      'rejection_reason', _p.rejection_reason, 'image_url', _p.image_url, 'checkout_url', _p.checkout_url, 'page_url', _p.page_url,
      'created_at', _p.created_at, 'updated_at', _p.updated_at, 'deleted_at', _p.deleted_at, 'delivery_type', _p.delivery_type,
      'pix', COALESCE(_p.checkout_pix_enabled, false), 'card', COALESCE(_p.checkout_credit_card_enabled, false), 'boleto', COALESCE(_p.checkout_boleto_enabled, false),
      'timer', CASE WHEN COALESCE(_p.checkout_timer_enabled, false) THEN _p.checkout_timer_minutes ELSE NULL END,
      'guarantee', COALESCE(_p.checkout_guarantee_enabled, false), 'address_required', COALESCE(_p.checkout_address_required, false),
      'affiliate_enabled', _p.affiliate_enabled, 'affiliate_commission', _p.affiliate_commission,
      'co_production_enabled', _p.co_production_enabled, 'upsell_enabled', _p.upsell_enabled, 'downsell_enabled', _p.downsell_enabled
    ),
    'seller', jsonb_build_object(
      'user_id', _p.user_id, 'name', _pr.full_name, 'email', _pr.email, 'phone', _pr.phone,
      'document_masked', CASE WHEN length(_doc) >= 4 THEN repeat('•', greatest(length(_doc) - 4, 0)) || right(_doc, 4) ELSE NULL END,
      'account_status', _pr.account_status,
      'products_total', (SELECT count(*) FROM public.products WHERE user_id = _p.user_id AND deleted_at IS NULL)
    ),
    'stats', (
      SELECT jsonb_build_object(
        'attempts', count(*),
        'sales', count(*) FILTER (WHERE t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')),
        'gross', COALESCE(sum(t.amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')), 0),
        'net', COALESCE(sum(t.net_amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')), 0),
        'fees', COALESCE(sum(t.fee_amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')), 0),
        'pending', count(*) FILTER (WHERE t.status IN ('pending', 'waiting_payment', 'processing')),
        'failed', count(*) FILTER (WHERE t.status IN ('failed', 'expired', 'cancelled', 'canceled', 'refused')),
        'refunds', count(*) FILTER (WHERE COALESCE(t.refunded_amount, 0) > 0),
        'refunded', COALESCE(sum(t.refunded_amount), 0),
        'chargebacks', count(*) FILTER (WHERE t.status = 'chargeback'),
        'chargeback_amount', COALESCE(sum(t.amount) FILTER (WHERE t.status = 'chargeback'), 0)
      )
      FROM public.transactions t WHERE t.product_id = _id AND NOT COALESCE(t.is_simulated, false)
    ),
    'methods', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('method', m.method, 'count', m.n, 'gross', m.g) ORDER BY m.g DESC)
      FROM (SELECT COALESCE(t.payment_method, 'outro') AS method, count(*) AS n, sum(t.amount) AS g
              FROM public.transactions t
             WHERE t.product_id = _id AND NOT COALESCE(t.is_simulated, false) AND t.status IN ('approved', 'paid', 'completed', 'partially_refunded', 'disputed')
             GROUP BY 1) m
    ), '[]'::jsonb),
    'recent_sales', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'amount', r.amount, 'status', r.status, 'payment_method', r.payment_method,
                                          'created_at', r.created_at, 'buyer', split_part(btrim(COALESCE(r.customer_name, '')), ' ', 1)) ORDER BY r.created_at DESC)
      FROM (SELECT t.* FROM public.transactions t WHERE t.product_id = _id AND NOT COALESCE(t.is_simulated, false) ORDER BY t.created_at DESC LIMIT 12) r
    ), '[]'::jsonb),
    'bumps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'name', bp.name, 'price', bp.price, 'is_active', b.is_active) ORDER BY b.sort_order, b.created_at)
      FROM public.order_bumps b LEFT JOIN public.products bp ON bp.id = b.bump_product_id WHERE b.product_id = _id
    ), '[]'::jsonb),
    'disputes', jsonb_build_object(
      'total', (SELECT count(*) FROM public.disputes d JOIN public.transactions t ON t.id = d.transaction_id WHERE t.product_id = _id),
      'open', (SELECT count(*) FROM public.disputes d JOIN public.transactions t ON t.id = d.transaction_id WHERE t.product_id = _id AND d.status IN ('open', 'in_review')),
      'amount', COALESCE((SELECT sum(d.amount) FROM public.disputes d JOIN public.transactions t ON t.id = d.transaction_id WHERE t.product_id = _id), 0),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', q.id, 'type', q.type, 'status', q.status, 'amount', q.amount, 'created_at', q.created_at) ORDER BY q.created_at DESC)
        FROM (SELECT d.* FROM public.disputes d JOIN public.transactions t ON t.id = d.transaction_id WHERE t.product_id = _id ORDER BY d.created_at DESC LIMIT 8) q
      ), '[]'::jsonb)
    ),
    'affiliate', jsonb_build_object(
      'sales', (SELECT count(*) FROM public.affiliate_sales WHERE product_id = _id),
      'commission', COALESCE((SELECT sum(commission_amount) FROM public.affiliate_sales WHERE product_id = _id), 0)
    ),
    'courses', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'is_published', c.is_published) ORDER BY c.created_at) FROM public.courses c WHERE c.product_id = _id), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', h.id, 'action', h.action, 'details', h.details, 'created_at', h.created_at,
                                          'admin_name', COALESCE(NULLIF(btrim(a.full_name), ''), a.email)) ORDER BY h.created_at DESC)
      FROM (SELECT * FROM public.audit_logs WHERE entity_type = 'product' AND entity_id = _id::text ORDER BY created_at DESC LIMIT 20) h
      LEFT JOIN public.profiles a ON a.user_id = h.admin_user_id
    ), '[]'::jsonb)
  );
END $function$;

-- ───────────────────────── ações ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_product_status(_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _p public.products%ROWTYPE;
  _r text := NULLIF(btrim(COALESCE(_reason, '')), '');
BEGIN
  IF _status IS NULL OR _status NOT IN ('active', 'pending_review', 'inactive') THEN RAISE EXCEPTION 'situação inválida'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto não encontrado'; END IF;
  IF _p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'produto apagado: restaure antes de mudar a situação'; END IF;
  IF _p.status = 'draft' THEN RAISE EXCEPTION 'rascunho: o seller ainda está montando o produto'; END IF;
  IF _p.status = _status THEN RAISE EXCEPTION 'o produto já está nessa situação'; END IF;
  IF _status IN ('pending_review', 'inactive') AND (_r IS NULL OR length(_r) < 5) THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  _r := left(regexp_replace(COALESCE(_r, ''), '[<>]', '', 'g'), 1000);

  -- o motivo vai junto no mesmo UPDATE: o gatilho notify_product_status_change avisa o seller com ele
  UPDATE public.products SET status = _status, rejection_reason = CASE WHEN _status = 'active' THEN NULL ELSE _r END WHERE id = _id;
  PERFORM app_private.admin_audit(_admin, 'product_' || _status, 'product', _id::text,
    jsonb_build_object('from', _p.status, 'to', _status, 'reason', CASE WHEN _status = 'active' THEN NULL ELSE _r END, 'seller', _p.user_id));
  RETURN jsonb_build_object('id', _id, 'status', _status);
END $function$;

CREATE OR REPLACE FUNCTION app_private.admin_set_product_classification(_id uuid, _class text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _p public.products%ROWTYPE;
BEGIN
  IF _class IS NULL OR _class NOT IN ('white', 'gray', 'black') THEN RAISE EXCEPTION 'classificação inválida'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto não encontrado'; END IF;
  IF _p.classification = _class THEN RAISE EXCEPTION 'o produto já tem essa classificação'; END IF;
  UPDATE public.products SET classification = _class WHERE id = _id;
  PERFORM app_private.admin_audit(_admin, 'product_classified', 'product', _id::text,
    jsonb_build_object('from', _p.classification, 'to', _class, 'note', left(btrim(COALESCE(_note, '')), 500), 'seller', _p.user_id));
  RETURN jsonb_build_object('id', _id, 'classification', _class);
END $function$;

CREATE OR REPLACE FUNCTION app_private.admin_delete_product(_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _p public.products%ROWTYPE;
  _r text := left(regexp_replace(btrim(COALESCE(_reason, '')), '[<>]', '', 'g'), 1000);
BEGIN
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto não encontrado'; END IF;
  IF _p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'o produto já está apagado'; END IF;
  -- mesmo efeito da exclusão feita pelo seller: some da vitrine e do checkout, o histórico de vendas fica
  UPDATE public.products SET deleted_at = now(), status = 'inactive', rejection_reason = _r WHERE id = _id;
  -- se já estava inativo o gatilho de status não dispara: avisa aqui
  IF _p.status = 'inactive' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_p.user_id, 'Produto removido', format('O seu produto "%s" foi removido pela equipe. Motivo: %s', _p.name, _r), 'product');
  END IF;
  PERFORM app_private.admin_audit(_admin, 'product_deleted', 'product', _id::text, jsonb_build_object('from', _p.status, 'reason', _r, 'seller', _p.user_id));
  RETURN jsonb_build_object('id', _id, 'deleted', true);
END $function$;

CREATE OR REPLACE FUNCTION app_private.admin_restore_product(_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _p public.products%ROWTYPE;
  _r text := left(regexp_replace(btrim(COALESCE(_reason, '')), '[<>]', '', 'g'), 1000);
BEGIN
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto não encontrado'; END IF;
  IF _p.deleted_at IS NULL THEN RAISE EXCEPTION 'o produto não está apagado'; END IF;
  -- volta inativo: quem decide reativar é o seller ou o admin, de propósito
  UPDATE public.products SET deleted_at = NULL, status = 'inactive', rejection_reason = NULL WHERE id = _id;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_p.user_id, 'Produto restaurado', format('O seu produto "%s" foi restaurado e está inativo. Reative quando quiser.', _p.name), 'product');
  PERFORM app_private.admin_audit(_admin, 'product_restored', 'product', _id::text, jsonb_build_object('reason', _r, 'seller', _p.user_id));
  RETURN jsonb_build_object('id', _id, 'deleted', false);
END $function$;

-- ───────────────────────── wrappers públicos (as ações que mexem na situação exigem senha recente) ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_products_page(_status text DEFAULT NULL, _class text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_products_page($1, $2, $3, $4, $5) $function$;

CREATE OR REPLACE FUNCTION public.get_admin_product_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_product_detail($1) $function$;

CREATE OR REPLACE FUNCTION public.admin_set_product_status(_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_product_status(_id, _status, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_product_classification(_id uuid, _class text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.admin_set_product_classification($1, $2, $3) $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_product(_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_delete_product(_id, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_restore_product(_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_restore_product(_id, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_products_page(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_product_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_product_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_product_classification(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_delete_product(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_restore_product(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_products_page(text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_product_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_set_product_status(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_set_product_classification(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_delete_product(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_restore_product(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_admin_products_page(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_product_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_product_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_product_classification(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_product(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_restore_product(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_products_page(text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_product_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_product_status(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_product_classification(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_product(uuid, text) TO authenticated, service_role;
