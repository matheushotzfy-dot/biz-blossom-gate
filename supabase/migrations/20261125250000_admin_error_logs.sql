-- Admin › Error Logs: o registro de erros do site passa a funcionar para todo mundo, e a aba lê e escreve só por RPC.
--
-- Antes: o navegador gravava direto em `error_logs`, mas a única policy de escrita era "Admins can manage error logs".
-- Ou seja, só o admin conseguia registrar erro: um vendedor, um aluno ou um comprador que tomava a tela "Algo deu errado"
-- não deixava rastro (os 1.512 registros que existiam eram todos de uma conta só, a do admin). Além disso o admin apagava
-- e resolvia registros direto pela API, sem senha nem auditoria, e a tela somava tudo no navegador (últimos 1000).
--
-- Agora: `log_client_error` (chamável por visitante e por logado) valida, limpa dados sensíveis, junta repetições do mesmo
-- erro numa linha só (contador de ocorrências) e limita o volume; a leitura e as ações do admin são RPCs.

-- ───────────────────────── colunas ─────────────────────────

ALTER TABLE public.error_logs
  ADD COLUMN IF NOT EXISTS fingerprint  text,
  ADD COLUMN IF NOT EXISTS occurrences  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by  uuid;

-- ───────────────────────── funções auxiliares ─────────────────────────

-- Tira o que não deve ficar em log: tokens, chaves, parâmetros sensíveis de URL, e-mails e CPF/CNPJ.
CREATE OR REPLACE FUNCTION app_private.redact_text(_t text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
DECLARE o text := COALESCE(_t, '');
BEGIN
  o := regexp_replace(o, '\mey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', '[JWT_REDACTED]', 'g');
  o := regexp_replace(o, '(Bearer\s+)[A-Za-z0-9._~+/=-]+', '\1[REDACTED]', 'gi');
  o := regexp_replace(o, '\m(sk|pk|whsec|sbp)_[A-Za-z0-9]{16,}', '[SECRET_REDACTED]', 'g');
  o := regexp_replace(o, '([?&#])(access_token|refresh_token|token|apikey|api_key|key|password|secret|code|authorization|auth|__lovable_token)=[^&#\s]*', '\1\2=[REDACTED]', 'gi');
  o := regexp_replace(o, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL]', 'g');
  o := regexp_replace(o, '\m\d{3}\.?\d{3}\.?\d{3}-?\d{2}\M', '[CPF]', 'g');
  o := regexp_replace(o, '\m\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\M', '[CNPJ]', 'g');
  RETURN o;
END $function$;

-- Identifica "o mesmo erro": mensagem e primeiros passos da pilha, sem números (ids, linhas, horários variam).
CREATE OR REPLACE FUNCTION app_private.error_fingerprint(_msg text, _stack text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT md5(regexp_replace(COALESCE(_msg, ''), '\d+', '#', 'g') || '|'
          || regexp_replace(split_part(COALESCE(_stack, ''), E'\n', 1) || split_part(COALESCE(_stack, ''), E'\n', 2), '\d+', '#', 'g'));
$$;

-- Caminho (sem query) da página onde o erro aconteceu: `route` nos registros novos, `url` nos antigos.
CREATE OR REPLACE FUNCTION app_private.error_route(_meta jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT NULLIF(COALESCE(NULLIF(_meta ->> 'route', ''), substring(COALESCE(_meta ->> 'url', '') from '^https?://[^/]+(/[^?#]*)')), '');
$$;

-- Parte do site: sai só do caminho, nunca de palavras da mensagem.
CREATE OR REPLACE FUNCTION app_private.error_area(_route text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _route IS NULL OR _route = '' THEN 'unknown'
    WHEN _route ~ '^/(pay|checkout|pl|obrigado)(/|$)' THEN 'checkout'
    WHEN _route ~ '^/(membros-area|membros|certificado)(/|$)' THEN 'member'
    WHEN _route ~ '^/(admin-matheus|gerentes|socio)(/|$)' THEN 'staff'
    WHEN _route ~ '^/(auth|impersonate-receiver)(/|$)' THEN 'auth'
    WHEN _route ~ '^/(termos-de-uso|politica-de-privacidade|status|documentacao|docs)?/?$' THEN 'site'
    ELSE 'seller'
  END;
$$;

-- Backfill: registros que já existiam.
UPDATE public.error_logs
   SET last_seen_at = COALESCE(last_seen_at, created_at),
       fingerprint  = COALESCE(fingerprint, app_private.error_fingerprint(message, stack_trace))
 WHERE last_seen_at IS NULL OR fingerprint IS NULL;

ALTER TABLE public.error_logs ALTER COLUMN last_seen_at SET DEFAULT now();
ALTER TABLE public.error_logs ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE public.error_logs DROP CONSTRAINT IF EXISTS error_logs_occurrences_chk;
ALTER TABLE public.error_logs ADD CONSTRAINT error_logs_occurrences_chk CHECK (occurrences >= 1);

CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON public.error_logs (fingerprint, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_status_seen ON public.error_logs (resolved, last_seen_at DESC);

-- ───────────────────────── permissões da tabela ─────────────────────────

-- Toda escrita passa pelas funções abaixo; o admin só lê (uma policy, não três).
DROP POLICY IF EXISTS "Admins can manage error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Admins read error logs" ON public.error_logs;
REVOKE ALL ON public.error_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.error_logs FROM authenticated;

-- ───────────────────────── registro do erro (visitante e logado) ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.log_client_error(_message text, _stack text DEFAULT NULL, _context text DEFAULT NULL, _route text DEFAULT NULL, _ua text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_msg   text := left(btrim(app_private.redact_text(COALESCE(_message, ''))), 500);
  v_stack text := NULLIF(left(btrim(app_private.redact_text(COALESCE(_stack, ''))), 2000), '');
  v_ctx   text := NULLIF(left(btrim(app_private.redact_text(COALESCE(_context, ''))), 300), '');
  v_route text := NULLIF(left(regexp_replace(COALESCE(_route, ''), '[?#].*$', ''), 200), '');
  v_ua    text := NULLIF(left(btrim(COALESCE(_ua, '')), 200), '');
  v_fp    text;
  v_id    uuid;
BEGIN
  IF v_msg = '' THEN RETURN false; END IF;
  IF v_route IS NOT NULL AND left(v_route, 1) <> '/' THEN v_route := NULL; END IF;
  v_route := NULLIF(app_private.redact_text(v_route), '');
  v_fp := app_private.error_fingerprint(v_msg, v_stack);

  -- Duas chamadas do mesmo erro ao mesmo tempo não criam duas linhas.
  PERFORM pg_advisory_xact_lock(hashtext(v_fp));

  -- O mesmo erro nas últimas 24 h só soma uma ocorrência (e reabre, se já tinha sido resolvido).
  SELECT id INTO v_id FROM public.error_logs WHERE fingerprint = v_fp AND last_seen_at > now() - interval '24 hours' ORDER BY last_seen_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.error_logs
       SET occurrences = LEAST(occurrences + 1, 1000000), last_seen_at = now(),
           resolved = false, resolved_at = NULL, resolved_by = NULL
     WHERE id = v_id;
    RETURN true;
  END IF;

  -- Erro novo: limite de volume, para ninguém encher a tabela. Passou do limite, descarta sem avisar o navegador.
  IF (SELECT count(*) FROM public.error_logs WHERE created_at > now() - interval '1 minute') >= 20 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.error_logs WHERE created_at > now() - interval '1 hour') >= 300 THEN RETURN false; END IF;
  IF v_uid IS NOT NULL AND (SELECT count(*) FROM public.error_logs WHERE user_id = v_uid AND created_at > now() - interval '1 minute') >= 5 THEN RETURN false; END IF;

  INSERT INTO public.error_logs (error_type, message, stack_trace, user_id, metadata, fingerprint)
  VALUES ('client_error', v_msg, v_stack, v_uid,
          jsonb_strip_nulls(jsonb_build_object('context', v_ctx, 'route', v_route, 'ua', v_ua)), v_fp);
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.log_client_error(_message text, _stack text DEFAULT NULL, _context text DEFAULT NULL, _route text DEFAULT NULL, _ua text DEFAULT NULL)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.log_client_error(_message, _stack, _context, _route, _ua); $$;

REVOKE ALL ON FUNCTION app_private.log_client_error(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_client_error(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.log_client_error(text, text, text, text, text), public.log_client_error(text, text, text, text, text) TO anon, authenticated, service_role;

-- ───────────────────────── lista ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_error_logs_page(
  _status text DEFAULT 'open', _area text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text := COALESCE(NULLIF(btrim(COALESCE(_status, '')), ''), 'open');
  v_area   text := NULLIF(NULLIF(btrim(COALESCE(_area, '')), ''), 'all');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_ps     int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_day    timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_out    jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_status NOT IN ('open', 'resolved', 'all') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_area IS NOT NULL AND v_area NOT IN ('checkout', 'member', 'staff', 'auth', 'site', 'seller', 'unknown') THEN RAISE EXCEPTION 'área inválida'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT e.id, e.error_type, e.message, e.user_id, e.occurrences, e.created_at, e.last_seen_at, e.resolved, e.resolved_at,
           e.metadata ->> 'context' AS context, app_private.error_route(e.metadata) AS route,
           app_private.error_area(app_private.error_route(e.metadata)) AS area,
           pr.full_name AS user_name, pr.email AS user_email
      FROM public.error_logs e
      LEFT JOIN public.profiles pr ON pr.user_id = e.user_id
     WHERE v_q IS NULL
        OR e.message ILIKE v_pat OR COALESCE(e.stack_trace, '') ILIKE v_pat OR e.error_type ILIKE v_pat
        OR COALESCE(e.metadata ->> 'route', e.metadata ->> 'url', '') ILIKE v_pat
        OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat OR e.id::text ILIKE v_pat
  ),
  by_status AS (SELECT * FROM base WHERE v_status = 'all' OR (v_status = 'open' AND NOT resolved) OR (v_status = 'resolved' AND resolved)),
  filt AS (SELECT * FROM by_status WHERE v_area IS NULL OR area = v_area),
  paged AS (SELECT f.*, row_number() OVER (ORDER BY f.resolved, f.last_seen_at DESC, f.id) AS rn FROM filt f),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'error_type', p.error_type, 'message', p.message, 'route', p.route, 'area', p.area, 'context', p.context,
        'user_id', p.user_id, 'user_name', NULLIF(btrim(COALESCE(p.user_name, '')), ''), 'user_email', p.user_email,
        'occurrences', p.occurrences, 'created_at', p.created_at, 'last_seen_at', p.last_seen_at,
        'resolved', p.resolved, 'resolved_at', p.resolved_at) ORDER BY p.rn) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*), 'open', count(*) FILTER (WHERE NOT resolved), 'resolved', count(*) FILTER (WHERE resolved))
      FROM base WHERE v_area IS NULL OR area = v_area),
    'areas', COALESCE((SELECT jsonb_object_agg(a.area, a.n) FROM (SELECT area, count(*) AS n FROM by_status GROUP BY area) a), '{}'::jsonb),
    'program', (SELECT jsonb_build_object(
        'open', count(*) FILTER (WHERE NOT resolved),
        'resolved', count(*) FILTER (WHERE resolved),
        'total', count(*),
        'seen_last_hour', count(*) FILTER (WHERE last_seen_at > now() - interval '1 hour'),
        'seen_today', count(*) FILTER (WHERE last_seen_at >= v_day),
        'occurrences_open', COALESCE(sum(occurrences) FILTER (WHERE NOT resolved), 0),
        'affected_users', count(DISTINCT user_id) FILTER (WHERE NOT resolved AND user_id IS NOT NULL),
        'oldest_open', min(created_at) FILTER (WHERE NOT resolved),
        'oldest', min(created_at),
        'size_bytes', pg_total_relation_size('public.error_logs')
      ) FROM public.error_logs),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── raio-X ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_error_log_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  e public.error_logs%ROWTYPE;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO e FROM public.error_logs WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'registro não encontrado'; END IF;
  RETURN jsonb_build_object(
    'id', e.id, 'error_type', e.error_type, 'message', e.message, 'stack_trace', e.stack_trace, 'metadata', COALESCE(e.metadata, '{}'::jsonb),
    'route', app_private.error_route(e.metadata), 'area', app_private.error_area(app_private.error_route(e.metadata)),
    'occurrences', e.occurrences, 'created_at', e.created_at, 'last_seen_at', e.last_seen_at,
    'resolved', e.resolved, 'resolved_at', e.resolved_at,
    'resolved_by', (SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email) FROM public.profiles p WHERE p.user_id = e.resolved_by),
    'user', CASE WHEN e.user_id IS NULL THEN NULL ELSE (SELECT jsonb_build_object('user_id', e.user_id,
        'name', COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email, 'Conta sem nome'), 'email', p.email, 'account_status', p.account_status)
      FROM (SELECT 1) z LEFT JOIN public.profiles p ON p.user_id = e.user_id) END);
END
$function$;

-- ───────────────────────── ações ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_error_resolved(_id uuid, _resolved boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_now   boolean;
BEGIN
  IF _resolved IS NULL THEN RAISE EXCEPTION 'informe o que fazer com o erro'; END IF;
  SELECT resolved INTO v_now FROM public.error_logs WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'registro não encontrado'; END IF;
  IF v_now = _resolved THEN RAISE EXCEPTION 'o erro já está %', CASE WHEN _resolved THEN 'resolvido' ELSE 'aberto' END; END IF;
  UPDATE public.error_logs
     SET resolved = _resolved, resolved_at = CASE WHEN _resolved THEN now() END, resolved_by = CASE WHEN _resolved THEN v_admin END
   WHERE id = _id;
  RETURN jsonb_build_object('id', _id, 'resolved', _resolved);
END
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_resolve_all_errors(_area text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_area  text := NULLIF(NULLIF(btrim(COALESCE(_area, '')), ''), 'all');
  v_n     int;
BEGIN
  IF v_area IS NOT NULL AND v_area NOT IN ('checkout', 'member', 'staff', 'auth', 'site', 'seller', 'unknown') THEN RAISE EXCEPTION 'área inválida'; END IF;
  UPDATE public.error_logs
     SET resolved = true, resolved_at = now(), resolved_by = v_admin
   WHERE NOT resolved AND (v_area IS NULL OR app_private.error_area(app_private.error_route(metadata)) = v_area);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'nenhum erro aberto'; END IF;
  PERFORM app_private.admin_audit(v_admin, 'error_logs_resolve_all', 'error_logs', 'bulk', jsonb_build_object('count', v_n, 'area', v_area));
  RETURN jsonb_build_object('resolved', v_n);
END
$function$;

-- Só apaga o que já foi resolvido (erro aberto some só depois de resolvido, em dois passos de propósito).
CREATE OR REPLACE FUNCTION app_private.admin_delete_error_logs(_scope text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin  uuid := app_private.assert_admin();
  v_scope  text := btrim(COALESCE(_scope, ''));
  v_reason text := btrim(COALESCE(_reason, ''));
  v_n      int;
BEGIN
  IF v_scope NOT IN ('resolved', 'resolved_old') THEN RAISE EXCEPTION 'escolha o que apagar'; END IF;
  IF length(v_reason) < 5 THEN RAISE EXCEPTION 'informe o motivo (mínimo 5 caracteres)'; END IF;
  IF length(v_reason) > 1000 THEN RAISE EXCEPTION 'motivo muito longo'; END IF;
  DELETE FROM public.error_logs
   WHERE resolved AND (v_scope = 'resolved' OR last_seen_at < now() - interval '30 days');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'nenhum registro para apagar'; END IF;
  PERFORM app_private.admin_audit(v_admin, 'error_logs_delete', 'error_logs', 'bulk', jsonb_build_object('scope', v_scope, 'reason', v_reason, 'deleted', v_n));
  RETURN jsonb_build_object('deleted', v_n);
END
$function$;

-- ───────────────────────── wrappers públicos ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_error_logs_page(_status text DEFAULT 'open', _area text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_error_logs_page(_status, _area, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_error_log_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_error_log_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_set_error_resolved(_id uuid, _resolved boolean)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_error_resolved(_id, _resolved); $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_all_errors(_area text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_resolve_all_errors(_area); $$;

CREATE OR REPLACE FUNCTION public.admin_delete_error_logs(_scope text, _reason text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_delete_error_logs(_scope, _reason); END $$;

-- ───────────────────────── permissões das funções ─────────────────────────

REVOKE ALL ON FUNCTION app_private.redact_text(text), app_private.error_fingerprint(text, text), app_private.error_route(jsonb), app_private.error_area(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.redact_text(text), app_private.error_fingerprint(text, text), app_private.error_route(jsonb), app_private.error_area(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION app_private.get_admin_error_logs_page(text, text, text, integer, integer), app_private.get_admin_error_log_detail(uuid),
  app_private.admin_set_error_resolved(uuid, boolean), app_private.admin_resolve_all_errors(text), app_private.admin_delete_error_logs(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_error_logs_page(text, text, text, integer, integer), public.get_admin_error_log_detail(uuid),
  public.admin_set_error_resolved(uuid, boolean), public.admin_resolve_all_errors(text), public.admin_delete_error_logs(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_error_logs_page(text, text, text, integer, integer), app_private.get_admin_error_log_detail(uuid),
  app_private.admin_set_error_resolved(uuid, boolean), app_private.admin_resolve_all_errors(text), app_private.admin_delete_error_logs(text, text),
  public.get_admin_error_logs_page(text, text, text, integer, integer), public.get_admin_error_log_detail(uuid),
  public.admin_set_error_resolved(uuid, boolean), public.admin_resolve_all_errors(text), public.admin_delete_error_logs(text, text) TO authenticated, service_role;
