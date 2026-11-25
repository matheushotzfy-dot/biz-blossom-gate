-- Admin › Cupons
--  • ANTES: a aba lia `coupons` (1000 mais recentes) e cruzava, no navegador, com a lista de transações já carregada no
--    painel (limitada): compradores, vendas e desconto saíam incompletos em silêncio, não havia ação nenhuma e a aba
--    chamava de "vendas" o contador de reservas.
--  • AGORA: lista paginada e raio-X calculados no servidor (vendas pagas, compradores, desconto real, reservas em aberto,
--    histórico) e "Pausar cupom": o cupom para de valer na hora e o seller NÃO consegue reativar sozinho (gatilho) até o
--    admin liberar. Ação com motivo, senha recente, auditoria e aviso ao seller.
--  • CORRIGIDO de passagem:
--      1) `reserve_coupon_on_tx` reserva 1 uso ao criar a transação, mas só devolvia a vaga em refunded/chargeback/failed/
--         cancelled. Pix que EXPIRA (status 'expired', criado pelos jobs de limpeza) ficava com a vaga para sempre: um cupom
--         de 10 usos esgotava com 10 pix abandonados. Agora devolve em todo status final sem pagamento, e re-reserva se uma
--         transação "ressuscitar" (pix pago depois de expirar).
--      2) gatilho duplicado `validate_coupon_discount_trigger` (o mesmo `validate_coupon_discount` rodava 2x).
--      3) índice parcial em transactions(coupon_id): a aba e o raio-X filtram por cupom e a coluna é quase sempre nula.

-- ───────────────────────── pausa da equipe ─────────────────────────

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS admin_hold_reason text,
  ADD COLUMN IF NOT EXISTS admin_hold_at timestamptz;

CREATE OR REPLACE FUNCTION app_private.guard_coupons_admin_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.admin_hold_reason := NULL; NEW.admin_hold_at := NULL;
    RETURN NEW;
  END IF;
  NEW.admin_hold_reason := OLD.admin_hold_reason;
  NEW.admin_hold_at := OLD.admin_hold_at;
  IF OLD.admin_hold_at IS NOT NULL AND COALESCE(NEW.is_active, false) THEN
    RAISE EXCEPTION 'A equipe pausou este cupom e ele só volta com a liberação do suporte.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_coupons_admin_hold ON public.coupons;
CREATE TRIGGER guard_coupons_admin_hold BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_coupons_admin_hold();

-- ───────────────────────── correções de contador ─────────────────────────

DROP TRIGGER IF EXISTS validate_coupon_discount_trigger ON public.coupons;

CREATE INDEX IF NOT EXISTS idx_transactions_coupon_id ON public.transactions (coupon_id) WHERE coupon_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_coupon_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _updated int;
  -- status finais em que a venda não aconteceu (ou foi desfeita): a vaga volta para o cupom
  _released constant text[] := ARRAY['refunded','chargeback','chargedback','charged_back','failed','cancelled','canceled','expired','rejected','refused','error'];
BEGIN
  -- Reserva a vaga de forma atômica ao criar a transação
  IF TG_OP = 'INSERT' AND NEW.coupon_id IS NOT NULL THEN
    UPDATE public.coupons
       SET current_uses = current_uses + 1
     WHERE id = NEW.coupon_id
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR current_uses < max_uses);
    GET DIAGNOSTICS _updated = ROW_COUNT;
    IF _updated = 0 THEN
      RAISE EXCEPTION 'Cupom esgotado, expirado ou inválido' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.coupon_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = ANY(_released) AND NOT (COALESCE(OLD.status, '') = ANY(_released)) THEN
      -- virou venda perdida: devolve a vaga e o desconto que já tinha sido somado
      UPDATE public.coupons
         SET current_uses = GREATEST(current_uses - 1, 0),
             total_discount_amount = CASE WHEN OLD.status = 'completed' THEN GREATEST(total_discount_amount - COALESCE(NEW.discount_amount, 0), 0) ELSE total_discount_amount END
       WHERE id = NEW.coupon_id;
    ELSIF OLD.status = ANY(_released) AND NOT (COALESCE(NEW.status, '') = ANY(_released)) THEN
      -- ressuscitou (ex.: pix pago depois de expirar): pega a vaga de volta, sem checar o limite, o dinheiro já entrou
      UPDATE public.coupons
         SET current_uses = current_uses + 1,
             total_discount_amount = CASE WHEN NEW.status = 'completed' THEN total_discount_amount + COALESCE(NEW.discount_amount, 0) ELSE total_discount_amount END
       WHERE id = NEW.coupon_id;
    ELSIF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
      UPDATE public.coupons
         SET total_discount_amount = total_discount_amount + COALESCE(NEW.discount_amount, 0)
       WHERE id = NEW.coupon_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ───────────────────────── lista ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_coupons_page(
  _status text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text := COALESCE(NULLIF(btrim(COALESCE(_status, '')), ''), 'all');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_ps     int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_out    jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_status NOT IN ('all', 'active', 'paused', 'expired', 'exhausted') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT c.*, p.name AS product_name, (p.deleted_at IS NOT NULL) AS product_deleted,
           pr.full_name AS seller_name, pr.email AS seller_email,
           CASE WHEN c.admin_hold_at IS NOT NULL THEN 'held'
                WHEN NOT c.is_active THEN 'paused'
                WHEN c.expires_at IS NOT NULL AND c.expires_at < now() THEN 'expired'
                WHEN c.max_uses IS NOT NULL AND c.current_uses >= c.max_uses THEN 'exhausted'
                ELSE 'active' END AS state
      FROM public.coupons c
      LEFT JOIN public.products p ON p.id = c.product_id
      LEFT JOIN public.profiles pr ON pr.user_id = c.user_id
     WHERE v_q IS NULL OR c.code ILIKE v_pat OR COALESCE(p.name, '') ILIKE v_pat
        OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat OR c.id::text ILIKE v_pat
  ),
  filt AS (
    SELECT * FROM base
     WHERE v_status = 'all'
        OR (v_status = 'paused' AND state IN ('held', 'paused'))
        OR state = v_status
  ),
  paged AS (
    SELECT f.*, row_number() OVER (ORDER BY (f.state = 'active') DESC, f.created_at DESC, f.id) AS rn FROM filt f
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps),
  tx AS (
    SELECT t.coupon_id,
           count(*) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')) AS sales,
           count(DISTINCT lower(btrim(t.customer_email))) FILTER (WHERE t.status IN ('approved', 'paid', 'completed') AND COALESCE(btrim(t.customer_email), '') <> '') AS buyers,
           COALESCE(sum(t.discount_amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')), 0) AS discount,
           COALESCE(sum(t.amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')), 0) AS gross,
           count(*) FILTER (WHERE t.status IN ('pending', 'processing', 'waiting_payment')) AS open_reservations
      FROM public.transactions t
     WHERE t.coupon_id IN (SELECT id FROM page) AND NOT COALESCE(t.is_simulated, false)
     GROUP BY t.coupon_id
  ),
  all_tx AS (
    SELECT count(*) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')) AS sales,
           count(DISTINCT lower(btrim(t.customer_email))) FILTER (WHERE t.status IN ('approved', 'paid', 'completed') AND COALESCE(btrim(t.customer_email), '') <> '') AS buyers,
           COALESCE(sum(t.discount_amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')), 0) AS discount
      FROM public.transactions t
     WHERE t.coupon_id IN (SELECT id FROM base) AND NOT COALESCE(t.is_simulated, false)
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'state', p.state, 'discount_type', p.discount_type, 'discount_value', p.discount_value,
        'apply_to_bumps', p.apply_to_bumps, 'max_uses', p.max_uses, 'current_uses', p.current_uses, 'is_active', p.is_active,
        'expires_at', p.expires_at, 'created_at', p.created_at, 'hold_reason', p.admin_hold_reason, 'hold_at', p.admin_hold_at,
        'product_id', p.product_id, 'product_name', p.product_name, 'product_deleted', COALESCE(p.product_deleted, false),
        'seller_user_id', p.user_id, 'seller_name', p.seller_name, 'seller_email', p.seller_email,
        'sales', COALESCE(x.sales, 0), 'buyers', COALESCE(x.buyers, 0), 'discount', COALESCE(x.discount, 0), 'gross', COALESCE(x.gross, 0),
        'open_reservations', COALESCE(x.open_reservations, 0)
      ) ORDER BY p.rn) FROM page p LEFT JOIN tx x ON x.coupon_id = p.id), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*),
        'active', count(*) FILTER (WHERE state = 'active'),
        'paused', count(*) FILTER (WHERE state IN ('held', 'paused')),
        'expired', count(*) FILTER (WHERE state = 'expired'),
        'exhausted', count(*) FILTER (WHERE state = 'exhausted'),
        'held', count(*) FILTER (WHERE state = 'held'),
        -- cupom de 100% no ar: entrega o produto de graça
        'full_discount', count(*) FILTER (WHERE state = 'active' AND discount_type = 'percentage' AND discount_value >= 100),
        'sales', (SELECT sales FROM all_tx), 'buyers', (SELECT buyers FROM all_tx), 'discount', (SELECT discount FROM all_tx)
      ) FROM base),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── raio-X ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_coupon_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _c public.coupons%ROWTYPE;
  _p public.products%ROWTYPE;
  _pr public.profiles%ROWTYPE;
  _state text;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO _c FROM public.coupons WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cupom não encontrado'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _c.product_id;
  SELECT * INTO _pr FROM public.profiles WHERE user_id = _c.user_id;
  _state := CASE WHEN _c.admin_hold_at IS NOT NULL THEN 'held'
                 WHEN NOT _c.is_active THEN 'paused'
                 WHEN _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN 'expired'
                 WHEN _c.max_uses IS NOT NULL AND _c.current_uses >= _c.max_uses THEN 'exhausted'
                 ELSE 'active' END;

  RETURN jsonb_build_object(
    'coupon', jsonb_build_object(
      'id', _c.id, 'code', _c.code, 'state', _state, 'discount_type', _c.discount_type, 'discount_value', _c.discount_value,
      'apply_to_bumps', _c.apply_to_bumps, 'max_uses', _c.max_uses, 'current_uses', _c.current_uses, 'is_active', _c.is_active,
      'expires_at', _c.expires_at, 'created_at', _c.created_at, 'hold_reason', _c.admin_hold_reason, 'hold_at', _c.admin_hold_at),
    'product', CASE WHEN _c.product_id IS NULL THEN NULL
                    ELSE jsonb_build_object('id', _c.product_id, 'name', _p.name, 'price', _p.price, 'deleted', _p.id IS NULL OR _p.deleted_at IS NOT NULL) END,
    'seller', jsonb_build_object('user_id', _c.user_id, 'name', COALESCE(NULLIF(_pr.full_name, ''), _pr.email, 'Seller sem nome'), 'email', _pr.email, 'account_status', _pr.account_status),
    -- venda simulada fica fora de todos os números (igual à lista); só é contada à parte
    'stats', (SELECT jsonb_build_object(
        'sales', count(*) FILTER (WHERE NOT t.sim AND t.status IN ('approved', 'paid', 'completed')),
        'buyers', count(DISTINCT lower(btrim(t.customer_email))) FILTER (WHERE NOT t.sim AND t.status IN ('approved', 'paid', 'completed') AND COALESCE(btrim(t.customer_email), '') <> ''),
        'discount', COALESCE(sum(t.discount_amount) FILTER (WHERE NOT t.sim AND t.status IN ('approved', 'paid', 'completed')), 0),
        'gross', COALESCE(sum(t.amount) FILTER (WHERE NOT t.sim AND t.status IN ('approved', 'paid', 'completed')), 0),
        'refunds', count(*) FILTER (WHERE NOT t.sim AND t.status IN ('refunded', 'partially_refunded')),
        'chargebacks', count(*) FILTER (WHERE NOT t.sim AND t.status IN ('chargeback', 'chargedback', 'charged_back')),
        'open_reservations', count(*) FILTER (WHERE NOT t.sim AND t.status IN ('pending', 'processing', 'waiting_payment')),
        'lost', count(*) FILTER (WHERE NOT t.sim AND t.status IN ('failed', 'cancelled', 'canceled', 'expired', 'rejected', 'refused', 'error')),
        'simulated', count(*) FILTER (WHERE t.sim)
      ) FROM (SELECT t0.*, COALESCE(t0.is_simulated, false) AS sim FROM public.transactions t0 WHERE t0.coupon_id = _id) t),
    'sales', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.created_at DESC) FROM (
        SELECT t.id, t.status, t.amount, COALESCE(t.discount_amount, 0) AS discount_amount, t.payment_method, t.created_at,
               NULLIF(btrim(COALESCE(t.customer_name, '')), '') AS buyer_name, NULLIF(btrim(COALESCE(t.customer_email, '')), '') AS buyer_email,
               COALESCE(t.is_simulated, false) AS simulated
          FROM public.transactions t WHERE t.coupon_id = _id
         ORDER BY t.created_at DESC LIMIT 50) s), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT a.id, a.action, a.created_at, a.details, NULLIF(COALESCE(ap.full_name, ap.email), '') AS admin_name
          FROM public.audit_logs a LEFT JOIN public.profiles ap ON ap.user_id = a.admin_user_id
         WHERE a.entity_type = 'coupon' AND a.entity_id = _id::text
         ORDER BY a.created_at DESC LIMIT 20) h), '[]'::jsonb)
  );
END
$function$;

-- ───────────────────────── pausar / liberar ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_coupon_hold(_id uuid, _hold boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _c public.coupons%ROWTYPE;
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
BEGIN
  IF _hold IS NULL THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO _c FROM public.coupons WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cupom não encontrado'; END IF;

  IF _hold THEN
    IF _c.admin_hold_at IS NOT NULL THEN RAISE EXCEPTION 'o cupom já está pausado pela equipe'; END IF;
    UPDATE public.coupons SET is_active = false, admin_hold_reason = _r, admin_hold_at = now() WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_c.user_id, 'Cupom pausado', format('A equipe pausou o cupom %s. Motivo: %s', _c.code, _r), 'coupon');
    PERFORM app_private.admin_audit(_admin, 'coupon_hold', 'coupon', _id::text,
      jsonb_build_object('reason', _r, 'was_active', _c.is_active, 'seller', _c.user_id, 'code', _c.code));
  ELSE
    IF _c.admin_hold_at IS NULL THEN RAISE EXCEPTION 'o cupom não está pausado pela equipe'; END IF;
    UPDATE public.coupons SET admin_hold_reason = NULL, admin_hold_at = NULL WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_c.user_id, 'Cupom liberado', format('O cupom %s foi liberado. Ative de novo quando quiser.', _c.code), 'coupon');
    PERFORM app_private.admin_audit(_admin, 'coupon_release', 'coupon', _id::text,
      jsonb_build_object('reason', _r, 'previous_reason', _c.admin_hold_reason, 'seller', _c.user_id, 'code', _c.code));
  END IF;
  RETURN jsonb_build_object('id', _id, 'held', _hold);
END
$function$;

-- ───────────────────────── wrappers públicos e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_coupons_page(_status text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_coupons_page(_status, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_coupon_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_coupon_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_set_coupon_hold(_id uuid, _hold boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_coupon_hold(_id, _hold, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_coupons_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_coupon_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_coupon_hold(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_coupons_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_coupon_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_coupon_hold(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_coupons_page(text, text, integer, integer), app_private.get_admin_coupon_detail(uuid), app_private.admin_set_coupon_hold(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_coupons_page(text, text, integer, integer), public.get_admin_coupon_detail(uuid), public.admin_set_coupon_hold(uuid, boolean, text) TO authenticated, service_role;
