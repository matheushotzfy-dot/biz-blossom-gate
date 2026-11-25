-- Admin › Afiliados: leitura por RPC (lista por afiliado, lista por produto, raio-X) e pausa pela equipe.
--
-- A aba antiga lia as 2000 linhas mais recentes de affiliate_sales / affiliate_links direto no navegador, somava
-- tudo no cliente (com status "pending"/"rejected" que não existem: a venda de afiliado nasce "approved" e só vira
-- "refunded") e não tinha ação nenhuma. Aqui os números saem do banco, sem limite de linhas, e o admin consegue
-- pausar um afiliado (ou um link) que esteja abusando.

-- ───────────────────────── pausa pela equipe ─────────────────────────

ALTER TABLE public.affiliate_links
  ADD COLUMN IF NOT EXISTS admin_hold_reason text,
  ADD COLUMN IF NOT EXISTS admin_hold_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate ON public.affiliate_links (affiliate_user_id);

-- Quem não é admin não mexe na pausa, não reativa link pausado e não apaga link pausado (apagar tiraria a pausa).
-- O nome começa com "guard_" para rodar antes do trg_protect_affiliate_links_update.
CREATE OR REPLACE FUNCTION app_private.guard_affiliate_links_admin_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.admin_hold_at IS NOT NULL THEN
      RAISE EXCEPTION 'A equipe pausou este link e ele só sai com a liberação do suporte.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.admin_hold_reason := NULL; NEW.admin_hold_at := NULL;
    RETURN NEW;
  END IF;
  NEW.admin_hold_reason := OLD.admin_hold_reason;
  NEW.admin_hold_at := OLD.admin_hold_at;
  IF OLD.admin_hold_at IS NOT NULL AND COALESCE(NEW.is_active, false) THEN
    RAISE EXCEPTION 'A equipe pausou este link e ele só volta com a liberação do suporte.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_affiliate_links_admin_hold ON public.affiliate_links;
CREATE TRIGGER guard_affiliate_links_admin_hold BEFORE INSERT OR UPDATE OR DELETE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_affiliate_links_admin_hold();

-- Afiliado com link pausado pela equipe não cria link novo (senão a pausa seria só trocar de link).
CREATE OR REPLACE FUNCTION public.pin_affiliate_commission_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_owner uuid; v_enabled boolean; v_pct numeric;
begin
  select user_id, affiliate_enabled, affiliate_commission into v_owner, v_enabled, v_pct
    from public.products where id = new.product_id and status = 'active';
  if not found or not coalesce(v_enabled, false) then
    raise exception 'Este produto não aceita afiliados';
  end if;
  if v_owner = new.affiliate_user_id then
    raise exception 'Você não pode divulgar o seu próprio produto';
  end if;
  if exists (select 1 from public.affiliate_links where affiliate_user_id = new.affiliate_user_id and admin_hold_at is not null) then
    raise exception 'A equipe pausou os seus links de afiliado. Fale com o suporte para liberar.' using errcode = '42501';
  end if;
  new.owner_user_id := v_owner;
  new.commission_pct := coalesce(v_pct, 30);
  new.clicks := 0;
  return new;
end $function$;

-- ───────────────────────── lista por afiliado ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_affiliates_page(
  _filter text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_filter text := COALESCE(NULLIF(btrim(COALESCE(_filter, '')), ''), 'all');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_ps     int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_out    jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_filter NOT IN ('all', 'selling', 'idle', 'held') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH lk AS (
    SELECT affiliate_user_id AS uid,
           count(*) AS links,
           count(*) FILTER (WHERE is_active AND admin_hold_at IS NULL) AS links_active,
           count(*) FILTER (WHERE admin_hold_at IS NOT NULL) AS links_held,
           COALESCE(sum(clicks), 0) AS clicks,
           count(DISTINCT product_id) AS products,
           count(DISTINCT owner_user_id) AS sellers
      FROM public.affiliate_links GROUP BY 1
  ),
  sl AS (
    SELECT affiliate_user_id AS uid,
           count(*) FILTER (WHERE status = 'approved') AS sales,
           count(*) FILTER (WHERE status = 'refunded') AS refunded,
           COALESCE(sum(sale_amount) FILTER (WHERE status = 'approved'), 0) AS revenue,
           COALESCE(sum(commission_amount) FILTER (WHERE status = 'approved'), 0) AS commission,
           COALESCE(sum(commission_amount) FILTER (WHERE status = 'refunded'), 0) AS reversed,
           max(created_at) AS last_sale_at
      FROM public.affiliate_sales GROUP BY 1
  ),
  ids AS (SELECT uid FROM lk UNION SELECT uid FROM sl),
  base AS (
    SELECT i.uid, pr.full_name, pr.email, pr.account_status,
           COALESCE(lk.links, 0) AS links, COALESCE(lk.links_active, 0) AS links_active, COALESCE(lk.links_held, 0) AS links_held,
           COALESCE(lk.clicks, 0) AS clicks, COALESCE(lk.products, 0) AS products, COALESCE(lk.sellers, 0) AS sellers,
           COALESCE(sl.sales, 0) AS sales, COALESCE(sl.refunded, 0) AS refunded, COALESCE(sl.revenue, 0) AS revenue,
           COALESCE(sl.commission, 0) AS commission, COALESCE(sl.reversed, 0) AS reversed, sl.last_sale_at
      FROM ids i
      LEFT JOIN lk ON lk.uid = i.uid
      LEFT JOIN sl ON sl.uid = i.uid
      LEFT JOIN public.profiles pr ON pr.user_id = i.uid
     WHERE v_q IS NULL OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat OR i.uid::text ILIKE v_pat
        OR EXISTS (SELECT 1 FROM public.affiliate_links x WHERE x.affiliate_user_id = i.uid AND x.slug ILIKE v_pat)
  ),
  filt AS (
    SELECT * FROM base
     WHERE v_filter = 'all'
        OR (v_filter = 'selling' AND sales + refunded > 0)
        OR (v_filter = 'idle' AND sales + refunded = 0)
        OR (v_filter = 'held' AND links_held > 0)
  ),
  paged AS (
    SELECT f.*, row_number() OVER (ORDER BY f.commission DESC, f.sales DESC, f.clicks DESC, lower(COALESCE(f.full_name, f.email, '')), f.uid) AS rn FROM filt f
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'user_id', p.uid, 'name', COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email, 'Afiliado sem nome'), 'email', p.email, 'account_status', p.account_status,
        'links', p.links, 'links_active', p.links_active, 'links_held', p.links_held, 'clicks', p.clicks, 'products', p.products, 'sellers', p.sellers,
        'sales', p.sales, 'refunded', p.refunded, 'revenue', p.revenue, 'commission', p.commission, 'reversed', p.reversed, 'last_sale_at', p.last_sale_at,
        'hold_reason', (SELECT l.admin_hold_reason FROM public.affiliate_links l WHERE l.affiliate_user_id = p.uid AND l.admin_hold_at IS NOT NULL ORDER BY l.admin_hold_at DESC LIMIT 1)
      ) ORDER BY p.rn) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*),
        'selling', count(*) FILTER (WHERE sales + refunded > 0),
        'idle', count(*) FILTER (WHERE sales + refunded = 0),
        'held', count(*) FILTER (WHERE links_held > 0)
      ) FROM base),
    'program', jsonb_build_object(
        'affiliates', (SELECT count(*) FROM ids),
        'links', (SELECT count(*) FROM public.affiliate_links),
        'links_active', (SELECT count(*) FROM public.affiliate_links WHERE is_active AND admin_hold_at IS NULL),
        'links_held', (SELECT count(*) FROM public.affiliate_links WHERE admin_hold_at IS NOT NULL),
        'clicks', (SELECT COALESCE(sum(clicks), 0) FROM public.affiliate_links),
        'sales', (SELECT count(*) FROM public.affiliate_sales WHERE status = 'approved'),
        'refunded', (SELECT count(*) FROM public.affiliate_sales WHERE status = 'refunded'),
        'revenue', (SELECT COALESCE(sum(sale_amount), 0) FROM public.affiliate_sales WHERE status = 'approved'),
        'commission', (SELECT COALESCE(sum(commission_amount), 0) FROM public.affiliate_sales WHERE status = 'approved'),
        'reversed', (SELECT COALESCE(sum(commission_amount), 0) FROM public.affiliate_sales WHERE status = 'refunded')),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── lista por produto ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_affiliate_products_page(
  _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_q    text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat  text;
  v_ps   int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off  int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_out  jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH lk AS (
    SELECT product_id AS pid, count(*) AS links, count(*) FILTER (WHERE is_active AND admin_hold_at IS NULL) AS links_active,
           COALESCE(sum(clicks), 0) AS clicks, count(DISTINCT affiliate_user_id) AS affiliates
      FROM public.affiliate_links GROUP BY 1
  ),
  sl AS (
    SELECT product_id AS pid,
           count(*) FILTER (WHERE status = 'approved') AS sales, count(*) FILTER (WHERE status = 'refunded') AS refunded,
           COALESCE(sum(sale_amount) FILTER (WHERE status = 'approved'), 0) AS revenue,
           COALESCE(sum(commission_amount) FILTER (WHERE status = 'approved'), 0) AS commission
      FROM public.affiliate_sales GROUP BY 1
  ),
  ids AS (SELECT pid FROM lk UNION SELECT pid FROM sl),
  base AS (
    SELECT i.pid, p.name, p.price, p.status, (p.deleted_at IS NOT NULL) AS deleted, p.affiliate_enabled, p.affiliate_commission,
           p.user_id AS seller_id, pr.full_name AS seller_name, pr.email AS seller_email,
           COALESCE(lk.links, 0) AS links, COALESCE(lk.links_active, 0) AS links_active, COALESCE(lk.clicks, 0) AS clicks, COALESCE(lk.affiliates, 0) AS affiliates,
           COALESCE(sl.sales, 0) AS sales, COALESCE(sl.refunded, 0) AS refunded, COALESCE(sl.revenue, 0) AS revenue, COALESCE(sl.commission, 0) AS commission
      FROM ids i
      LEFT JOIN public.products p ON p.id = i.pid
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
      LEFT JOIN lk ON lk.pid = i.pid
      LEFT JOIN sl ON sl.pid = i.pid
     WHERE v_q IS NULL OR COALESCE(p.name, '') ILIKE v_pat OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat
  ),
  paged AS (
    SELECT b.*, row_number() OVER (ORDER BY b.commission DESC, b.sales DESC, b.clicks DESC, lower(COALESCE(b.name, '')), b.pid) AS rn FROM base b
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'product_id', p.pid, 'name', COALESCE(p.name, 'Produto sem nome'), 'price', p.price, 'status', p.status, 'deleted', COALESCE(p.deleted, true),
        'affiliate_enabled', COALESCE(p.affiliate_enabled, false), 'commission_pct', p.affiliate_commission,
        'seller_user_id', p.seller_id, 'seller_name', COALESCE(NULLIF(btrim(COALESCE(p.seller_name, '')), ''), p.seller_email, 'Seller sem nome'), 'seller_email', p.seller_email,
        'affiliates', p.affiliates, 'links', p.links, 'links_active', p.links_active, 'clicks', p.clicks,
        'sales', p.sales, 'refunded', p.refunded, 'revenue', p.revenue, 'commission', p.commission
      ) ORDER BY p.rn) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM base),
    'summary', jsonb_build_object(
        'open', (SELECT count(*) FROM public.products WHERE affiliate_enabled AND status = 'active' AND deleted_at IS NULL),
        'with_links', (SELECT count(*) FROM lk),
        'with_sales', (SELECT count(*) FROM sl WHERE sales + refunded > 0)),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── raio-X do afiliado ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_affiliate_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pr public.profiles%ROWTYPE;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO _pr FROM public.profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'afiliado não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliate_links WHERE affiliate_user_id = _user_id)
     AND NOT EXISTS (SELECT 1 FROM public.affiliate_sales WHERE affiliate_user_id = _user_id) THEN
    RAISE EXCEPTION 'afiliado não encontrado';
  END IF;

  RETURN jsonb_build_object(
    'affiliate', jsonb_build_object('user_id', _user_id, 'name', COALESCE(NULLIF(btrim(COALESCE(_pr.full_name, '')), ''), _pr.email, 'Afiliado sem nome'), 'email', _pr.email, 'account_status', _pr.account_status),
    'stats', jsonb_build_object(
      'links', (SELECT count(*) FROM public.affiliate_links WHERE affiliate_user_id = _user_id),
      'links_active', (SELECT count(*) FROM public.affiliate_links WHERE affiliate_user_id = _user_id AND is_active AND admin_hold_at IS NULL),
      'links_held', (SELECT count(*) FROM public.affiliate_links WHERE affiliate_user_id = _user_id AND admin_hold_at IS NOT NULL),
      'clicks', (SELECT COALESCE(sum(clicks), 0) FROM public.affiliate_links WHERE affiliate_user_id = _user_id),
      'sales', (SELECT count(*) FROM public.affiliate_sales WHERE affiliate_user_id = _user_id AND status = 'approved'),
      'refunded', (SELECT count(*) FROM public.affiliate_sales WHERE affiliate_user_id = _user_id AND status = 'refunded'),
      'revenue', (SELECT COALESCE(sum(sale_amount), 0) FROM public.affiliate_sales WHERE affiliate_user_id = _user_id AND status = 'approved'),
      'commission', (SELECT COALESCE(sum(commission_amount), 0) FROM public.affiliate_sales WHERE affiliate_user_id = _user_id AND status = 'approved'),
      'reversed', (SELECT COALESCE(sum(commission_amount), 0) FROM public.affiliate_sales WHERE affiliate_user_id = _user_id AND status = 'refunded')),
    'links', COALESCE((
      SELECT jsonb_agg(l ORDER BY l.created_at DESC) FROM (
        SELECT al.id, al.slug, al.clicks, al.commission_pct, al.is_active, al.paused_by_owner, al.created_at,
               al.admin_hold_reason AS hold_reason, al.admin_hold_at AS hold_at,
               al.product_id, p.name AS product_name, (p.deleted_at IS NOT NULL) AS product_deleted, p.status AS product_status,
               COALESCE(p.affiliate_enabled, false) AS product_open,
               al.owner_user_id AS seller_user_id, COALESCE(NULLIF(btrim(COALESCE(sp.full_name, '')), ''), sp.email, 'Seller sem nome') AS seller_name,
               (SELECT count(*) FROM public.affiliate_sales s WHERE s.affiliate_link_id = al.id AND s.status = 'approved') AS sales,
               (SELECT COALESCE(sum(s.commission_amount), 0) FROM public.affiliate_sales s WHERE s.affiliate_link_id = al.id AND s.status = 'approved') AS commission
          FROM public.affiliate_links al
          LEFT JOIN public.products p ON p.id = al.product_id
          LEFT JOIN public.profiles sp ON sp.user_id = al.owner_user_id
         WHERE al.affiliate_user_id = _user_id) l), '[]'::jsonb),
    'sales', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.created_at DESC) FROM (
        SELECT a.id, a.status, a.sale_amount, a.commission_pct, a.commission_amount, a.created_at,
               p.name AS product_name, COALESCE(NULLIF(btrim(COALESCE(sp.full_name, '')), ''), sp.email, 'Seller sem nome') AS seller_name
          FROM public.affiliate_sales a
          LEFT JOIN public.products p ON p.id = a.product_id
          LEFT JOIN public.profiles sp ON sp.user_id = a.seller_user_id
         WHERE a.affiliate_user_id = _user_id
         ORDER BY a.created_at DESC LIMIT 50) s), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT a.id, a.action, a.created_at, a.details, NULLIF(COALESCE(ap.full_name, ap.email), '') AS admin_name
          FROM public.audit_logs a LEFT JOIN public.profiles ap ON ap.user_id = a.admin_user_id
         WHERE a.entity_type = 'affiliate' AND a.entity_id = _user_id::text
         ORDER BY a.created_at DESC LIMIT 20) h), '[]'::jsonb)
  );
END
$function$;

-- ───────────────────────── pausar / liberar ─────────────────────────

-- _link_id nulo = todos os links do afiliado; com _link_id mexe só nesse link.
-- Pausar desliga o link na hora (checkout e cliques deixam de contá-lo) e o afiliado não cria link novo.
-- Liberar só apaga a retenção: o link continua desligado e quem decide religar é o dono do produto.
CREATE OR REPLACE FUNCTION app_private.admin_set_affiliate_hold(_affiliate_user_id uuid, _link_id uuid, _hold boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _n int;
  _prev text;
BEGIN
  IF _hold IS NULL OR _affiliate_user_id IS NULL THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliate_links WHERE affiliate_user_id = _affiliate_user_id) THEN RAISE EXCEPTION 'afiliado não encontrado'; END IF;
  IF _link_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.affiliate_links WHERE id = _link_id AND affiliate_user_id = _affiliate_user_id) THEN
    RAISE EXCEPTION 'link não encontrado';
  END IF;

  IF _hold THEN
    WITH u AS (
      UPDATE public.affiliate_links SET is_active = false, admin_hold_reason = _r, admin_hold_at = now()
       WHERE affiliate_user_id = _affiliate_user_id AND (_link_id IS NULL OR id = _link_id) AND admin_hold_at IS NULL
      RETURNING owner_user_id)
    SELECT count(*) INTO _n FROM u;
    IF _n = 0 THEN RAISE EXCEPTION 'não há link para pausar: já estão pausados pela equipe'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_affiliate_user_id, 'Links de afiliado pausados', format('A equipe pausou %s de afiliado. Motivo: %s', CASE WHEN _n = 1 THEN 'um link' ELSE _n || ' links' END, _r), 'affiliate');
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT DISTINCT o.owner_user_id, 'Link de afiliado pausado', 'A equipe pausou um link de afiliado de um dos seus produtos.', 'affiliate'
      FROM public.affiliate_links o
     WHERE o.affiliate_user_id = _affiliate_user_id AND (_link_id IS NULL OR o.id = _link_id) AND o.admin_hold_at IS NOT NULL AND o.admin_hold_reason = _r;
    PERFORM app_private.admin_audit(_admin, 'affiliate_hold', 'affiliate', _affiliate_user_id::text,
      jsonb_build_object('reason', _r, 'links', _n, 'link_id', _link_id));
  ELSE
    SELECT admin_hold_reason INTO _prev FROM public.affiliate_links
     WHERE affiliate_user_id = _affiliate_user_id AND (_link_id IS NULL OR id = _link_id) AND admin_hold_at IS NOT NULL
     ORDER BY admin_hold_at DESC LIMIT 1;
    WITH u AS (
      UPDATE public.affiliate_links SET admin_hold_reason = NULL, admin_hold_at = NULL
       WHERE affiliate_user_id = _affiliate_user_id AND (_link_id IS NULL OR id = _link_id) AND admin_hold_at IS NOT NULL
      RETURNING owner_user_id)
    SELECT count(*) INTO _n FROM u;
    IF _n = 0 THEN RAISE EXCEPTION 'não há link pausado pela equipe'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_affiliate_user_id, 'Links de afiliado liberados', format('A equipe liberou %s. O dono do produto decide quando reativar.', CASE WHEN _n = 1 THEN 'um link' ELSE _n || ' links' END), 'affiliate');
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT DISTINCT o.owner_user_id, 'Link de afiliado liberado', 'A equipe liberou um link de afiliado de um dos seus produtos. Reative quando quiser.', 'affiliate'
      FROM public.affiliate_links o
     WHERE o.affiliate_user_id = _affiliate_user_id AND (_link_id IS NULL OR o.id = _link_id);
    PERFORM app_private.admin_audit(_admin, 'affiliate_release', 'affiliate', _affiliate_user_id::text,
      jsonb_build_object('reason', _r, 'previous_reason', _prev, 'links', _n, 'link_id', _link_id));
  END IF;
  RETURN jsonb_build_object('affiliate_user_id', _affiliate_user_id, 'held', _hold, 'links', _n);
END
$function$;

-- ───────────────────────── wrappers públicos e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_affiliates_page(_filter text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_affiliates_page(_filter, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_affiliate_products_page(_search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_affiliate_products_page(_search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_affiliate_detail(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_affiliate_detail(_user_id); $$;

CREATE OR REPLACE FUNCTION public.admin_set_affiliate_hold(_affiliate_user_id uuid, _link_id uuid, _hold boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_affiliate_hold(_affiliate_user_id, _link_id, _hold, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_affiliates_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_affiliate_products_page(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_affiliate_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_affiliate_hold(uuid, uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_affiliates_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_affiliate_products_page(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_affiliate_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_affiliate_hold(uuid, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_affiliates_page(text, text, integer, integer), app_private.get_admin_affiliate_products_page(text, integer, integer),
  app_private.get_admin_affiliate_detail(uuid), app_private.admin_set_affiliate_hold(uuid, uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_affiliates_page(text, text, integer, integer), public.get_admin_affiliate_products_page(text, integer, integer),
  public.get_admin_affiliate_detail(uuid), public.admin_set_affiliate_hold(uuid, uuid, boolean, text) TO authenticated, service_role;
