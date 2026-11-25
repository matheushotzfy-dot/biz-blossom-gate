-- Admin > Risco > Anti-Fraude: dados do banco inteiro, ações validadas no servidor e uma triagem única para o checkout.
--
-- O que estava errado:
--  * o radar de chargeback somava só as transações carregadas na tela (e misturava reembolso com chargeback);
--  * a blacklist não deixava bloquear de novo um valor removido (a restrição de unicidade barrava);
--  * check_blacklist comparava o BIN com os 6 primeiros dígitos do CPF (bloquearia CPFs inocentes e nunca um cartão);
--  * check_velocity contava por e-mail onde a regra diz IP, ignorava o valor mínimo e se realimentava do próprio log;
--  * nenhum código chamava essas funções: nada era bloqueado de verdade.
-- Agora existe uma função de triagem (app_private.screen_checkout_attempt) que o servidor de cobrança chama com a
-- service_role antes de cobrar. Ela registra o bloqueio no fraud_logs e devolve se pode seguir.

-- ───────────────────────── triagem ─────────────────────────

CREATE OR REPLACE FUNCTION public.check_blacklist(_email text DEFAULT NULL::text, _document text DEFAULT NULL::text, _ip text DEFAULT NULL::text)
 RETURNS TABLE(blocked boolean, block_reason text, matched_type text, matched_value text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := NULLIF(lower(btrim(COALESCE(_email, ''))), '');
  v_doc   text := NULLIF(regexp_replace(COALESCE(_document, ''), '\D', '', 'g'), '');
  v_ip    text := NULLIF(btrim(COALESCE(_ip, '')), '');
BEGIN
  IF v_ip IS NOT NULL THEN
    BEGIN v_ip := host(v_ip::inet); EXCEPTION WHEN others THEN v_ip := NULL; END;
  END IF;
  RETURN QUERY
  SELECT true,
         'Bloqueado pela Blacklist Global: ' || bl.entry_type || ' = ' || bl.entry_value,
         bl.entry_type,
         bl.entry_value
  FROM public.global_blacklist bl
  WHERE bl.is_active
    AND ((bl.entry_type = 'email' AND v_email IS NOT NULL AND lower(bl.entry_value) = v_email)
      OR (bl.entry_type IN ('cpf', 'cnpj') AND v_doc IS NOT NULL AND bl.entry_value = v_doc)
      OR (bl.entry_type = 'ip' AND v_ip IS NOT NULL AND bl.entry_value = v_ip))
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_velocity(_email text DEFAULT NULL::text, _ip text DEFAULT NULL::text, _rule_type text DEFAULT 'ip_card_fail'::text)
 RETURNS TABLE(blocked boolean, block_reason text, attempt_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rule record;
  _count bigint := 0;
  _since timestamptz;
  v_email text := NULLIF(lower(btrim(COALESCE(_email, ''))), '');
  v_ip text := NULLIF(btrim(COALESCE(_ip, '')), '');
BEGIN
  SELECT * INTO _rule FROM public.velocity_rules
  WHERE rule_type = _rule_type AND is_enabled
  ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ''::text, 0::bigint;
    RETURN;
  END IF;

  IF v_ip IS NOT NULL THEN
    BEGIN v_ip := host(v_ip::inet); EXCEPTION WHEN others THEN v_ip := NULL; END;
  END IF;
  _since := now() - make_interval(mins => _rule.time_window_minutes);

  IF _rule_type = 'ip_card_fail' AND (v_ip IS NOT NULL OR v_email IS NOT NULL) THEN
    SELECT count(*) INTO _count FROM public.transactions t
    WHERE t.is_simulated = false AND t.payment_method = 'credit_card'
      AND t.status IN ('failed', 'refused', 'rejected', 'error')
      AND t.created_at >= _since
      AND ((v_ip IS NOT NULL AND t.buyer_ip = v_ip) OR (v_email IS NOT NULL AND lower(t.customer_email) = v_email));
  ELSIF _rule_type = 'ip_attempts' AND v_ip IS NOT NULL THEN
    SELECT count(*) INTO _count FROM public.transactions t
    WHERE t.is_simulated = false AND t.buyer_ip = v_ip AND t.created_at >= _since;
  ELSIF _rule_type = 'email_high_value' AND v_email IS NOT NULL THEN
    SELECT count(*) INTO _count FROM public.transactions t
    WHERE t.is_simulated = false AND lower(t.customer_email) = v_email
      AND t.status IN ('pending', 'processing', 'waiting_payment', 'authorized', 'approved', 'paid', 'completed')
      AND t.amount >= COALESCE(_rule.threshold_amount, 0)
      AND t.created_at >= _since;
  END IF;

  IF _count >= _rule.max_attempts THEN
    RETURN QUERY SELECT true,
      format('Muitas tentativas: %s em %s min (limite: %s)', _count, _rule.time_window_minutes, _rule.max_attempts),
      _count;
  ELSE
    RETURN QUERY SELECT false, ''::text, _count;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_blacklist(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_velocity(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_blacklist(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_velocity(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION app_private.screen_checkout_attempt(
  _email text DEFAULT NULL::text, _document text DEFAULT NULL::text, _ip text DEFAULT NULL::text,
  _bin text DEFAULT NULL::text, _seller_user_id uuid DEFAULT NULL::uuid, _product_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := NULLIF(lower(btrim(COALESCE(_email, ''))), '');
  v_doc   text := NULLIF(regexp_replace(COALESCE(_document, ''), '\D', '', 'g'), '');
  v_ip    text := NULLIF(btrim(COALESCE(_ip, '')), '');
  v_bin   text := NULLIF(left(regexp_replace(COALESCE(_bin, ''), '\D', '', 'g'), 6), '');
  v_hit record;
  v_rule record;
  v_vel record;
  v_flagged jsonb := '[]'::jsonb;
  v_reason text;
BEGIN
  IF v_ip IS NOT NULL THEN
    BEGIN v_ip := host(v_ip::inet); EXCEPTION WHEN others THEN v_ip := NULL; END;
  END IF;

  SELECT bl.entry_type, bl.entry_value INTO v_hit
  FROM public.global_blacklist bl
  WHERE bl.is_active AND (
       (bl.entry_type = 'email' AND v_email IS NOT NULL AND lower(bl.entry_value) = v_email)
    OR (bl.entry_type IN ('cpf', 'cnpj') AND v_doc IS NOT NULL AND bl.entry_value = v_doc)
    OR (bl.entry_type = 'ip' AND v_ip IS NOT NULL AND bl.entry_value = v_ip)
    OR (bl.entry_type = 'bin' AND v_bin IS NOT NULL AND length(v_bin) = 6 AND bl.entry_value = v_bin))
  LIMIT 1;
  IF FOUND THEN
    v_reason := 'Bloqueado pela Blacklist Global: ' || v_hit.entry_type;
    INSERT INTO public.fraud_logs (block_type, block_reason, matched_type, matched_value, customer_email, customer_document, customer_ip, product_id, seller_user_id, metadata)
    VALUES ('blacklist', v_reason, v_hit.entry_type, v_hit.entry_value, v_email, v_doc, v_ip, _product_id, _seller_user_id, jsonb_build_object('action', 'block'));
    RETURN jsonb_build_object('blocked', true, 'source', 'blacklist', 'reason', v_reason);
  END IF;

  FOR v_rule IN
    SELECT * FROM public.velocity_rules
    WHERE is_enabled AND rule_type IN ('ip_card_fail', 'ip_attempts', 'email_high_value')
    ORDER BY created_at
  LOOP
    SELECT * INTO v_vel FROM public.check_velocity(v_email, v_ip, v_rule.rule_type);
    IF v_vel.blocked THEN
      INSERT INTO public.fraud_logs (block_type, block_reason, matched_type, matched_value, customer_email, customer_document, customer_ip, product_id, seller_user_id, metadata)
      VALUES ('velocity', v_vel.block_reason, v_rule.rule_type, v_rule.rule_name, v_email, v_doc, v_ip, _product_id, _seller_user_id,
              jsonb_build_object('action', CASE WHEN v_rule.action = 'block' THEN 'block' ELSE 'flag' END, 'rule_id', v_rule.id, 'attempts', v_vel.attempt_count));
      IF v_rule.action = 'block' THEN
        RETURN jsonb_build_object('blocked', true, 'source', 'velocity', 'reason', v_vel.block_reason);
      END IF;
      v_flagged := v_flagged || jsonb_build_array(jsonb_build_object('rule_type', v_rule.rule_type, 'reason', v_vel.block_reason));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('blocked', false, 'flagged', v_flagged);
END;
$function$;

REVOKE ALL ON FUNCTION app_private.screen_checkout_attempt(text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.screen_checkout_attempt(text, text, text, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.screen_checkout_attempt(
  _email text DEFAULT NULL::text, _document text DEFAULT NULL::text, _ip text DEFAULT NULL::text,
  _bin text DEFAULT NULL::text, _seller_user_id uuid DEFAULT NULL::uuid, _product_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.screen_checkout_attempt($1, $2, $3, $4, $5, $6)$function$;

REVOKE ALL ON FUNCTION public.screen_checkout_attempt(text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.screen_checkout_attempt(text, text, text, text, uuid, uuid) TO service_role;

-- ───────────────────────── radar de chargeback ─────────────────────────
-- Taxa = chargebacks / vendas pagas (aprovadas + estornadas + chargeback) na janela. Reembolso vai em coluna própria.
-- Quem tem menos de 10 vendas fica como "poucas vendas": 1 chargeback em 1 venda não é 100% de risco.

CREATE OR REPLACE FUNCTION app_private._antifraud_radar(_days integer DEFAULT 90)
RETURNS TABLE(user_id uuid, full_name text, email text, frozen boolean, sales bigint, chargebacks bigint, refunds bigint,
              chargeback_amount numeric, cb_rate numeric, refund_rate numeric, level text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH agg AS (
    SELECT t.user_id,
      count(*) FILTER (WHERE t.status IN ('approved','paid','completed','chargeback','chargedback','charged_back','refunded','partially_refunded')) AS sales,
      count(*) FILTER (WHERE t.status IN ('chargeback','chargedback','charged_back')) AS chargebacks,
      count(*) FILTER (WHERE t.status IN ('refunded','partially_refunded')) AS refunds,
      COALESCE(sum(t.amount) FILTER (WHERE t.status IN ('chargeback','chargedback','charged_back')), 0) AS chargeback_amount
    FROM public.transactions t
    WHERE t.is_simulated = false
      AND t.created_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(_days, 90), 7), 365))
    GROUP BY t.user_id
  ), r AS (
    SELECT a.*, a.chargebacks::numeric * 100 / NULLIF(a.sales, 0) AS raw_cb, a.refunds::numeric * 100 / NULLIF(a.sales, 0) AS raw_rf
    FROM agg a WHERE a.sales > 0
  )
  SELECT r.user_id, p.full_name, p.email, COALESCE(p.balance_frozen, false),
         r.sales, r.chargebacks, r.refunds, r.chargeback_amount,
         round(r.raw_cb, 2), round(r.raw_rf, 2),
         CASE WHEN r.sales < 10 THEN 'few' WHEN r.raw_cb > 1.5 THEN 'high' WHEN r.raw_cb > 0.5 THEN 'watch' ELSE 'ok' END
  FROM r LEFT JOIN public.profiles p ON p.user_id = r.user_id;
$function$;
REVOKE ALL ON FUNCTION app_private._antifraud_radar(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.get_admin_chargeback_radar(
  _days integer DEFAULT 90, _level text DEFAULT 'all', _search text DEFAULT NULL::text,
  _page integer DEFAULT 1, _page_size integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_page int := GREATEST(COALESCE(_page, 1), 1);
  v_like text := CASE WHEN NULLIF(trim(COALESCE(_search, '')), '') IS NULL THEN NULL
                      ELSE '%' || replace(replace(replace(trim(_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH base AS (
    SELECT * FROM app_private._antifraud_radar(_days) r
    WHERE v_like IS NULL OR COALESCE(r.full_name, '') ILIKE v_like OR COALESCE(r.email, '') ILIKE v_like
  ), filtered AS (
    SELECT * FROM base b WHERE _level IS NULL OR _level = 'all' OR b.level = _level
  ), paged AS (
    SELECT * FROM filtered f
    ORDER BY CASE f.level WHEN 'high' THEN 0 WHEN 'watch' THEN 1 WHEN 'ok' THEN 2 ELSE 3 END, f.cb_rate DESC, f.chargebacks DESC, f.user_id
    LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY CASE paged.level WHEN 'high' THEN 0 WHEN 'watch' THEN 1 WHEN 'ok' THEN 2 ELSE 3 END, paged.cb_rate DESC, paged.chargebacks DESC, paged.user_id) FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'summary', jsonb_build_object(
      'sellers', (SELECT count(*) FROM base),
      'high',    (SELECT count(*) FROM base b WHERE b.level = 'high'),
      'watch',   (SELECT count(*) FROM base b WHERE b.level = 'watch'),
      'ok',      (SELECT count(*) FROM base b WHERE b.level = 'ok'),
      'few',     (SELECT count(*) FROM base b WHERE b.level = 'few'),
      'sales',   COALESCE((SELECT sum(b.sales) FROM base b), 0),
      'chargebacks', COALESCE((SELECT sum(b.chargebacks) FROM base b), 0),
      'chargeback_amount', COALESCE((SELECT sum(b.chargeback_amount) FROM base b), 0)
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- ───────────────────────── blacklist ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_blacklist_page(
  _search text DEFAULT NULL::text, _type text DEFAULT 'all', _status text DEFAULT 'active',
  _page integer DEFAULT 1, _page_size integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_page int := GREATEST(COALESCE(_page, 1), 1);
  v_like text := CASE WHEN NULLIF(trim(COALESCE(_search, '')), '') IS NULL THEN NULL
                      ELSE '%' || replace(replace(replace(trim(_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH base AS (
    SELECT b.id, b.entry_type, b.entry_value, b.reason, b.is_active, b.created_at, b.updated_at,
           COALESCE(NULLIF(ap.full_name, ''), ap.email) AS added_by_name
    FROM public.global_blacklist b
    LEFT JOIN public.profiles ap ON ap.user_id = b.added_by
    WHERE (_type IS NULL OR _type = 'all' OR b.entry_type = _type)
      AND (v_like IS NULL OR b.entry_value ILIKE v_like OR b.reason ILIKE v_like)
  ), filtered AS (
    SELECT * FROM base b WHERE _status IS NULL OR _status = 'all' OR (_status = 'active' AND b.is_active) OR (_status = 'removed' AND NOT b.is_active)
  ), paged AS (
    SELECT * FROM filtered f ORDER BY f.is_active DESC, f.created_at DESC, f.id LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY paged.is_active DESC, paged.created_at DESC, paged.id) FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'summary', jsonb_build_object(
      'all',     (SELECT count(*) FROM base),
      'active',  (SELECT count(*) FROM base b WHERE b.is_active),
      'removed', (SELECT count(*) FROM base b WHERE NOT b.is_active)
    )
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_blacklist_add(_type text, _value text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid;
  v_type text := lower(btrim(COALESCE(_type, '')));
  v_val text := btrim(COALESCE(_value, ''));
  v_reason text := left(btrim(regexp_replace(COALESCE(_reason, ''), '[<>]', '', 'g')), 500);
  v_ip inet;
  v_full integer;
  v_id uuid;
  v_active boolean;
BEGIN
  _admin := app_private.assert_admin();
  IF v_type NOT IN ('cpf', 'cnpj', 'email', 'ip', 'bin') THEN RAISE EXCEPTION 'Tipo inválido.'; END IF;
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Explique o motivo (mínimo 3 caracteres).'; END IF;

  IF v_type = 'cpf' THEN
    v_val := regexp_replace(v_val, '\D', '', 'g');
    IF length(v_val) <> 11 THEN RAISE EXCEPTION 'O CPF precisa ter 11 dígitos.'; END IF;
  ELSIF v_type = 'cnpj' THEN
    v_val := regexp_replace(v_val, '\D', '', 'g');
    IF length(v_val) <> 14 THEN RAISE EXCEPTION 'O CNPJ precisa ter 14 dígitos.'; END IF;
  ELSIF v_type = 'bin' THEN
    v_val := regexp_replace(v_val, '\D', '', 'g');
    IF length(v_val) <> 6 THEN RAISE EXCEPTION 'O BIN precisa ter 6 dígitos.'; END IF;
  ELSIF v_type = 'email' THEN
    v_val := lower(v_val);
    IF v_val !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR length(v_val) > 254 THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;
  ELSE
    BEGIN v_ip := v_val::inet; EXCEPTION WHEN others THEN RAISE EXCEPTION 'IP inválido.'; END;
    v_full := (CASE WHEN family(v_ip) = 4 THEN 32 ELSE 128 END);
    IF masklen(v_ip) <> v_full THEN RAISE EXCEPTION 'Informe um IP único, sem faixa (/24).'; END IF;
    v_val := host(v_ip);
  END IF;

  SELECT id, is_active INTO v_id, v_active FROM public.global_blacklist WHERE entry_type = v_type AND entry_value = v_val FOR UPDATE;
  IF FOUND AND v_active THEN RAISE EXCEPTION 'Esse valor já está na blacklist.'; END IF;
  IF FOUND THEN
    UPDATE public.global_blacklist SET is_active = true, reason = v_reason, added_by = _admin, updated_at = now() WHERE id = v_id;
  ELSE
    INSERT INTO public.global_blacklist (entry_type, entry_value, reason, added_by) VALUES (v_type, v_val, v_reason, _admin) RETURNING id INTO v_id;
  END IF;
  PERFORM app_private.admin_audit(_admin, 'add_blacklist', 'global_blacklist', v_val,
    jsonb_build_object('entry_type', v_type, 'reason', v_reason, 'reactivated', v_active IS NOT NULL));
  RETURN jsonb_build_object('id', v_id, 'entry_type', v_type, 'entry_value', v_val, 'reactivated', v_active IS NOT NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_blacklist_remove(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid;
  v_reason text := left(btrim(regexp_replace(COALESCE(_reason, ''), '[<>]', '', 'g')), 500);
  v_row public.global_blacklist%ROWTYPE;
BEGIN
  _admin := app_private.assert_admin();
  PERFORM app_private.assert_recent_auth();
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Explique o motivo (mínimo 3 caracteres).'; END IF;
  SELECT * INTO v_row FROM public.global_blacklist WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF NOT v_row.is_active THEN RAISE EXCEPTION 'Essa entrada já foi removida.'; END IF;
  UPDATE public.global_blacklist SET is_active = false, updated_at = now() WHERE id = _id;
  PERFORM app_private.admin_audit(_admin, 'remove_blacklist', 'global_blacklist', v_row.entry_value,
    jsonb_build_object('entry_type', v_row.entry_type, 'reason', v_reason));
END;
$function$;

-- ───────────────────────── velocity ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_update_velocity_rule(
  _id uuid, _enabled boolean, _max_attempts integer, _window_minutes integer, _threshold numeric, _action text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid;
  v_before public.velocity_rules%ROWTYPE;
  v_action text := CASE WHEN _action = 'block' THEN 'block' ELSE 'flag' END;
  v_thr numeric;
BEGIN
  _admin := app_private.assert_admin();
  PERFORM app_private.assert_recent_auth();
  IF _max_attempts IS NULL OR _max_attempts < 1 OR _max_attempts > 1000 THEN RAISE EXCEPTION 'O máximo de tentativas deve ficar entre 1 e 1000.'; END IF;
  IF _window_minutes IS NULL OR _window_minutes < 1 OR _window_minutes > 10080 THEN RAISE EXCEPTION 'A janela deve ficar entre 1 minuto e 7 dias.'; END IF;
  IF _action NOT IN ('block', 'flag', 'notify') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
  SELECT * INTO v_before FROM public.velocity_rules WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Regra não encontrada.'; END IF;
  v_thr := CASE WHEN v_before.rule_type = 'email_high_value' THEN _threshold ELSE NULL END;
  IF v_thr IS NOT NULL AND (v_thr < 0 OR v_thr > 100000000) THEN RAISE EXCEPTION 'Valor mínimo inválido.'; END IF;
  UPDATE public.velocity_rules
     SET is_enabled = COALESCE(_enabled, is_enabled), max_attempts = _max_attempts, time_window_minutes = _window_minutes,
         threshold_amount = v_thr, action = v_action, updated_by = _admin, updated_at = now()
   WHERE id = _id;
  PERFORM app_private.admin_audit(_admin, 'update_velocity_rule', 'velocity_rules', _id::text, jsonb_build_object(
    'rule_name', v_before.rule_name,
    'before', jsonb_build_object('enabled', v_before.is_enabled, 'max_attempts', v_before.max_attempts, 'window_minutes', v_before.time_window_minutes, 'threshold', v_before.threshold_amount, 'action', v_before.action),
    'after', jsonb_build_object('enabled', COALESCE(_enabled, v_before.is_enabled), 'max_attempts', _max_attempts, 'window_minutes', _window_minutes, 'threshold', v_thr, 'action', v_action)));
  RETURN (SELECT to_jsonb(r) FROM public.velocity_rules r WHERE r.id = _id);
END;
$function$;

-- ───────────────────────── trilha de bloqueios ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_fraud_trail(
  _search text DEFAULT NULL::text, _type text DEFAULT 'all', _page integer DEFAULT 1, _page_size integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_page int := GREATEST(COALESCE(_page, 1), 1);
  v_like text := CASE WHEN NULLIF(trim(COALESCE(_search, '')), '') IS NULL THEN NULL
                      ELSE '%' || replace(replace(replace(trim(_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH base AS (
    SELECT f.id, f.created_at, f.block_type, f.block_reason, f.matched_type, f.matched_value, f.customer_email,
           CASE WHEN f.customer_document IS NULL THEN NULL ELSE '***' || right(f.customer_document, 4) END AS customer_document,
           f.customer_ip, f.seller_user_id,
           COALESCE(NULLIF(sp.full_name, ''), sp.email) AS seller_name, pr.name AS product_name,
           CASE WHEN f.metadata->>'action' = 'flag' THEN 'flagged' ELSE 'blocked' END AS outcome
    FROM public.fraud_logs f
    LEFT JOIN public.profiles sp ON sp.user_id = f.seller_user_id
    LEFT JOIN public.products pr ON pr.id = f.product_id
    WHERE v_like IS NULL OR COALESCE(f.customer_email, '') ILIKE v_like OR COALESCE(f.customer_ip, '') ILIKE v_like
       OR f.block_reason ILIKE v_like OR COALESCE(f.matched_value, '') ILIKE v_like OR COALESCE(sp.full_name, '') ILIKE v_like
  ), filtered AS (
    SELECT * FROM base b WHERE _type IS NULL OR _type = 'all' OR b.block_type = _type
  ), paged AS (
    SELECT * FROM filtered f ORDER BY f.created_at DESC, f.id LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY paged.created_at DESC, paged.id) FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'summary', jsonb_build_object(
      'all',       (SELECT count(*) FROM base),
      'blacklist', (SELECT count(*) FROM base b WHERE b.block_type = 'blacklist'),
      'velocity',  (SELECT count(*) FROM base b WHERE b.block_type = 'velocity'),
      'manual',    (SELECT count(*) FROM base b WHERE b.block_type = 'manual'),
      'today',     (SELECT count(*) FROM base b WHERE b.created_at >= v_day_start AND b.outcome = 'blocked')
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- ───────────────────────── resumo do topo ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_antifraud_overview(_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'blacklist_active', (SELECT count(*) FROM public.global_blacklist WHERE is_active),
    'rules_enabled',    (SELECT count(*) FROM public.velocity_rules WHERE is_enabled),
    'rules_total',      (SELECT count(*) FROM public.velocity_rules),
    'blocked_today',    (SELECT count(*) FROM public.fraud_logs WHERE created_at >= v_day_start AND COALESCE(metadata->>'action', 'block') <> 'flag'),
    'sellers_high',     (SELECT count(*) FROM app_private._antifraud_radar(_days) r WHERE r.level = 'high'),
    'sellers_watch',    (SELECT count(*) FROM app_private._antifraud_radar(_days) r WHERE r.level = 'watch')
  );
END;
$function$;

-- ───────────────────────── permissões e wrappers públicos ─────────────────────────

REVOKE ALL ON FUNCTION app_private.get_admin_chargeback_radar(integer, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_blacklist_page(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_blacklist_add(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_blacklist_remove(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_update_velocity_rule(uuid, boolean, integer, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_fraud_trail(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_antifraud_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_chargeback_radar(integer, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_blacklist_page(text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_blacklist_add(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_blacklist_remove(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_update_velocity_rule(uuid, boolean, integer, integer, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_fraud_trail(text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_antifraud_overview(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_chargeback_radar(_days integer DEFAULT 90, _level text DEFAULT 'all', _search text DEFAULT NULL::text, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_chargeback_radar($1, $2, $3, $4, $5)$function$;
CREATE OR REPLACE FUNCTION public.get_admin_blacklist_page(_search text DEFAULT NULL::text, _type text DEFAULT 'all', _status text DEFAULT 'active', _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_blacklist_page($1, $2, $3, $4, $5)$function$;
CREATE OR REPLACE FUNCTION public.admin_blacklist_add(_type text, _value text, _reason text)
RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.admin_blacklist_add($1, $2, $3)$function$;
CREATE OR REPLACE FUNCTION public.admin_blacklist_remove(_id uuid, _reason text)
RETURNS void LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.admin_blacklist_remove($1, $2)$function$;
CREATE OR REPLACE FUNCTION public.admin_update_velocity_rule(_id uuid, _enabled boolean, _max_attempts integer, _window_minutes integer, _threshold numeric, _action text)
RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.admin_update_velocity_rule($1, $2, $3, $4, $5, $6)$function$;
CREATE OR REPLACE FUNCTION public.get_admin_fraud_trail(_search text DEFAULT NULL::text, _type text DEFAULT 'all', _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_fraud_trail($1, $2, $3, $4)$function$;
CREATE OR REPLACE FUNCTION public.get_admin_antifraud_overview(_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_antifraud_overview($1)$function$;

REVOKE ALL ON FUNCTION public.get_admin_chargeback_radar(integer, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_blacklist_page(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_blacklist_add(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_blacklist_remove(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_velocity_rule(uuid, boolean, integer, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_fraud_trail(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_antifraud_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_chargeback_radar(integer, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_blacklist_page(text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_blacklist_add(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_blacklist_remove(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_velocity_rule(uuid, boolean, integer, integer, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_fraud_trail(text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_antifraud_overview(integer) TO authenticated, service_role;
