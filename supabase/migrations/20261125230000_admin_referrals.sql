-- Admin › Indicações: leitura por RPC, ações da equipe (qualificar, pagar, recusar, cancelar, registrar) e
-- fechamento da brecha de escrita do cliente.
--
-- Hoje o programa de indicação é só uma tabela: nenhuma tela do seller cria indicação, nada qualifica nem paga, e o
-- cadastro só guarda "onde conheceu" como texto solto. A aba antiga só listava. Pior: a policy de INSERT confere apenas
-- `referrer_user_id = auth.uid()`, então qualquer usuário logado inseria uma indicação já como "paga", com
-- `reward_amount` qualquer, `paid_at` preenchido e `referred_user_id` de quem quisesse. Nada consome esses valores hoje,
-- mas a primeira rotina de pagamento que existir pagaria o que o cliente escreveu.

-- ───────────────────────── regras do banco ─────────────────────────

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_chk;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_status_chk CHECK (status IN ('pending', 'qualified', 'paid', 'rejected', 'cancelled'));
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_reward_chk;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_reward_chk CHECK (reward_amount >= 0 AND reward_amount <= 10000);
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_paid_at_chk;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_paid_at_chk CHECK ((status = 'paid') = (paid_at IS NOT NULL));
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_not_self_chk;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_not_self_chk CHECK (referred_user_id IS NULL OR referred_user_id <> referrer_user_id);

-- Uma indicação válida por pessoa indicada (recusada ou cancelada libera o e-mail para outra indicação).
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_one_active_per_person
  ON public.referrals (lower(referred_email)) WHERE status IN ('pending', 'qualified', 'paid');
CREATE INDEX IF NOT EXISTS idx_referrals_status_created ON public.referrals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_user_id, created_at DESC);

-- Quem não é admin só cria indicação "pendente", com a recompensa padrão, sem pagamento e sem usuário indicado; não
-- indica o próprio e-mail, não passa de 20 por dia e não altera nem apaga. Admin e service_role passam direto.
CREATE OR REPLACE FUNCTION app_private.guard_referrals_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  _own text;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF TG_OP <> 'DELETE' THEN NEW.referred_email := lower(btrim(NEW.referred_email)); END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Uma indicação não pode ser apagada.' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Só a equipe altera uma indicação.' USING ERRCODE = '42501'; END IF;

  NEW.referrer_user_id := auth.uid();
  NEW.status := 'pending';
  NEW.reward_amount := 50.00;
  NEW.paid_at := NULL;
  NEW.referred_user_id := NULL;
  NEW.referred_email := lower(btrim(COALESCE(NEW.referred_email, '')));
  IF length(NEW.referred_email) > 254 OR NEW.referred_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para indicar.' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email) INTO _own FROM public.profiles WHERE user_id = auth.uid();
  IF NEW.referred_email = COALESCE(_own, '') THEN
    RAISE EXCEPTION 'Você não pode indicar o seu próprio e-mail.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.referrals WHERE referrer_user_id = auth.uid() AND created_at > now() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 indicações por dia atingido. Tente de novo amanhã.' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_referrals_write ON public.referrals;
CREATE TRIGGER guard_referrals_write BEFORE INSERT OR UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_referrals_write();

-- ───────────────────────── lista ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_referrals_page(
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
  IF v_filter NOT IN ('all', 'pending', 'qualified', 'paid', 'rejected', 'cancelled') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT r.id, r.referrer_user_id, rp.full_name AS referrer_name, rp.email AS referrer_email,
           r.referred_email, r.referred_user_id, r.reward_amount, r.status, r.paid_at, r.created_at, r.updated_at
      FROM public.referrals r
      LEFT JOIN public.profiles rp ON rp.user_id = r.referrer_user_id
     WHERE v_q IS NULL
        OR r.referred_email ILIKE v_pat OR COALESCE(rp.full_name, '') ILIKE v_pat OR COALESCE(rp.email, '') ILIKE v_pat OR r.id::text ILIKE v_pat
  ),
  filt AS (SELECT * FROM base WHERE v_filter = 'all' OR status = v_filter),
  paged AS (
    SELECT f.*, row_number() OVER (
      ORDER BY CASE f.status WHEN 'qualified' THEN 0 WHEN 'pending' THEN 1 WHEN 'paid' THEN 2 ELSE 3 END, f.created_at DESC, f.id) AS rn
      FROM filt f
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'referrer_user_id', p.referrer_user_id,
        'referrer_name', COALESCE(NULLIF(btrim(COALESCE(p.referrer_name, '')), ''), p.referrer_email, 'Seller sem nome'), 'referrer_email', p.referrer_email,
        'referred_email', p.referred_email, 'referred_user_id', acc.user_id, 'referred_name', acc.full_name,
        'reward_amount', p.reward_amount, 'status', p.status, 'paid_at', p.paid_at, 'created_at', p.created_at, 'updated_at', p.updated_at,
        'account_before', (acc.created_at IS NOT NULL AND acc.created_at < p.created_at)
      ) ORDER BY p.rn)
      FROM page p
      LEFT JOIN LATERAL (
        SELECT pr.user_id, pr.full_name, pr.created_at FROM public.profiles pr
         WHERE pr.user_id = p.referred_user_id OR lower(pr.email) = lower(p.referred_email)
         ORDER BY (pr.user_id = p.referred_user_id) DESC NULLS LAST LIMIT 1) acc ON true), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*),
        'pending', count(*) FILTER (WHERE status = 'pending'),
        'qualified', count(*) FILTER (WHERE status = 'qualified'),
        'paid', count(*) FILTER (WHERE status = 'paid'),
        'rejected', count(*) FILTER (WHERE status = 'rejected'),
        'cancelled', count(*) FILTER (WHERE status = 'cancelled')
      ) FROM base),
    'program', (SELECT jsonb_build_object(
        'total', count(*),
        'referrers', count(DISTINCT referrer_user_id),
        'pending', count(*) FILTER (WHERE status = 'pending'),
        'qualified', count(*) FILTER (WHERE status = 'qualified'),
        'paid', count(*) FILTER (WHERE status = 'paid'),
        'owed', COALESCE(sum(reward_amount) FILTER (WHERE status = 'qualified'), 0),
        'expected', COALESCE(sum(reward_amount) FILTER (WHERE status = 'pending'), 0),
        'paid_amount', COALESCE(sum(reward_amount) FILTER (WHERE status = 'paid'), 0)
      ) FROM public.referrals),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── raio-X ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_referral_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.referrals%ROWTYPE;
  _acc uuid;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO r FROM public.referrals WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'indicação não encontrada'; END IF;
  SELECT pr.user_id INTO _acc FROM public.profiles pr
   WHERE pr.user_id = r.referred_user_id OR lower(pr.email) = lower(r.referred_email)
   ORDER BY (pr.user_id = r.referred_user_id) DESC NULLS LAST LIMIT 1;

  RETURN jsonb_build_object(
    'referral', jsonb_build_object('id', r.id, 'referred_email', r.referred_email, 'status', r.status, 'reward_amount', r.reward_amount,
                                    'paid_at', r.paid_at, 'created_at', r.created_at, 'updated_at', r.updated_at, 'linked', r.referred_user_id IS NOT NULL),
    'referrer', (SELECT jsonb_build_object('user_id', r.referrer_user_id,
        'name', COALESCE(NULLIF(btrim(COALESCE(pr.full_name, '')), ''), pr.email, 'Seller sem nome'), 'email', pr.email,
        'account_status', pr.account_status, 'created_at', pr.created_at,
        'referrals', (SELECT count(*) FROM public.referrals x WHERE x.referrer_user_id = r.referrer_user_id),
        'paid', (SELECT count(*) FROM public.referrals x WHERE x.referrer_user_id = r.referrer_user_id AND x.status = 'paid'),
        'rejected', (SELECT count(*) FROM public.referrals x WHERE x.referrer_user_id = r.referrer_user_id AND x.status IN ('rejected', 'cancelled')))
      FROM (SELECT 1) z LEFT JOIN public.profiles pr ON pr.user_id = r.referrer_user_id),
    'referred', CASE WHEN _acc IS NULL THEN NULL ELSE (SELECT jsonb_build_object('user_id', pr.user_id,
        'name', COALESCE(NULLIF(btrim(COALESCE(pr.full_name, '')), ''), pr.email, 'Conta sem nome'), 'account_status', pr.account_status,
        'created_at', pr.created_at, 'last_login_at', pr.last_login_at,
        'same_as_referrer', pr.user_id = r.referrer_user_id,
        'sales', (SELECT count(*) FROM public.transactions t WHERE t.user_id = pr.user_id AND t.status IN ('approved', 'paid', 'completed') AND NOT COALESCE(t.is_simulated, false)),
        'volume', (SELECT COALESCE(sum(t.amount), 0) FROM public.transactions t WHERE t.user_id = pr.user_id AND t.status IN ('approved', 'paid', 'completed') AND NOT COALESCE(t.is_simulated, false)))
      FROM public.profiles pr WHERE pr.user_id = _acc) END,
    'others', COALESCE((SELECT jsonb_agg(o ORDER BY o.created_at DESC) FROM (
        SELECT x.id, x.status, x.created_at, COALESCE(NULLIF(btrim(COALESCE(xp.full_name, '')), ''), xp.email, 'Seller sem nome') AS referrer_name
          FROM public.referrals x LEFT JOIN public.profiles xp ON xp.user_id = x.referrer_user_id
         WHERE lower(x.referred_email) = lower(r.referred_email) AND x.id <> r.id ORDER BY x.created_at DESC LIMIT 10) o), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT a.id, a.action, a.created_at, a.details, NULLIF(COALESCE(ap.full_name, ap.email), '') AS admin_name
          FROM public.audit_logs a LEFT JOIN public.profiles ap ON ap.user_id = a.admin_user_id
         WHERE a.entity_type = 'referral' AND a.entity_id = r.id::text
         ORDER BY a.created_at DESC LIMIT 20) h), '[]'::jsonb)
  );
END
$function$;

-- ───────────────────────── mudar o status ─────────────────────────

-- pendente → qualificada | recusada | cancelada; qualificada → paga | recusada | cancelada; o resto é final.
-- "Paga" só registra o pagamento (paid_at): nada é creditado no saldo, não existe rotina de pagamento de indicação.
CREATE OR REPLACE FUNCTION app_private.admin_set_referral_status(_id uuid, _status text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _to text := btrim(COALESCE(_status, ''));
  r public.referrals%ROWTYPE;
  _acc uuid;
  _title text;
  _msg text;
BEGIN
  IF _id IS NULL THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF _to NOT IN ('qualified', 'paid', 'rejected', 'cancelled') THEN RAISE EXCEPTION 'status inválido'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO r FROM public.referrals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'indicação não encontrada'; END IF;
  IF r.status = _to THEN RAISE EXCEPTION 'a indicação já está nesse status'; END IF;
  IF r.status IN ('paid', 'rejected', 'cancelled') THEN RAISE EXCEPTION 'esta indicação já foi encerrada e não muda mais'; END IF;
  IF r.status = 'pending' AND _to = 'paid' THEN RAISE EXCEPTION 'qualifique a indicação antes de registrar o pagamento'; END IF;

  IF _to = 'qualified' THEN
    SELECT pr.user_id INTO _acc FROM public.profiles pr
     WHERE pr.user_id = r.referred_user_id OR lower(pr.email) = lower(r.referred_email)
     ORDER BY (pr.user_id = r.referred_user_id) DESC NULLS LAST LIMIT 1;
    IF _acc IS NULL THEN RAISE EXCEPTION 'o indicado ainda não tem conta na plataforma'; END IF;
    IF _acc = r.referrer_user_id THEN RAISE EXCEPTION 'o indicado é o próprio indicador'; END IF;
    UPDATE public.referrals SET status = 'qualified', referred_user_id = _acc WHERE id = _id;
    _title := 'Indicação qualificada';
    _msg := format('Sua indicação de %s foi qualificada. Recompensa prevista: R$ %s.', r.referred_email, to_char(r.reward_amount, 'FM999G990D00'));
  ELSIF _to = 'paid' THEN
    UPDATE public.referrals SET status = 'paid', paid_at = now() WHERE id = _id;
    _title := 'Recompensa de indicação paga';
    _msg := format('A equipe registrou o pagamento da recompensa de R$ %s pela indicação de %s.', to_char(r.reward_amount, 'FM999G990D00'), r.referred_email);
  ELSIF _to = 'rejected' THEN
    UPDATE public.referrals SET status = 'rejected' WHERE id = _id;
    _title := 'Indicação recusada';
    _msg := format('A equipe recusou a indicação de %s. Motivo: %s', r.referred_email, _r);
  ELSE
    UPDATE public.referrals SET status = 'cancelled' WHERE id = _id;
    _title := 'Indicação cancelada';
    _msg := format('A equipe cancelou a indicação de %s. Motivo: %s', r.referred_email, _r);
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type) VALUES (r.referrer_user_id, _title, _msg, 'referral');
  PERFORM app_private.admin_audit(_admin, 'referral_' || _to, 'referral', _id::text,
    jsonb_build_object('reason', _r, 'previous_status', r.status, 'reward', r.reward_amount, 'referred_email', r.referred_email));
  RETURN jsonb_build_object('id', _id, 'status', _to);
END
$function$;

-- ───────────────────────── registrar indicação ─────────────────────────

-- O seller não tem tela para indicar: a equipe registra quando alguém avisa que indicou.
CREATE OR REPLACE FUNCTION app_private.admin_create_referral(_referrer uuid, _email text, _reward numeric, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _e text := lower(btrim(COALESCE(_email, '')));
  _amt numeric := COALESCE(_reward, 50.00);
  _own text;
  _new uuid;
BEGIN
  IF _referrer IS NULL THEN RAISE EXCEPTION 'escolha quem indicou'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  IF length(_e) > 254 OR _e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'informe um e-mail válido'; END IF;
  IF _amt < 0 OR _amt > 10000 THEN RAISE EXCEPTION 'a recompensa deve ficar entre R$ 0 e R$ 10.000'; END IF;
  SELECT lower(email) INTO _own FROM public.profiles WHERE user_id = _referrer;
  IF NOT FOUND THEN RAISE EXCEPTION 'quem indicou não foi encontrado'; END IF;
  IF _e = COALESCE(_own, '') THEN RAISE EXCEPTION 'o indicado não pode ser o próprio indicador'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE lower(referred_email) = _e AND status IN ('pending', 'qualified', 'paid')) THEN
    RAISE EXCEPTION 'esse e-mail já tem uma indicação ativa';
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_email, reward_amount, status)
  VALUES (_referrer, _e, round(_amt, 2), 'pending') RETURNING id INTO _new;
  PERFORM app_private.admin_audit(_admin, 'referral_create', 'referral', _new::text,
    jsonb_build_object('reason', _r, 'referrer', _referrer, 'referred_email', _e, 'reward', round(_amt, 2)));
  RETURN jsonb_build_object('id', _new, 'status', 'pending');
END
$function$;

-- ───────────────────────── wrappers públicos e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_referrals_page(_filter text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_referrals_page(_filter, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_referral_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_referral_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_set_referral_status(_id uuid, _status text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_referral_status(_id, _status, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_create_referral(_referrer uuid, _email text, _reward numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_create_referral(_referrer, _email, _reward, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_referrals_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_referral_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_referral_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_create_referral(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_referrals_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_referral_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_referral_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_referral(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_referrals_page(text, text, integer, integer), app_private.get_admin_referral_detail(uuid),
  app_private.admin_set_referral_status(uuid, text, text), app_private.admin_create_referral(uuid, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_referrals_page(text, text, integer, integer), public.get_admin_referral_detail(uuid),
  public.admin_set_referral_status(uuid, text, text), public.admin_create_referral(uuid, text, numeric, text) TO authenticated, service_role;

-- ───────────────────────── busca de seller (para "Registrar indicação") ─────────────────────────

-- Até 8 contas por nome ou e-mail, direto no banco: o seletor antigo lia só os 2000 perfis mais novos.
CREATE OR REPLACE FUNCTION app_private.admin_search_sellers(_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_q   text := NULLIF(btrim(COALESCE(_query, '')), '');
  v_pat text;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_q IS NULL OR length(v_q) < 2 THEN RETURN '[]'::jsonb; END IF;
  IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', COALESCE(NULLIF(btrim(COALESCE(s.full_name, '')), ''), s.email, 'Seller sem nome'), 'email', s.email) ORDER BY s.created_at DESC)
    FROM (SELECT p.user_id, p.full_name, p.email, p.created_at FROM public.profiles p
           WHERE COALESCE(p.full_name, '') ILIKE v_pat OR COALESCE(p.email, '') ILIKE v_pat
           ORDER BY p.created_at DESC LIMIT 8) s), '[]'::jsonb);
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_search_sellers(_query text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_search_sellers(_query); $$;

REVOKE ALL ON FUNCTION app_private.admin_search_sellers(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_search_sellers(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.admin_search_sellers(text), public.admin_search_sellers(text) TO authenticated, service_role;
