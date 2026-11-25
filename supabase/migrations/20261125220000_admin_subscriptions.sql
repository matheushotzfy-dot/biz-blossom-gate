-- Admin › Assinaturas: leitura por RPC (assinaturas, planos, raio-X) e duas ações da equipe:
-- pausar/liberar um plano e cancelar uma assinatura.
--
-- A aba antiga lia `subscriptions` direto no navegador (sem plano, sem preço, sem ciclos, busca só por assinante) e
-- listava status que a tabela não aceita ("expired", "cancelled"). Hoje ninguém consegue encerrar uma assinatura:
-- seller e assinante só têm SELECT. E apagar um plano apagava, em cascata, todas as assinaturas e ciclos dele.

-- ───────────────────────── pausa de plano pela equipe ─────────────────────────

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS admin_hold_reason text,
  ADD COLUMN IF NOT EXISTS admin_hold_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_seller ON public.subscriptions (seller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_user ON public.subscription_plans (user_id, created_at DESC);

-- Quem não é admin não mexe na pausa, não reativa plano pausado e não apaga plano pausado ou com assinantes
-- (apagar leva as assinaturas e os ciclos junto, por ON DELETE CASCADE).
CREATE OR REPLACE FUNCTION app_private.guard_subscription_plans_admin_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.admin_hold_at IS NOT NULL THEN
      RAISE EXCEPTION 'A equipe pausou este plano e ele só sai com a liberação do suporte.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE plan_id = OLD.id) THEN
      RAISE EXCEPTION 'Este plano tem assinantes e não pode ser apagado. Pause o plano em vez disso.' USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'A equipe pausou este plano e ele só volta com a liberação do suporte.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_subscription_plans_admin_hold ON public.subscription_plans;
CREATE TRIGGER guard_subscription_plans_admin_hold BEFORE INSERT OR UPDATE OR DELETE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_subscription_plans_admin_hold();

-- Preço do plano convertido para "por mês" (estimativa: dia = 30 dias, semana = 52/12 do mês).
CREATE OR REPLACE FUNCTION app_private.plan_monthly_value(_price numeric, _interval text, _count integer)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT round(COALESCE(_price, 0) / GREATEST(COALESCE(_count, 1), 1) * CASE _interval
    WHEN 'daily' THEN 30 WHEN 'weekly' THEN 52.0 / 12 WHEN 'monthly' THEN 1 WHEN 'yearly' THEN 1.0 / 12 ELSE 0 END, 2);
$$;

-- ───────────────────────── lista de assinaturas ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_subscriptions_page(
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
  IF v_filter NOT IN ('all', 'active', 'trial', 'late', 'paused', 'canceled') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT s.id, s.subscriber_name, s.subscriber_email, s.status, s.billing_method, s.cancel_at_period_end,
           s.completed_cycles, s.max_cycles, s.next_charge_at, s.last_payment_at, s.current_period_end, s.trial_end, s.canceled_at, s.created_at,
           s.plan_id, p.name AS plan_name, p.price AS plan_price, p."interval" AS plan_interval, p.interval_count AS plan_interval_count,
           (p.admin_hold_at IS NOT NULL) AS plan_held,
           s.seller_user_id, pr.full_name AS seller_name, pr.email AS seller_email,
           app_private.plan_monthly_value(p.price, p."interval", p.interval_count) AS monthly
      FROM public.subscriptions s
      JOIN public.subscription_plans p ON p.id = s.plan_id
      LEFT JOIN public.profiles pr ON pr.user_id = s.seller_user_id
     WHERE v_q IS NULL
        OR COALESCE(s.subscriber_name, '') ILIKE v_pat OR s.subscriber_email ILIKE v_pat OR p.name ILIKE v_pat
        OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat OR s.id::text ILIKE v_pat
  ),
  filt AS (
    SELECT * FROM base
     WHERE v_filter = 'all'
        OR (v_filter = 'active' AND status = 'active')
        OR (v_filter = 'trial' AND status = 'trialing')
        OR (v_filter = 'late' AND status = 'past_due')
        OR (v_filter = 'paused' AND status = 'paused')
        OR (v_filter = 'canceled' AND status = 'canceled')
  ),
  paged AS (
    SELECT f.*, row_number() OVER (ORDER BY CASE WHEN f.status = 'past_due' THEN 0 ELSE 1 END, f.created_at DESC, f.id) AS rn FROM filt f
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'subscriber_name', p.subscriber_name, 'subscriber_email', p.subscriber_email, 'status', p.status, 'billing_method', p.billing_method,
        'cancel_at_period_end', p.cancel_at_period_end, 'completed_cycles', p.completed_cycles, 'max_cycles', p.max_cycles,
        'next_charge_at', p.next_charge_at, 'last_payment_at', p.last_payment_at, 'current_period_end', p.current_period_end, 'trial_end', p.trial_end,
        'canceled_at', p.canceled_at, 'created_at', p.created_at,
        'plan_id', p.plan_id, 'plan_name', p.plan_name, 'plan_price', p.plan_price, 'plan_interval', p.plan_interval, 'plan_interval_count', p.plan_interval_count, 'plan_held', p.plan_held,
        'seller_user_id', p.seller_user_id, 'seller_name', COALESCE(NULLIF(btrim(COALESCE(p.seller_name, '')), ''), p.seller_email, 'Seller sem nome'), 'seller_email', p.seller_email,
        'monthly', p.monthly
      ) ORDER BY p.rn) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*),
        'active', count(*) FILTER (WHERE status = 'active'),
        'trial', count(*) FILTER (WHERE status = 'trialing'),
        'late', count(*) FILTER (WHERE status = 'past_due'),
        'paused', count(*) FILTER (WHERE status = 'paused'),
        'canceled', count(*) FILTER (WHERE status = 'canceled')
      ) FROM base),
    'program', jsonb_build_object(
        'plans', (SELECT count(*) FROM public.subscription_plans),
        'plans_live', (SELECT count(*) FROM public.subscription_plans WHERE is_active AND admin_hold_at IS NULL),
        'plans_held', (SELECT count(*) FROM public.subscription_plans WHERE admin_hold_at IS NOT NULL),
        'subs', (SELECT count(*) FROM public.subscriptions),
        'active', (SELECT count(*) FROM public.subscriptions WHERE status = 'active'),
        'trial', (SELECT count(*) FROM public.subscriptions WHERE status = 'trialing'),
        'late', (SELECT count(*) FROM public.subscriptions WHERE status = 'past_due'),
        'canceled', (SELECT count(*) FROM public.subscriptions WHERE status = 'canceled'),
        'monthly', (SELECT COALESCE(sum(app_private.plan_monthly_value(p.price, p."interval", p.interval_count)), 0)
                      FROM public.subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.status = 'active'),
        'paid_cycles', (SELECT count(*) FROM public.subscription_cycles WHERE status = 'paid'),
        'paid_amount', (SELECT COALESCE(sum(amount), 0) FROM public.subscription_cycles WHERE status = 'paid')),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── lista de planos ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_subscription_plans_page(
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
  IF v_filter NOT IN ('all', 'live', 'paused', 'held') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH sc AS (
    SELECT plan_id AS pid, count(*) AS subs,
           count(*) FILTER (WHERE status = 'active') AS active, count(*) FILTER (WHERE status = 'trialing') AS trial,
           count(*) FILTER (WHERE status = 'past_due') AS late, count(*) FILTER (WHERE status = 'paused') AS paused,
           count(*) FILTER (WHERE status = 'canceled') AS canceled
      FROM public.subscriptions GROUP BY 1
  ),
  base AS (
    SELECT p.id, p.name, p.price, p."interval", p.interval_count, p.trial_days, p.is_active, p.admin_hold_reason, p.admin_hold_at, p.created_at,
           p.product_id, pd.name AS product_name, (pd.deleted_at IS NOT NULL) AS product_deleted,
           p.user_id AS seller_user_id, pr.full_name AS seller_name, pr.email AS seller_email,
           COALESCE(sc.subs, 0) AS subs, COALESCE(sc.active, 0) AS active, COALESCE(sc.trial, 0) AS trial, COALESCE(sc.late, 0) AS late,
           COALESCE(sc.paused, 0) AS paused, COALESCE(sc.canceled, 0) AS canceled,
           COALESCE(sc.active, 0) * app_private.plan_monthly_value(p.price, p."interval", p.interval_count) AS monthly
      FROM public.subscription_plans p
      LEFT JOIN sc ON sc.pid = p.id
      LEFT JOIN public.products pd ON pd.id = p.product_id
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
     WHERE v_q IS NULL
        OR p.name ILIKE v_pat OR COALESCE(pd.name, '') ILIKE v_pat
        OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat OR p.id::text ILIKE v_pat
  ),
  filt AS (
    SELECT * FROM base
     WHERE v_filter = 'all'
        OR (v_filter = 'live' AND is_active AND admin_hold_at IS NULL)
        OR (v_filter = 'paused' AND NOT is_active AND admin_hold_at IS NULL)
        OR (v_filter = 'held' AND admin_hold_at IS NOT NULL)
  ),
  paged AS (
    SELECT f.*, row_number() OVER (ORDER BY f.subs DESC, f.created_at DESC, f.id) AS rn FROM filt f
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price, 'interval', p."interval", 'interval_count', p.interval_count, 'trial_days', p.trial_days,
        'is_active', p.is_active, 'hold_reason', p.admin_hold_reason, 'hold_at', p.admin_hold_at, 'created_at', p.created_at,
        'product_id', p.product_id, 'product_name', p.product_name, 'product_deleted', p.product_deleted,
        'seller_user_id', p.seller_user_id, 'seller_name', COALESCE(NULLIF(btrim(COALESCE(p.seller_name, '')), ''), p.seller_email, 'Seller sem nome'), 'seller_email', p.seller_email,
        'subs', p.subs, 'active', p.active, 'trial', p.trial, 'late', p.late, 'paused', p.paused, 'canceled', p.canceled, 'monthly', p.monthly
      ) ORDER BY p.rn) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*),
        'live', count(*) FILTER (WHERE is_active AND admin_hold_at IS NULL),
        'paused', count(*) FILTER (WHERE NOT is_active AND admin_hold_at IS NULL),
        'held', count(*) FILTER (WHERE admin_hold_at IS NOT NULL)
      ) FROM base),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── raio-X da assinatura ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_subscription_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.subscriptions%ROWTYPE;
  p public.subscription_plans%ROWTYPE;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO s FROM public.subscriptions WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'assinatura não encontrada'; END IF;
  SELECT * INTO p FROM public.subscription_plans WHERE id = s.plan_id;

  RETURN jsonb_build_object(
    'subscription', jsonb_build_object(
      'id', s.id, 'subscriber_name', s.subscriber_name, 'subscriber_email', s.subscriber_email, 'has_account', s.subscriber_user_id IS NOT NULL,
      'status', s.status, 'billing_method', s.billing_method, 'cancel_at_period_end', s.cancel_at_period_end,
      'completed_cycles', s.completed_cycles, 'max_cycles', s.max_cycles, 'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
      'trial_end', s.trial_end, 'canceled_at', s.canceled_at, 'next_charge_at', s.next_charge_at, 'last_payment_at', s.last_payment_at, 'created_at', s.created_at),
    'plan', jsonb_build_object(
      'id', p.id, 'name', p.name, 'price', p.price, 'interval', p."interval", 'interval_count', p.interval_count, 'trial_days', p.trial_days,
      'is_active', p.is_active, 'hold_reason', p.admin_hold_reason, 'hold_at', p.admin_hold_at,
      'product_id', p.product_id, 'product_name', (SELECT pd.name FROM public.products pd WHERE pd.id = p.product_id)),
    'seller', (SELECT jsonb_build_object('user_id', s.seller_user_id,
        'name', COALESCE(NULLIF(btrim(COALESCE(pr.full_name, '')), ''), pr.email, 'Seller sem nome'), 'email', pr.email, 'account_status', pr.account_status)
      FROM (SELECT 1) x LEFT JOIN public.profiles pr ON pr.user_id = s.seller_user_id),
    'stats', (SELECT jsonb_build_object(
        'cycles', count(*), 'paid', count(*) FILTER (WHERE status = 'paid'), 'failed', count(*) FILTER (WHERE status = 'failed'),
        'overdue', count(*) FILTER (WHERE status = 'overdue'),
        'paid_amount', COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0),
        'monthly', app_private.plan_monthly_value(p.price, p."interval", p.interval_count))
      FROM public.subscription_cycles c WHERE c.subscription_id = s.id),
    'cycles', COALESCE((SELECT jsonb_agg(c ORDER BY c.cycle_number DESC) FROM (
        SELECT id, cycle_number, due_at, amount, status, attempt_count, last_attempt_at, paid_at, (transaction_id IS NOT NULL) AS has_transaction
          FROM public.subscription_cycles WHERE subscription_id = s.id ORDER BY cycle_number DESC LIMIT 36) c), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT a.id, a.action, a.created_at, a.details, NULLIF(COALESCE(ap.full_name, ap.email), '') AS admin_name
          FROM public.audit_logs a LEFT JOIN public.profiles ap ON ap.user_id = a.admin_user_id
         WHERE a.entity_type = 'subscription' AND a.entity_id = s.id::text
         ORDER BY a.created_at DESC LIMIT 20) h), '[]'::jsonb)
  );
END
$function$;

-- ───────────────────────── raio-X do plano ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_subscription_plan_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.subscription_plans%ROWTYPE;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO p FROM public.subscription_plans WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plano não encontrado'; END IF;

  RETURN jsonb_build_object(
    'plan', jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description, 'price', p.price, 'interval', p."interval", 'interval_count', p.interval_count,
      'trial_days', p.trial_days, 'is_active', p.is_active, 'hold_reason', p.admin_hold_reason, 'hold_at', p.admin_hold_at, 'created_at', p.created_at),
    'product', (SELECT jsonb_build_object('id', pd.id, 'name', pd.name, 'status', pd.status, 'deleted', pd.deleted_at IS NOT NULL)
                  FROM public.products pd WHERE pd.id = p.product_id),
    'seller', (SELECT jsonb_build_object('user_id', p.user_id,
        'name', COALESCE(NULLIF(btrim(COALESCE(pr.full_name, '')), ''), pr.email, 'Seller sem nome'), 'email', pr.email, 'account_status', pr.account_status)
      FROM (SELECT 1) x LEFT JOIN public.profiles pr ON pr.user_id = p.user_id),
    'stats', (SELECT jsonb_build_object(
        'subs', count(*), 'active', count(*) FILTER (WHERE status = 'active'), 'trial', count(*) FILTER (WHERE status = 'trialing'),
        'late', count(*) FILTER (WHERE status = 'past_due'), 'paused', count(*) FILTER (WHERE status = 'paused'), 'canceled', count(*) FILTER (WHERE status = 'canceled'),
        'monthly', count(*) FILTER (WHERE status = 'active') * app_private.plan_monthly_value(p.price, p."interval", p.interval_count),
        'paid_amount', COALESCE((SELECT sum(c.amount) FROM public.subscription_cycles c JOIN public.subscriptions x ON x.id = c.subscription_id
                                  WHERE x.plan_id = p.id AND c.status = 'paid'), 0))
      FROM public.subscriptions s WHERE s.plan_id = p.id),
    'subscriptions', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT id, subscriber_name, subscriber_email, status, completed_cycles, created_at
          FROM public.subscriptions WHERE plan_id = p.id ORDER BY created_at DESC LIMIT 20) x), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT a.id, a.action, a.created_at, a.details, NULLIF(COALESCE(ap.full_name, ap.email), '') AS admin_name
          FROM public.audit_logs a LEFT JOIN public.profiles ap ON ap.user_id = a.admin_user_id
         WHERE a.entity_type = 'subscription_plan' AND a.entity_id = p.id::text
         ORDER BY a.created_at DESC LIMIT 20) h), '[]'::jsonb)
  );
END
$function$;

-- ───────────────────────── pausar / liberar plano ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_plan_hold(_plan_id uuid, _hold boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  p public.subscription_plans%ROWTYPE;
BEGIN
  IF _hold IS NULL OR _plan_id IS NULL THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO p FROM public.subscription_plans WHERE id = _plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plano não encontrado'; END IF;

  IF _hold THEN
    IF p.admin_hold_at IS NOT NULL THEN RAISE EXCEPTION 'este plano já está pausado pela equipe'; END IF;
    UPDATE public.subscription_plans SET is_active = false, admin_hold_reason = _r, admin_hold_at = now() WHERE id = _plan_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p.user_id, 'Plano de assinatura pausado', format('A equipe pausou o plano "%s". Motivo: %s', p.name, _r), 'subscription');
    PERFORM app_private.admin_audit(_admin, 'plan_hold', 'subscription_plan', _plan_id::text, jsonb_build_object('reason', _r, 'plan', p.name));
  ELSE
    IF p.admin_hold_at IS NULL THEN RAISE EXCEPTION 'este plano não está pausado pela equipe'; END IF;
    UPDATE public.subscription_plans SET admin_hold_reason = NULL, admin_hold_at = NULL WHERE id = _plan_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p.user_id, 'Plano de assinatura liberado', format('A equipe liberou o plano "%s". Reative quando quiser.', p.name), 'subscription');
    PERFORM app_private.admin_audit(_admin, 'plan_release', 'subscription_plan', _plan_id::text,
      jsonb_build_object('reason', _r, 'previous_reason', p.admin_hold_reason, 'plan', p.name));
  END IF;
  RETURN jsonb_build_object('plan_id', _plan_id, 'held', _hold);
END
$function$;

-- ───────────────────────── cancelar assinatura ─────────────────────────

-- Encerra a assinatura e os ciclos que ainda não foram pagos. Não desfaz Pix já gerado e não devolve dinheiro.
CREATE OR REPLACE FUNCTION app_private.admin_cancel_subscription(_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  s public.subscriptions%ROWTYPE;
  _plan text;
  _n int;
BEGIN
  IF _id IS NULL THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO s FROM public.subscriptions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assinatura não encontrada'; END IF;
  IF s.status = 'canceled' THEN RAISE EXCEPTION 'esta assinatura já está cancelada'; END IF;
  SELECT name INTO _plan FROM public.subscription_plans WHERE id = s.plan_id;

  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now(), cancel_at_period_end = false, next_charge_at = NULL
   WHERE id = _id;
  WITH u AS (
    UPDATE public.subscription_cycles SET status = 'canceled'
     WHERE subscription_id = _id AND status IN ('scheduled', 'pending', 'overdue') RETURNING 1)
  SELECT count(*) INTO _n FROM u;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (s.seller_user_id, 'Assinatura cancelada pela equipe',
          format('A equipe cancelou a assinatura de %s no plano "%s". Motivo: %s', COALESCE(NULLIF(btrim(COALESCE(s.subscriber_name, '')), ''), s.subscriber_email), COALESCE(_plan, 'plano'), _r),
          'subscription');
  IF s.subscriber_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (s.subscriber_user_id, 'Assinatura cancelada', format('Sua assinatura do plano "%s" foi cancelada e não haverá novas cobranças.', COALESCE(_plan, 'plano')), 'subscription');
  END IF;
  PERFORM app_private.admin_audit(_admin, 'subscription_cancel', 'subscription', _id::text,
    jsonb_build_object('reason', _r, 'previous_status', s.status, 'cycles_canceled', _n, 'plan', _plan));
  RETURN jsonb_build_object('id', _id, 'status', 'canceled', 'cycles_canceled', _n);
END
$function$;

-- ───────────────────────── wrappers públicos e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_subscriptions_page(_filter text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_subscriptions_page(_filter, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_subscription_plans_page(_filter text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_subscription_plans_page(_filter, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_subscription_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_subscription_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.get_admin_subscription_plan_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_subscription_plan_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_set_plan_hold(_plan_id uuid, _hold boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_plan_hold(_plan_id, _hold, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_cancel_subscription(_id, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.plan_monthly_value(numeric, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_subscriptions_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_subscription_plans_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_subscription_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_subscription_plan_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_plan_hold(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_cancel_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_subscriptions_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_subscription_plans_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_subscription_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_subscription_plan_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_plan_hold(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.plan_monthly_value(numeric, text, integer), app_private.get_admin_subscriptions_page(text, text, integer, integer),
  app_private.get_admin_subscription_plans_page(text, text, integer, integer), app_private.get_admin_subscription_detail(uuid),
  app_private.get_admin_subscription_plan_detail(uuid), app_private.admin_set_plan_hold(uuid, boolean, text),
  app_private.admin_cancel_subscription(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_subscriptions_page(text, text, integer, integer), public.get_admin_subscription_plans_page(text, text, integer, integer),
  public.get_admin_subscription_detail(uuid), public.get_admin_subscription_plan_detail(uuid),
  public.admin_set_plan_hold(uuid, boolean, text), public.admin_cancel_subscription(uuid, text) TO authenticated, service_role;
