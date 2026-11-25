-- Admin › MED Pix, Pré-MED, Chargeback e Reembolsos (central de disputas)
--  • lista paginada no servidor (tipo, situação, busca) com resumo e contagens que fecham com a lista;
--  • histórico de cada disputa com o nome de quem agiu;
--  • busca de venda para abrir disputa ou reembolsar (antes o admin tinha que colar o ID da venda);
--  • abrir disputa passa a exigir senha recente no servidor (congela dinheiro do seller), decidir exige justificativa
--    e mover para análise entra na auditoria.

-- ───────────────────────── lista ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_disputes_page(
  _type text DEFAULT NULL, _status text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_type   text := NULLIF(btrim(COALESCE(_type, '')), '');
  v_status text := NULLIF(btrim(COALESCE(_status, '')), '');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_ps     int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_out    jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_type IS NOT NULL AND v_type NOT IN ('medpix', 'pre_med_pix', 'refund', 'chargeback') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'seller', 'buyer', 'all') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT d.*, p.full_name AS seller_name, p.email AS seller_email
      FROM public.disputes d
      LEFT JOIN public.profiles p ON p.user_id = d.seller_user_id
     WHERE v_q IS NULL OR p.full_name ILIKE v_pat OR p.email ILIKE v_pat OR d.buyer_name ILIKE v_pat OR d.buyer_email ILIKE v_pat
        OR d.transaction_id::text ILIKE v_pat OR d.id::text ILIKE v_pat
  ),
  typed AS (SELECT * FROM base WHERE v_type IS NULL OR type = v_type),
  by_status AS (
    SELECT * FROM base
     WHERE v_status IS NULL OR v_status = 'all'
        OR (v_status = 'active' AND status IN ('open', 'in_review'))
        OR (v_status = 'seller' AND status = 'resolved_seller')
        OR (v_status = 'buyer' AND status = 'resolved_buyer')
  ),
  filt AS (
    SELECT * FROM typed
     WHERE v_status IS NULL OR v_status = 'all'
        OR (v_status = 'active' AND status IN ('open', 'in_review'))
        OR (v_status = 'seller' AND status = 'resolved_seller')
        OR (v_status = 'buyer' AND status = 'resolved_buyer')
  ),
  paged AS (
    SELECT f.*, row_number() OVER (
             ORDER BY (f.status IN ('open', 'in_review')) DESC,
                      CASE WHEN f.status IN ('open', 'in_review') THEN f.response_deadline END ASC NULLS LAST,
                      f.created_at DESC, f.id) AS rn
      FROM filt f
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'transaction_id', x.transaction_id, 'seller_user_id', x.seller_user_id, 'seller_name', x.seller_name, 'seller_email', x.seller_email,
        'type', x.type, 'status', x.status, 'reason', x.reason, 'amount', x.amount, 'buyer_name', x.buyer_name, 'buyer_email', x.buyer_email,
        'created_at', x.created_at, 'response_deadline', x.response_deadline, 'seller_response', x.seller_response, 'seller_responded_at', x.seller_responded_at,
        'admin_notes', x.admin_notes, 'fee_amount', x.fee_amount, 'resolved_at', x.resolved_at, 'external_ref', x.external_ref,
        'evidence', CASE WHEN jsonb_typeof(x.evidence_urls) = 'array' THEN x.evidence_urls ELSE '[]'::jsonb END,
        'held_amount', COALESCE((SELECT l.amount FROM public.financial_ledger l WHERE l.idempotency_key = 'dispute_open_' || x.id), 0),
        'payment_method', t.payment_method, 'tx_amount', t.amount, 'product_name', pr.name
      ) ORDER BY x.rn)
        FROM paged x
        LEFT JOIN public.transactions t ON t.id = x.transaction_id
        LEFT JOIN public.products pr ON pr.id = t.product_id
       WHERE x.rn > v_off AND x.rn <= v_off + v_ps), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', jsonb_build_object(
      'all', (SELECT count(*) FROM typed),
      'active', (SELECT count(*) FROM typed WHERE status IN ('open', 'in_review')),
      'open', (SELECT count(*) FROM typed WHERE status = 'open'),
      'in_review', (SELECT count(*) FROM typed WHERE status = 'in_review'),
      'seller', (SELECT count(*) FROM typed WHERE status = 'resolved_seller'),
      'buyer', (SELECT count(*) FROM typed WHERE status = 'resolved_buyer'),
      'overdue', (SELECT count(*) FROM typed WHERE status IN ('open', 'in_review') AND seller_response IS NULL AND response_deadline < now()),
      'soon', (SELECT count(*) FROM typed WHERE status IN ('open', 'in_review') AND seller_response IS NULL AND response_deadline >= now() AND response_deadline < now() + interval '48 hours'),
      'held', COALESCE((SELECT sum(l.amount) FROM typed t2 JOIN public.financial_ledger l ON l.idempotency_key = 'dispute_open_' || t2.id WHERE t2.status IN ('open', 'in_review')), 0),
      'active_amount', COALESCE((SELECT sum(amount) FROM typed WHERE status IN ('open', 'in_review')), 0),
      'lost_amount', COALESCE((SELECT sum(amount) FROM typed WHERE status = 'resolved_buyer'), 0),
      'fees', COALESCE((SELECT sum(fee_amount) FROM typed WHERE status = 'resolved_buyer'), 0)
    ),
    'type_counts', jsonb_build_object(
      'all', (SELECT count(*) FROM by_status),
      'medpix', (SELECT count(*) FROM by_status WHERE type = 'medpix'),
      'pre_med_pix', (SELECT count(*) FROM by_status WHERE type = 'pre_med_pix'),
      'refund', (SELECT count(*) FROM by_status WHERE type = 'refund'),
      'chargeback', (SELECT count(*) FROM by_status WHERE type = 'chargeback')
    ),
    'generated_at', now()
  ) INTO v_out;
  RETURN v_out;
END $function$;

-- ───────────────────────── histórico ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_dispute_events(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM app_private.assert_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', e.id, 'event', e.event, 'note', e.note, 'created_at', e.created_at,
                                         'actor_name', COALESCE(NULLIF(btrim(p.full_name), ''), p.email)) ORDER BY e.created_at, e.id)
      FROM public.dispute_events e
      LEFT JOIN public.profiles p ON p.user_id = e.actor_id
     WHERE e.dispute_id = _id), '[]'::jsonb);
END $function$;

-- ───────────────────────── busca de venda ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_search_sales(_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_q   text := btrim(COALESCE(_query, ''));
  v_pat text;
  v_dig text := regexp_replace(btrim(COALESCE(_query, '')), '\D', '', 'g');
BEGIN
  PERFORM app_private.assert_admin();
  IF length(v_q) < 3 OR length(v_q) > 120 THEN RAISE EXCEPTION 'digite de 3 a 120 caracteres para buscar'; END IF;
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'amount', s.amount, 'refunded_amount', COALESCE(s.refunded_amount, 0), 'status', s.status, 'payment_method', s.payment_method,
      'customer_name', s.customer_name, 'customer_email', s.customer_email, 'created_at', s.created_at, 'is_simulated', COALESCE(s.is_simulated, false),
      'seller_name', COALESCE(NULLIF(btrim(p.full_name), ''), p.email), 'product_name', pr.name,
      'open_dispute', EXISTS (SELECT 1 FROM public.disputes d WHERE d.transaction_id = s.id AND d.status IN ('open', 'in_review')),
      'pending_refund', EXISTS (SELECT 1 FROM public.refund_requests r WHERE r.transaction_id = s.id AND r.status = 'pending_confirmation')
    ) ORDER BY s.created_at DESC, s.id)
      FROM (
        SELECT t.* FROM public.transactions t
         WHERE (v_q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND t.id = v_q::uuid)
            OR (v_q !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND (
                  t.id::text ILIKE v_pat OR t.customer_email ILIKE v_pat OR t.customer_name ILIKE v_pat OR t.external_id = v_q
                  OR (length(v_dig) IN (11, 14) AND regexp_replace(COALESCE(t.customer_document, ''), '\D', '', 'g') = v_dig)))
         ORDER BY t.created_at DESC, t.id
         LIMIT 15
      ) s
      LEFT JOIN public.profiles p ON p.user_id = s.user_id
      LEFT JOIN public.products pr ON pr.id = s.product_id), '[]'::jsonb);
END $function$;

-- ───────────────────────── ações ─────────────────────────

-- Mover para análise: agora também fica na auditoria.
CREATE OR REPLACE FUNCTION app_private.admin_set_dispute_review(_dispute_id uuid, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT app_private.has_financial_permission(_uid, 'dispute_review') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.disputes SET status = 'in_review' WHERE id = _dispute_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não está aberta'; END IF;
  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note) VALUES (_dispute_id, _uid, 'in_review', left(btrim(COALESCE(_note, '')), 2000));
  PERFORM app_private.admin_audit(_uid, 'dispute_review', 'dispute', _dispute_id::text, '{}'::jsonb);
END $function$;

-- Decidir exige justificativa (antes a observação era opcional e a decisão ficava sem explicação no histórico).
CREATE OR REPLACE FUNCTION app_private.admin_resolve_dispute(_dispute_id uuid, _outcome text, _fee numeric DEFAULT 0, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _admin uuid := app_private.assert_admin(); _d public.disputes%ROWTYPE; _bal numeric; _fee_v numeric := ROUND(COALESCE(_fee,0),2); _n text := left(btrim(COALESCE(_note, '')), 2000);
BEGIN
  IF _outcome NOT IN ('seller','buyer') THEN RAISE EXCEPTION 'resultado inválido'; END IF;
  IF length(_n) < 3 THEN RAISE EXCEPTION 'informe a justificativa da decisão'; END IF;
  IF _fee_v < 0 OR _fee_v > 10000 THEN RAISE EXCEPTION 'taxa inválida'; END IF;
  SELECT * INTO _d FROM public.disputes WHERE id = _dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'disputa não encontrada'; END IF;
  IF _d.status NOT IN ('open','in_review') THEN RAISE EXCEPTION 'disputa já encerrada'; END IF;

  UPDATE public.disputes SET status = CASE WHEN _outcome='seller' THEN 'resolved_seller' ELSE 'resolved_buyer' END,
    won_by_seller = (_outcome='seller'), admin_user_id = _admin, fee_amount = CASE WHEN _outcome='buyer' THEN _fee_v ELSE 0 END,
    admin_notes = _n, resolved_at = now()
  WHERE id = _dispute_id;

  IF _outcome = 'buyer' THEN
    IF _d.transaction_id IS NOT NULL THEN PERFORM app_private.revoke_access_for_tx(_d.transaction_id); END IF;
    IF _fee_v > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext(_d.seller_user_id::text));
      _bal := public.calculate_ledger_balance(_d.seller_user_id);
      INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
      VALUES (_d.seller_user_id, _d.transaction_id, 'debit', _fee_v, _bal - _fee_v, 'Taxa de disputa', 'dispute_fee_'||_dispute_id)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.dispute_events(dispute_id, actor_id, event, note)
  VALUES (_dispute_id, _admin, CASE WHEN _outcome='seller' THEN 'won_by_seller' ELSE 'lost_by_seller' END, _n);
  PERFORM app_private.admin_audit(_admin,'dispute_resolve','dispute',_dispute_id::text, jsonb_build_object('outcome',_outcome,'fee',_fee_v));
END $function$;

-- Abrir disputa congela o dinheiro do seller: exige a senha confirmada nos últimos 10 minutos, como decidir e reembolsar.
CREATE OR REPLACE FUNCTION public.admin_open_dispute(_transaction_id uuid, _type text, _reason text, _deadline_days integer DEFAULT 7)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'app_private'
AS $function$
BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_open_dispute(_transaction_id, _type, _reason, _deadline_days); END $function$;

-- ───────────────────────── wrappers e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_disputes_page(_type text DEFAULT NULL, _status text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_disputes_page($1, $2, $3, $4, $5) $function$;

CREATE OR REPLACE FUNCTION public.get_admin_dispute_events(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_dispute_events($1) $function$;

CREATE OR REPLACE FUNCTION public.admin_search_sales(_query text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.admin_search_sales($1) $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_disputes_page(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_dispute_events(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_search_sales(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_disputes_page(text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_dispute_events(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_search_sales(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_admin_disputes_page(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_dispute_events(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_search_sales(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_disputes_page(text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dispute_events(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_sales(text) TO authenticated, service_role;

-- ───────────────────────── correção: nenhuma disputa conseguia abrir nem fechar ─────────────────────────
-- O gatilho de saldo gravava `notifications.link`, coluna que não existe (a tabela tem id, user_id, title, message, type,
-- is_read, created_by, created_at). Resultado: abrir MED/chargeback/reembolso e decidir uma disputa falhava sempre com
-- "column link of relation notifications does not exist". Mesma regra de saldo de antes, só sem a coluna inexistente.
CREATE OR REPLACE FUNCTION public.handle_dispute_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tx public.transactions%ROWTYPE;
  _hold numeric; _held numeric; _bal numeric; _ins integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));
    SELECT * INTO _tx FROM public.transactions WHERE id = NEW.transaction_id AND user_id = NEW.seller_user_id FOR UPDATE;
    IF NOT FOUND OR COALESCE(_tx.amount,0) <= 0 THEN RAISE EXCEPTION 'Transação inválida para abertura de disputa'; END IF;
    _hold := ROUND(COALESCE(_tx.net_amount,_tx.amount) * (_tx.amount - COALESCE(_tx.refunded_amount,0)) / _tx.amount, 2);
    IF _hold <= 0 THEN RAISE EXCEPTION 'Venda já totalmente reembolsada'; END IF;
    _bal := public.calculate_ledger_balance(NEW.seller_user_id);
    INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
    VALUES (NEW.seller_user_id, NEW.transaction_id, 'dispute_hold', _hold, _bal - _hold,
            CASE WHEN NEW.type IN ('medpix','pre_med_pix') THEN 'MED PIX - valor congelado em análise' ELSE 'Disputa - valor congelado em análise' END,
            'dispute_open_' || NEW.id)
    ON CONFLICT (idempotency_key) DO NOTHING;
    GET DIAGNOSTICS _ins = ROW_COUNT;
    UPDATE public.transactions SET status = 'disputed', updated_at = now() WHERE id = NEW.transaction_id AND status <> 'disputed';
    IF _ins > 0 THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (NEW.seller_user_id, 'dispute_opened',
        CASE WHEN NEW.type IN ('medpix','pre_med_pix') THEN 'MED PIX - transação em análise' ELSE 'Disputa - transação em análise' END,
        'A venda ' || substring(NEW.transaction_id::text,1,8) || ' está em análise. R$ ' || to_char(_hold,'FM999999990.00') || ' congelados até a decisão.');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Immutable money fields
    IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id OR NEW.seller_user_id IS DISTINCT FROM OLD.seller_user_id
       OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'Dados financeiros da disputa não podem ser alterados';
    END IF;
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
    IF OLD.status IN ('resolved_seller','resolved_buyer','closed') THEN RAISE EXCEPTION 'Disputa já encerrada não pode ser alterada'; END IF;
    IF NEW.status = 'closed' THEN RAISE EXCEPTION 'Use a decisão (seller ou cliente) para encerrar'; END IF;
    IF NEW.status NOT IN ('resolved_seller','resolved_buyer') THEN RETURN NEW; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_user_id::text));
    SELECT * INTO _tx FROM public.transactions WHERE id = NEW.transaction_id FOR UPDATE;
    SELECT amount INTO _held FROM public.financial_ledger WHERE idempotency_key = 'dispute_open_' || NEW.id;
    _bal := public.calculate_ledger_balance(NEW.seller_user_id);

    IF NEW.status = 'resolved_seller' THEN
      IF COALESCE(_held,0) > 0 THEN
        INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (NEW.seller_user_id, NEW.transaction_id, 'dispute_release', _held, _bal + _held, 'Análise encerrada a favor do seller - valor devolvido', 'dispute_release_' || NEW.id)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      UPDATE public.transactions SET status = 'approved', updated_at = now() WHERE id = NEW.transaction_id AND status = 'disputed';
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (NEW.seller_user_id, 'dispute_won', 'Análise encerrada a seu favor', 'O valor congelado voltou para o seu saldo.');
    ELSE
      -- Buyer won: hold stays as the definitive debit. Release security retention so it isn't charged twice.
      IF COALESCE(_tx.retained_amount,0) > 0 AND NOT COALESCE(_tx.retention_released,false) THEN
        INSERT INTO public.financial_ledger(user_id, transaction_id, entry_type, amount, balance_after, description, idempotency_key)
        VALUES (NEW.seller_user_id, NEW.transaction_id, 'retention_release', _tx.retained_amount, _bal + _tx.retained_amount, 'Liberação de retenção (MED encerrado)', 'tx_retrelease_' || NEW.transaction_id)
        ON CONFLICT (idempotency_key) DO NOTHING;
        UPDATE public.transactions SET retention_released = true WHERE id = NEW.transaction_id;
      END IF;
      UPDATE public.transactions SET status = 'chargeback', updated_at = now() WHERE id = NEW.transaction_id AND status = 'disputed';
      PERFORM public.reverse_transaction_splits(NEW.transaction_id);
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (NEW.seller_user_id, 'dispute_lost', 'Análise encerrada a favor do cliente', 'O valor congelado da venda foi removido do seu saldo.');
    END IF;
    IF NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ───────────────────────── reembolso: senha recente + erros em português ─────────────────────────
-- Antes: qualquer sessão de admin reembolsava sem reconfirmar a senha e os erros vinham em inglês
-- ("transaction is not refundable"). O efeito não muda: debita o seller na hora e cria o pedido em "Pendentes de aprovação".
CREATE OR REPLACE FUNCTION app_private.admin_refund_transaction(_transaction_id uuid, _amount numeric, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _admin uuid := app_private.assert_admin(); _res jsonb; _before text; _req uuid; _tx public.transactions%ROWTYPE; _rem numeric;
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF _transaction_id IS NULL THEN RAISE EXCEPTION 'escolha a venda'; END IF;
  IF _amount IS NULL OR ROUND(_amount, 2) <= 0 THEN RAISE EXCEPTION 'informe um valor maior que zero'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'venda não encontrada'; END IF;
  IF COALESCE(_tx.is_simulated, false) THEN RAISE EXCEPTION 'venda simulada não é reembolsada'; END IF;
  IF _tx.status = 'disputed' THEN RAISE EXCEPTION 'venda em disputa: decida a disputa antes de reembolsar'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed','partially_refunded') THEN RAISE EXCEPTION 'esta venda não está paga, então não dá para reembolsar'; END IF;
  _rem := ROUND(_tx.amount - COALESCE(_tx.refunded_amount, 0), 2);
  IF ROUND(_amount, 2) > _rem THEN RAISE EXCEPTION 'o valor passa do que ainda pode ser reembolsado (R$ %)', to_char(_rem, 'FM999999990.00'); END IF;
  IF EXISTS (SELECT 1 FROM public.refund_requests WHERE transaction_id = _transaction_id AND status = 'pending_confirmation') THEN
    RAISE EXCEPTION 'já existe um reembolso aguardando confirmação para esta venda';
  END IF;
  _before := _tx.status;
  _res := public.record_transaction_refund(_transaction_id, ROUND(_amount,2), btrim(_reason), _admin);
  _req := app_private.enqueue_refund(_transaction_id, ROUND(_amount,2), btrim(_reason), _admin, 'admin', _before);
  IF NOT (_res->>'partial')::boolean THEN PERFORM app_private.revoke_access_for_tx(_transaction_id); END IF;
  PERFORM app_private.admin_audit(_admin,'transaction_refund','transaction',_transaction_id::text,
    jsonb_build_object('amount',ROUND(_amount,2),'reason',left(btrim(_reason),500),'request_id',_req) || _res);
  RETURN _res || jsonb_build_object('request_id',_req);
END $function$;
