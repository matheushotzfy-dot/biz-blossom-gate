-- Painel da equipe (gerentes e funcionários, /gerentes/dashboard).
--
-- O que muda:
-- 1. O painel nunca carregava em produção: as funções `app_private.get_staff_portfolio_dashboard` e
--    `get_staff_portfolio_transactions` não tinham EXECUTE para `authenticated`, e o wrapper público é SECURITY
--    INVOKER. Toda conta da equipe via "Não foi possível carregar sua carteira".
-- 2. A carteira conta venda paga como o resto da plataforma (`approved`, `paid`, `completed`; antes só
--    `completed`), os números do topo não mudam com a busca e conta da equipe congelada não abre o painel.
-- 3. Ficha do seller para a equipe (`get_staff_seller_detail`): só seller com vínculo ativo, números desde o
--    vínculo, e cada bloco (taxas, saques, disputas, observações) só sai com a permissão que o libera.
-- 4. Pedido de pagamento de comissão: o gatilho que confere o saldo rodava como quem pedia e não tinha
--    permissão de ler o saldo, então nenhum gerente conseguia pedir pagamento.
-- 5. Busca: `%` e `_` digitados são texto.
-- 6. Pedido ao dono: gerente só pede sobre seller da própria carteira; motivo com tamanho limitado.

-- ───────────────────────── carteira ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.staff_panel_role(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _uid IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND frozen = true) THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'manager') THEN 'manager'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'employee') THEN 'employee'
  END
$function$;

CREATE OR REPLACE FUNCTION app_private.like_pattern(_q text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$ SELECT '%' || replace(replace(replace(COALESCE(_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' $function$;

CREATE OR REPLACE FUNCTION app_private.get_staff_portfolio_dashboard(_from timestamp with time zone, _to timestamp with time zone, _page integer DEFAULT 1, _search text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _role text := app_private.staff_panel_role(auth.uid());
  _p integer := greatest(COALESCE(_page, 1), 1);
  _q text := left(btrim(COALESCE(_search, '')), 100);
  _like text;
  _result jsonb;
BEGIN
  IF _role IS NULL THEN RAISE EXCEPTION 'access denied'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from >= _to OR _to - _from > interval '366 days' THEN RAISE EXCEPTION 'invalid period'; END IF;
  _like := app_private.like_pattern(_q);

  WITH portfolio AS (
    SELECT a.seller_user_id, a.started_at, p.full_name, p.email, p.account_status, p.seller_type
      FROM public.manager_seller_assignments a
      JOIN public.profiles p ON p.user_id = a.seller_user_id
     WHERE a.manager_user_id = _uid AND a.ended_at IS NULL AND a.started_at <= now()
  ), scoped_tx AS (
    SELECT t.user_id, t.amount, t.net_amount, t.status
      FROM public.transactions t JOIN portfolio a ON a.seller_user_id = t.user_id
     WHERE t.created_at >= greatest(_from, a.started_at) AND t.created_at < _to AND NOT COALESCE(t.is_simulated, false)
  ), paid_tx AS (
    SELECT * FROM scoped_tx WHERE status IN ('approved', 'paid', 'completed')
  ), scoped_disputes AS (
    SELECT d.type FROM public.disputes d JOIN portfolio a ON a.seller_user_id = d.seller_user_id
     WHERE d.created_at >= greatest(_from, a.started_at) AND d.created_at < _to
  ), scoped_refunds AS (
    SELECT 1 FROM public.refund_requests r JOIN portfolio a ON a.seller_user_id = r.seller_user_id
     WHERE r.created_at >= greatest(_from, a.started_at) AND r.created_at < _to
  ), seller_stats AS (
    SELECT a.seller_user_id, a.started_at, a.full_name, a.email, a.account_status, a.seller_type,
           count(t.*)::int AS sales_count,
           COALESCE(sum(t.amount), 0) AS volume,
           COALESCE(sum(t.net_amount), 0) AS net_volume
      FROM portfolio a LEFT JOIN paid_tx t ON t.user_id = a.seller_user_id
     WHERE _q = '' OR a.full_name ILIKE _like OR a.email ILIKE _like OR a.seller_user_id::text = _q
     GROUP BY a.seller_user_id, a.started_at, a.full_name, a.email, a.account_status, a.seller_type
  ), paged AS (
    SELECT * FROM seller_stats ORDER BY volume DESC, sales_count DESC, seller_user_id LIMIT 25 OFFSET ((_p - 1) * 25)
  )
  SELECT jsonb_build_object(
    'role', _role,
    'period', jsonb_build_object('from', _from, 'to', _to),
    'metrics', jsonb_build_object(
      'seller_count', (SELECT count(*) FROM portfolio),
      'kyc_pending', (SELECT count(*) FROM portfolio WHERE account_status = 'pending_review'),
      'sales_count', (SELECT count(*) FROM paid_tx),
      'volume', (SELECT COALESCE(sum(amount), 0) FROM paid_tx),
      'ticket_average', (SELECT COALESCE(avg(amount), 0) FROM paid_tx),
      'refunds', (SELECT count(*) FROM scoped_refunds),
      'chargebacks', (SELECT count(*) FROM scoped_disputes WHERE type = 'chargeback'),
      'medpix', (SELECT count(*) FROM scoped_disputes WHERE type IN ('medpix', 'pre_med_pix')),
      'commission_generated', (SELECT COALESCE(sum(l.amount), 0) FROM public.staff_commissions_ledger l WHERE l.staff_user_id = _uid AND l.created_at >= _from AND l.created_at < _to AND l.type = 'accrual'),
      'commission_reversed', (SELECT COALESCE(abs(sum(l.amount)), 0) FROM public.staff_commissions_ledger l WHERE l.staff_user_id = _uid AND l.created_at >= _from AND l.created_at < _to AND l.type LIKE 'clawback%'),
      'commission_balance', public.get_staff_commission_balance(_uid)
    ),
    'commission_pct', (SELECT c.base_pct FROM public.staff_commission_config c WHERE c.user_id = _uid AND c.is_active),
    'fee_limits', (SELECT jsonb_build_object('min_transaction_percentage', f.min_transaction_percentage, 'min_transaction_fixed', f.min_transaction_fixed, 'min_withdrawal_fee', f.min_withdrawal_fee)
                     FROM public.staff_fee_limits f WHERE f.user_id = _uid),
    'permissions', (SELECT COALESCE(jsonb_agg(permission_key ORDER BY permission_key), '[]'::jsonb) FROM public.staff_permissions WHERE user_id = _uid),
    -- Verificações da carteira esperando análise (mais antigas primeiro), para a fila do início.
    'kyc_queue', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', q.seller_user_id, 'full_name', q.full_name, 'email', q.email, 'submitted_at', q.submitted_at)
                                            ORDER BY q.submitted_at NULLS LAST, q.seller_user_id), '[]'::jsonb)
                    FROM (SELECT a.seller_user_id, a.full_name, a.email,
                                 (SELECT max(k.submitted_at) FROM public.kyc_submissions k WHERE k.user_id = a.seller_user_id AND k.status = 'pending') AS submitted_at
                            FROM portfolio a WHERE a.account_status = 'pending_review' LIMIT 50) q),
    'sellers', (SELECT COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY paged.volume DESC, paged.sales_count DESC, paged.seller_user_id), '[]'::jsonb) FROM paged),
    'total_sellers', (SELECT count(*) FROM seller_stats),
    'page', _p,
    'page_size', 25
  ) INTO _result;
  RETURN _result;
END $function$;

CREATE OR REPLACE FUNCTION app_private.get_staff_portfolio_transactions(_from timestamp with time zone, _to timestamp with time zone, _page integer DEFAULT 1, _search text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _p integer := greatest(COALESCE(_page, 1), 1);
  _q text := left(btrim(COALESCE(_search, '')), 100);
  _like text;
  _result jsonb;
BEGIN
  IF app_private.staff_panel_role(_uid) IS NULL OR NOT public.has_staff_permission(_uid, 'transactions.view') THEN RAISE EXCEPTION 'permission required'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from >= _to OR _to - _from > interval '366 days' THEN RAISE EXCEPTION 'invalid period'; END IF;
  _like := app_private.like_pattern(_q);
  WITH scoped AS (
    SELECT t.id, t.user_id, t.amount, t.net_amount, t.status, t.payment_method, t.customer_name, t.created_at,
           p.full_name AS seller_name, p.email AS seller_email
      FROM public.manager_seller_assignments a
      JOIN public.transactions t ON t.user_id = a.seller_user_id
      JOIN public.profiles p ON p.user_id = t.user_id
     WHERE a.manager_user_id = _uid AND a.ended_at IS NULL AND a.started_at <= now()
       AND t.created_at >= greatest(_from, a.started_at) AND t.created_at < _to AND NOT COALESCE(t.is_simulated, false)
       AND (_q = '' OR p.full_name ILIKE _like OR p.email ILIKE _like OR t.customer_name ILIKE _like OR t.id::text = _q)
  ), paged AS (SELECT * FROM scoped ORDER BY created_at DESC, id LIMIT 25 OFFSET ((_p - 1) * 25))
  SELECT jsonb_build_object(
    'rows', (SELECT COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY paged.created_at DESC, paged.id), '[]'::jsonb) FROM paged),
    'total', (SELECT count(*) FROM scoped),
    'page', _p,
    'page_size', 25
  ) INTO _result;
  RETURN _result;
END $function$;

-- ───────────────────────── ficha do seller ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_staff_seller_detail(_seller uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _since timestamptz;
  _p public.profiles%ROWTYPE;
  _view boolean;
BEGIN
  IF app_private.staff_panel_role(_uid) IS NULL OR _seller IS NULL THEN RAISE EXCEPTION 'access denied'; END IF;
  _since := app_private.assignment_started_at(_uid, _seller);
  IF _since IS NULL THEN RAISE EXCEPTION 'access denied'; END IF;
  SELECT * INTO _p FROM public.profiles WHERE user_id = _seller;
  IF NOT FOUND THEN RAISE EXCEPTION 'seller not found'; END IF;
  _view := public.has_staff_permission(_uid, 'sellers.view');

  RETURN jsonb_build_object(
    'seller', jsonb_build_object(
      'user_id', _p.user_id, 'full_name', _p.full_name, 'email', _p.email,
      'phone', CASE WHEN _view THEN _p.phone END,
      'document_type', CASE WHEN _p.document_type = 'cnpj' THEN 'cnpj' ELSE 'cpf' END,
      'document_masked', CASE WHEN _view THEN _p.document_number_masked END,
      'account_status', _p.account_status, 'kyc_rejection_reason', _p.kyc_rejection_reason,
      'created_at', _p.created_at, 'last_login_at', CASE WHEN _view THEN _p.last_login_at END,
      'balance_frozen', COALESCE(_p.balance_frozen, false)
    ),
    'assigned_at', _since,
    'stats', (
      SELECT jsonb_build_object(
        'sales_count', count(*) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')),
        'volume', COALESCE(sum(t.amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')), 0),
        'net_volume', COALESCE(sum(t.net_amount) FILTER (WHERE t.status IN ('approved', 'paid', 'completed')), 0),
        'attempts', count(*),
        'last_sale_at', max(t.created_at) FILTER (WHERE t.status IN ('approved', 'paid', 'completed'))
      )
        FROM public.transactions t
       WHERE t.user_id = _seller AND t.created_at >= _since AND NOT COALESCE(t.is_simulated, false)
    ),
    'fees', CASE WHEN public.has_staff_permission(_uid, 'fees.edit') THEN COALESCE((
      SELECT jsonb_build_object('transaction_percentage', f.transaction_percentage, 'transaction_fixed', f.transaction_fixed,
                                'withdrawal_fee', f.withdrawal_fee, 'updated_at', f.updated_at, 'by_me', f.admin_user_id = _uid)
        FROM public.custom_user_fees f WHERE f.user_id = _seller), '{}'::jsonb) END,
    'withdrawal_block', CASE WHEN public.has_staff_permission(_uid, 'freeze_seller_withdrawals') OR public.has_staff_permission(_uid, 'withdrawals.view') THEN COALESCE((
      SELECT jsonb_build_object('active', b.active, 'reason', b.reason, 'updated_at', b.updated_at, 'by_me', b.blocked_by = _uid)
        FROM public.seller_withdrawal_blocks b WHERE b.seller_user_id = _seller), jsonb_build_object('active', false)) END,
    'withdrawals', CASE WHEN public.has_staff_permission(_uid, 'withdrawals.view') THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', w.id, 'amount', w.amount, 'status', w.status, 'created_at', w.created_at) ORDER BY w.created_at DESC)
        FROM (SELECT * FROM public.withdrawals WHERE user_id = _seller AND created_at >= _since ORDER BY created_at DESC LIMIT 10) w), '[]'::jsonb) END,
    'disputes', CASE WHEN public.has_staff_permission(_uid, 'disputes.view') THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'type', d.type, 'status', d.status, 'amount', d.amount, 'created_at', d.created_at,
                                          'response_deadline', d.response_deadline) ORDER BY d.created_at DESC)
        FROM (SELECT * FROM public.disputes WHERE seller_user_id = _seller AND created_at >= _since ORDER BY created_at DESC LIMIT 20) d), '[]'::jsonb) END,
    'notes', CASE WHEN public.has_staff_permission(_uid, 'sellers.edit') THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content, 'created_at', n.created_at, 'mine', n.author_user_id = _uid,
                                          'author', COALESCE(NULLIF(btrim(ap.full_name), ''), 'Equipe')) ORDER BY n.created_at DESC)
        FROM (SELECT * FROM public.seller_notes WHERE seller_user_id = _seller AND created_at >= _since ORDER BY created_at DESC LIMIT 50) n
        LEFT JOIN public.profiles ap ON ap.user_id = n.author_user_id), '[]'::jsonb) END
  );
END $function$;

CREATE OR REPLACE FUNCTION public.get_staff_seller_detail(_seller uuid)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_staff_seller_detail($1) $function$;

-- ───────────────────────── comissão: pedido de pagamento ─────────────────────────

CREATE OR REPLACE FUNCTION public.guard_commission_payout_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Quem pede só pede para si e só a equipe tem comissão.
  IF auth.uid() IS NULL OR NEW.staff_user_id IS DISTINCT FROM auth.uid() OR app_private.staff_panel_role(auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  NEW.status := 'pending';
  NEW.processed_by := NULL;
  NEW.processed_at := NULL;
  NEW.created_at := now();
  NEW.method := left(NULLIF(btrim(regexp_replace(COALESCE(NEW.method, ''), '[[:cntrl:]]+', ' ', 'g')), ''), 40);
  NEW.notes := left(NULLIF(btrim(regexp_replace(COALESCE(NEW.notes, ''), '[[:cntrl:]]+', ' ', 'g')), ''), 300);
  IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount <> round(NEW.amount, 2) THEN
    RAISE EXCEPTION 'invalid_payout_amount';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.staff_user_id::text));
  IF NEW.amount + COALESCE((SELECT sum(amount) FROM public.staff_commission_payouts
        WHERE staff_user_id = NEW.staff_user_id AND status = 'pending'), 0)
     > public.get_staff_commission_balance(NEW.staff_user_id) THEN
    RAISE EXCEPTION 'insufficient_commission_balance';
  END IF;
  RETURN NEW;
END $function$;

-- ───────────────────────── observações ─────────────────────────
-- A data da observação é a do servidor (a equipe mandava `created_at` à vontade e a regra de leitura
-- "observações feitas depois do vínculo" depende dela).
CREATE OR REPLACE FUNCTION app_private.guard_seller_notes_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT app_private.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.author_user_id := auth.uid();
    NEW.author_role := 'staff';
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END
$function$;

-- ───────────────────────── pedidos ao dono ─────────────────────────
-- Gerente só pede sobre seller da própria carteira (antes mirava qualquer conta e a mensagem "seller não
-- encontrado" dizia se um e-mail tinha conta). Motivo de 5 a 1000 caracteres, sem caracteres de controle.
CREATE OR REPLACE FUNCTION app_private.request_staff_action(_kind text, _target_seller uuid, _target_acquirer uuid, _payload jsonb, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _u uuid := auth.uid();
  _role text;
  _id uuid;
  _recent int;
  _seller uuid := _target_seller;
  _email text := lower(btrim(COALESCE(_payload->>'seller_email', '')));
  _r text := btrim(regexp_replace(COALESCE(_reason, ''), '[[:cntrl:]]+', ' ', 'g'));
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _u AND role::text IN ('partner','manager') ORDER BY role::text = 'partner' DESC LIMIT 1;
  IF _role IS NULL OR NOT app_private.has_financial_permission(_u,'request_actions') THEN RAISE EXCEPTION 'sem permissão para enviar pedidos'; END IF;
  IF _role = 'manager' AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _u AND frozen = true) THEN RAISE EXCEPTION 'sem permissão para enviar pedidos'; END IF;
  IF _kind NOT IN ('acquirer_change','acquirer_toggle','fee_change','seller_freeze','platform_setting','other') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF char_length(_r) < 5 OR char_length(_r) > 1000 THEN RAISE EXCEPTION 'motivo com 5 a 1000 caracteres'; END IF;
  SELECT count(*) INTO _recent FROM public.staff_action_requests WHERE requested_by = _u AND created_at > now() - interval '1 hour';
  IF _recent >= 30 THEN RAISE EXCEPTION 'muitos pedidos em sequência'; END IF;
  IF _seller IS NULL AND _email <> '' THEN
    SELECT user_id INTO _seller FROM public.profiles WHERE lower(email) = _email LIMIT 1;
    IF _seller IS NULL THEN RAISE EXCEPTION 'seller não encontrado'; END IF;
  END IF;
  IF _role = 'manager' AND _seller IS NOT NULL AND NOT app_private.has_active_seller_assignment(_u, _seller) THEN
    RAISE EXCEPTION 'seller fora da sua carteira';
  END IF;
  IF _kind IN ('acquirer_change','seller_freeze') AND _seller IS NULL THEN RAISE EXCEPTION 'informe o seller'; END IF;
  IF _kind IN ('acquirer_change','acquirer_toggle') AND (_target_acquirer IS NULL OR NOT EXISTS (SELECT 1 FROM public.acquirers WHERE id = _target_acquirer)) THEN RAISE EXCEPTION 'adquirente inválida'; END IF;
  INSERT INTO public.staff_action_requests(kind,target_seller_id,target_acquirer_id,payload,reason,requested_by,requested_role)
  VALUES (_kind,_seller,_target_acquirer,jsonb_build_object('seller_email',NULLIF(_email,''),'active',_payload->'active'),_r,_u,_role) RETURNING id INTO _id;
  INSERT INTO public.admin_alerts(kind,severity,message,metadata) VALUES ('staff_request','warning','Novo pedido da equipe aguardando aprovação', jsonb_build_object('request_id',_id,'kind',_kind,'role',_role));
  RETURN _id;
END $function$;

-- ───────────────────────── permissões ─────────────────────────

REVOKE ALL ON FUNCTION app_private.staff_panel_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.like_pattern(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.like_pattern(text) TO authenticated;
REVOKE ALL ON FUNCTION app_private.get_staff_portfolio_dashboard(timestamptz, timestamptz, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_staff_portfolio_transactions(timestamptz, timestamptz, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_staff_seller_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_staff_portfolio_dashboard(timestamptz, timestamptz, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_staff_portfolio_transactions(timestamptz, timestamptz, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_staff_seller_detail(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_staff_seller_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_seller_detail(uuid) TO authenticated;
