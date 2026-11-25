-- Admin › Abuso & Auth
--  • resumo por janela (com a série por hora já completa, sem buraco), IPs mais ativos e o que está em espera agora;
--  • bloquear um IP à mão e liberar bloqueio ou login travado, sempre com motivo e auditoria;
--  • "login travado" = o limite de tentativas do gated-login (5 senhas erradas por e-mail e 20 por IP, em janelas de 15 min),
--    que fica em api_rate_limit_buckets e a tela antiga nunca mostrava. Se mudar RATE_LIMIT_MAX_FAILS (5) ou o limite de IP (20)
--    na função gated-login, mude os dois números em app_private._login_lockouts.

-- Logins travados agora (só leitura; usada pelas outras funções, nunca exposta ao cliente).
CREATE OR REPLACE FUNCTION app_private._login_lockouts()
RETURNS TABLE(kind text, scope text, email text, ip_hash text, fails integer, resets_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'email'::text,
         (regexp_match(b.bucket_key, '^gated_login_email:([^:]+):(.+)$'))[1],
         (regexp_match(b.bucket_key, '^gated_login_email:([^:]+):(.+)$'))[2],
         NULL::text, b.count, b.window_start + interval '15 minutes'
    FROM public.api_rate_limit_buckets b
   WHERE b.bucket_key ~ '^gated_login_email:[^:]+:.+$'
     AND b.window_start + interval '15 minutes' > now() AND b.count >= 5
  UNION ALL
  SELECT 'ip'::text, NULL::text, NULL::text,
         left(encode(sha256(convert_to(substr(b.bucket_key, 16), 'UTF8')), 'hex'), 32), b.count, b.window_start + interval '15 minutes'
    FROM public.api_rate_limit_buckets b
   WHERE b.bucket_key LIKE 'gated\_login\_ip:%'
     AND b.window_start + interval '15 minutes' > now() AND b.count >= 20;
$function$;
REVOKE ALL ON FUNCTION app_private._login_lockouts() FROM PUBLIC, anon, authenticated;

-- ───────────────────────── resumo ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_abuse_overview(_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hours int := LEAST(GREATEST(COALESCE(_hours, 24), 1), 720);
  v_from timestamptz := now() - make_interval(hours => LEAST(GREATEST(COALESCE(_hours, 24), 1), 720));
BEGIN
  PERFORM app_private.assert_admin();
  RETURN jsonb_build_object(
    'hours', v_hours,
    'total', (SELECT count(*) FROM public.auth_abuse_events WHERE created_at >= v_from),
    'failed', (SELECT count(*) FROM public.auth_abuse_events WHERE created_at >= v_from AND event_type = 'login_failed'),
    'rate_limited', (SELECT count(*) FROM public.auth_abuse_events WHERE created_at >= v_from AND event_type = 'login_rate_limited'),
    'distinct_ips', (SELECT count(DISTINCT ip_hash) FROM public.auth_abuse_events WHERE created_at >= v_from),
    'distinct_accounts', (SELECT count(DISTINCT identifier_hash) FROM public.auth_abuse_events WHERE created_at >= v_from),
    'blocks_active', (SELECT count(*) FROM public.abuse_blocks WHERE blocked_until > now()),
    'lockouts_active', (SELECT count(*) FROM app_private._login_lockouts()),
    'by_type', COALESCE((SELECT jsonb_agg(jsonb_build_object('event_type', t.event_type, 'count', t.c) ORDER BY t.c DESC, t.event_type)
                           FROM (SELECT event_type, count(*) c FROM public.auth_abuse_events WHERE created_at >= v_from GROUP BY 1) t), '[]'::jsonb),
    'by_endpoint', COALESCE((SELECT jsonb_agg(jsonb_build_object('endpoint', t.endpoint, 'count', t.c) ORDER BY t.c DESC, t.endpoint)
                              FROM (SELECT COALESCE(endpoint, '') endpoint, count(*) c FROM public.auth_abuse_events WHERE created_at >= v_from GROUP BY 1) t), '[]'::jsonb),
    'hourly', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', g.b, 'count', COALESCE(e.c, 0)) ORDER BY g.b)
                          FROM generate_series(date_trunc('hour', v_from), date_trunc('hour', now()), interval '1 hour') AS g(b)
                          LEFT JOIN (SELECT date_trunc('hour', created_at) b, count(*) c FROM public.auth_abuse_events WHERE created_at >= v_from GROUP BY 1) e ON e.b = g.b), '[]'::jsonb),
    'generated_at', now()
  );
END;
$function$;

-- ───────────────────────── IPs mais ativos ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_abuse_ips(
  _hours integer DEFAULT 24, _search text DEFAULT NULL::text, _page integer DEFAULT 1, _page_size integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_from timestamptz := now() - make_interval(hours => LEAST(GREATEST(COALESCE(_hours, 24), 1), 720));
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_page int := GREATEST(COALESCE(_page, 1), 1);
  v_like text := CASE WHEN NULLIF(trim(COALESCE(_search, '')), '') IS NULL THEN NULL
                      ELSE replace(replace(replace(lower(trim(_search)), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
BEGIN
  PERFORM app_private.assert_admin();
  WITH per_ip AS (
    SELECT e.ip_hash,
           count(*) AS events,
           count(*) FILTER (WHERE e.event_type = 'login_failed') AS failed,
           count(*) FILTER (WHERE e.event_type = 'login_rate_limited') AS rate_limited,
           count(DISTINCT e.identifier_hash) AS accounts,
           max(e.created_at) AS last_at
      FROM public.auth_abuse_events e
     WHERE e.created_at >= v_from AND e.ip_hash IS NOT NULL AND (v_like IS NULL OR e.ip_hash LIKE v_like)
     GROUP BY e.ip_hash
  ), joined AS (
    SELECT p.*, b.id AS block_id, b.blocked_until
      FROM per_ip p
      LEFT JOIN LATERAL (SELECT ab.id, ab.blocked_until FROM public.abuse_blocks ab
                          WHERE ab.ip_hash = p.ip_hash AND ab.blocked_until > now() ORDER BY ab.blocked_until DESC LIMIT 1) b ON true
  ), page AS (
    SELECT * FROM joined ORDER BY events DESC, last_at DESC, ip_hash LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.events DESC, p.last_at DESC, p.ip_hash) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM joined),
    'summary', jsonb_build_object('ips', (SELECT count(*) FROM joined), 'blocked', (SELECT count(*) FROM joined WHERE block_id IS NOT NULL))
  ) INTO result;
  RETURN result;
END;
$function$;

-- ───────────────────────── em espera agora ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_abuse_waiting()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM app_private.assert_admin();
  RETURN jsonb_build_object(
    'blocks', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'ip_hash', b.ip_hash, 'endpoint', b.endpoint, 'reason', b.reason,
                                         'blocked_until', b.blocked_until, 'created_at', b.created_at) ORDER BY b.blocked_until DESC)
                          FROM (SELECT * FROM public.abuse_blocks WHERE blocked_until > now() ORDER BY blocked_until DESC LIMIT 200) b), '[]'::jsonb),
    'lockouts', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', l.kind, 'scope', l.scope, 'email', l.email, 'ip_hash', l.ip_hash,
                                          'fails', l.fails, 'resets_at', l.resets_at) ORDER BY l.resets_at DESC, l.fails DESC)
                            FROM (SELECT * FROM app_private._login_lockouts() LIMIT 200) l), '[]'::jsonb)
  );
END;
$function$;

-- ───────────────────────── bloquear e liberar ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_abuse_block_ip(_ip_hash text, _minutes integer, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid;
  v_hash text := lower(btrim(COALESCE(_ip_hash, '')));
  v_reason text := left(btrim(regexp_replace(COALESCE(_reason, ''), '[<>]', '', 'g')), 300);
  v_until timestamptz;
  v_id uuid;
  v_existing timestamptz;
BEGIN
  _admin := app_private.assert_admin();
  IF v_hash !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'Identificação do IP inválida.'; END IF;
  IF _minutes IS NULL OR _minutes < 5 OR _minutes > 10080 THEN RAISE EXCEPTION 'A duração deve ficar entre 5 minutos e 7 dias.'; END IF;
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Explique o motivo (mínimo 3 caracteres).'; END IF;
  SELECT max(blocked_until) INTO v_existing FROM public.abuse_blocks WHERE ip_hash = v_hash AND blocked_until > now();
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Esse IP já está em quarentena até %.', to_char(v_existing AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
  END IF;
  v_until := now() + make_interval(mins => _minutes);
  INSERT INTO public.abuse_blocks(ip_hash, endpoint, reason, blocked_until)
  VALUES (v_hash, 'gated-login', 'Bloqueio manual: ' || v_reason, v_until) RETURNING id INTO v_id;
  PERFORM app_private.admin_audit(_admin, 'abuse_block_ip', 'abuse_blocks', v_id::text,
    jsonb_build_object('ip_hash', v_hash, 'minutes', _minutes, 'reason', v_reason));
  RETURN jsonb_build_object('id', v_id, 'blocked_until', v_until);
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_abuse_release_block(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid;
  v_reason text := left(btrim(regexp_replace(COALESCE(_reason, ''), '[<>]', '', 'g')), 300);
  v_row public.abuse_blocks%ROWTYPE;
BEGIN
  _admin := app_private.assert_admin();
  PERFORM app_private.assert_recent_auth();
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Explique o motivo (mínimo 3 caracteres).'; END IF;
  SELECT * INTO v_row FROM public.abuse_blocks WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bloqueio não encontrado.'; END IF;
  IF v_row.blocked_until <= now() THEN RAISE EXCEPTION 'Esse bloqueio já terminou.'; END IF;
  UPDATE public.abuse_blocks SET blocked_until = now() WHERE id = _id;
  PERFORM app_private.admin_audit(_admin, 'abuse_release_block', 'abuse_blocks', _id::text,
    jsonb_build_object('ip_hash', v_row.ip_hash, 'was_until', v_row.blocked_until, 'previous_reason', v_row.reason, 'reason', v_reason));
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_release_login_lockout(_kind text, _scope text, _email text, _ip_hash text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid;
  v_reason text := left(btrim(regexp_replace(COALESCE(_reason, ''), '[<>]', '', 'g')), 300);
  v_email text := lower(btrim(COALESCE(_email, '')));
  v_hash text := lower(btrim(COALESCE(_ip_hash, '')));
  v_n int := 0;
BEGIN
  _admin := app_private.assert_admin();
  PERFORM app_private.assert_recent_auth();
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Explique o motivo (mínimo 3 caracteres).'; END IF;
  IF _kind = 'email' THEN
    IF _scope NOT IN ('seller', 'member') OR v_email = '' THEN RAISE EXCEPTION 'Login inválido.'; END IF;
    DELETE FROM public.api_rate_limit_buckets
     WHERE bucket_key = 'gated_login_email:' || _scope || ':' || v_email AND window_start + interval '15 minutes' > now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF _kind = 'ip' THEN
    IF v_hash !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'Identificação do IP inválida.'; END IF;
    DELETE FROM public.api_rate_limit_buckets
     WHERE bucket_key LIKE 'gated\_login\_ip:%' AND window_start + interval '15 minutes' > now()
       AND left(encode(sha256(convert_to(substr(bucket_key, 16), 'UTF8')), 'hex'), 32) = v_hash;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Tipo de trava inválido.';
  END IF;
  IF v_n = 0 THEN RAISE EXCEPTION 'Esse login já não está travado.'; END IF;
  PERFORM app_private.admin_audit(_admin, 'release_login_lockout', 'login_lockout', CASE WHEN _kind = 'email' THEN v_email ELSE v_hash END,
    jsonb_build_object('kind', _kind, 'scope', _scope, 'reason', v_reason));
  RETURN jsonb_build_object('released', v_n);
END;
$function$;

-- ───────────────────────── wrappers e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_abuse_overview(_hours integer DEFAULT 24)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_abuse_overview($1)$function$;
CREATE OR REPLACE FUNCTION public.get_admin_abuse_ips(_hours integer DEFAULT 24, _search text DEFAULT NULL::text, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_abuse_ips($1, $2, $3, $4)$function$;
CREATE OR REPLACE FUNCTION public.get_admin_abuse_waiting()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_admin_abuse_waiting()$function$;
CREATE OR REPLACE FUNCTION public.admin_abuse_block_ip(_ip_hash text, _minutes integer, _reason text)
RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.admin_abuse_block_ip($1, $2, $3)$function$;
CREATE OR REPLACE FUNCTION public.admin_abuse_release_block(_id uuid, _reason text)
RETURNS void LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.admin_abuse_release_block($1, $2)$function$;
CREATE OR REPLACE FUNCTION public.admin_release_login_lockout(_kind text, _scope text, _email text, _ip_hash text, _reason text)
RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.admin_release_login_lockout($1, $2, $3, $4, $5)$function$;

REVOKE ALL ON FUNCTION app_private.get_admin_abuse_overview(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_abuse_ips(integer, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_abuse_waiting() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_abuse_block_ip(text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_abuse_release_block(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_release_login_lockout(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_abuse_overview(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_abuse_ips(integer, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_admin_abuse_waiting() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_abuse_block_ip(text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_abuse_release_block(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.admin_release_login_lockout(text, text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_admin_abuse_overview(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_abuse_ips(integer, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_abuse_waiting() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_abuse_block_ip(text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_abuse_release_block(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_release_login_lockout(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_abuse_overview(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_abuse_ips(integer, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_abuse_waiting() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_abuse_block_ip(text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_abuse_release_block(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_release_login_lockout(text, text, text, text, text) TO authenticated, service_role;
