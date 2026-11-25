-- Notificações do admin: avisos para os sellers, acompanhamento de leitura e limpeza.
--
-- Antes: a tela do admin gravava e apagava direto na tabela (a policy "Admins can manage notifications" era ALL), sem senha
-- e sem auditoria no banco; "Só ativos" procurava account_status = 'active', mas o banco só tem 'approved' e 'pending',
-- então entregava para ninguém; "Todos" entregava até para admin e sócios; o seller podia reescrever título e texto das
-- próprias notificações; e a tabela guardava 315 mil vendas de teste (135 MB) sem nenhuma forma de limpar.
--
-- Agora: tudo passa por funções do banco. Aviso para vários sellers pede a senha de novo, aviso repetido é barrado,
-- cada envio, recolhimento e limpeza vai para a auditoria, e o seller só consegue marcar como lida.

-- ───────────────────────── estrutura ─────────────────────────

-- Liga as cópias de um mesmo aviso (uma por seller) para contar quem leu e poder recolher o aviso inteiro.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_batch ON public.notifications (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type_created ON public.notifications (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_created ON public.notifications (created_at) WHERE is_read;

-- ───────────────────────── permissões da tabela ─────────────────────────

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view notifications" ON public.notifications;
CREATE POLICY "Admins can view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'::app_role));

-- Visitante nunca lê notificação; ninguém logado escreve direto (os gatilhos e as funções abaixo são SECURITY DEFINER).
-- O seller só pode marcar as próprias como lidas: título, texto e tipo deixam de ser editáveis por ele.
REVOKE ALL ON public.notifications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.notifications FROM authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- ───────────────────────── quem recebe ─────────────────────────

-- Sellers de verdade: contas sem papel de equipe. 'approved' = cadastro aprovado, 'pending' = aguardando aprovação.
CREATE OR REPLACE FUNCTION app_private.notification_recipients(_audience text)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.user_id
    FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'employee', 'manager', 'partner'))
     AND CASE _audience
           WHEN 'all'      THEN true
           WHEN 'approved' THEN p.account_status = 'approved'
           WHEN 'pending'  THEN p.account_status = 'pending'
           ELSE false
         END;
$function$;

CREATE OR REPLACE FUNCTION app_private.get_admin_notification_audiences()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM app_private.assert_admin();
  RETURN (
    SELECT jsonb_build_object(
      'all',      count(*),
      'approved', count(*) FILTER (WHERE p.account_status = 'approved'),
      'pending',  count(*) FILTER (WHERE p.account_status = 'pending'))
      FROM public.profiles p
     WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'employee', 'manager', 'partner'))
  );
END
$function$;

-- ───────────────────────── leitura ─────────────────────────

-- _view 'avisos': os avisos enviados pelo admin, um por linha (agrupados por batch_id).
-- _view 'todas': todas as notificações, uma por linha, com filtro por tipo e busca por texto, nome ou e-mail do seller.
CREATE OR REPLACE FUNCTION app_private.get_admin_notifications_page(
  _view text DEFAULT 'avisos', _type text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_view  text := COALESCE(NULLIF(btrim(COALESCE(_view, '')), ''), 'avisos');
  v_type  text := NULLIF(btrim(COALESCE(_type, '')), '');
  v_q     text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat   text;
  v_page  int  := LEAST(GREATEST(COALESCE(_page, 1), 1), 100000);
  v_size  int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off   int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_types jsonb := '{}'::jsonb;
  v_uids  uuid[] := ARRAY[]::uuid[];
  v_prog  jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_view NOT IN ('avisos', 'todas') THEN RAISE EXCEPTION 'visão inválida'; END IF;
  IF v_q IS NOT NULL AND length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
  v_pat := CASE WHEN v_q IS NULL THEN NULL ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
  v_off := (v_page - 1) * v_size;

  IF v_view = 'avisos' THEN
    WITH b AS (
      SELECT n.batch_id,
             min(n.title) AS title, min(n.message) AS message, min(n.type) AS type, min(n.created_at) AS sent_at,
             (array_agg(n.created_by))[1] AS sent_by, (array_agg(n.user_id))[1] AS first_user,
             count(*)::int AS recipients, (count(*) FILTER (WHERE n.is_read))::int AS read_n
        FROM public.notifications n
       WHERE n.batch_id IS NOT NULL AND (v_pat IS NULL OR n.title ILIKE v_pat OR n.message ILIKE v_pat)
       GROUP BY n.batch_id
    ), pgd AS (
      SELECT b.*, row_number() OVER (ORDER BY b.sent_at DESC, b.batch_id) AS rn FROM b
    )
    SELECT (SELECT count(*)::int FROM b),
           COALESCE(jsonb_agg(jsonb_build_object(
             'batch_id', pgd.batch_id, 'title', pgd.title, 'message', pgd.message, 'type', pgd.type, 'sent_at', pgd.sent_at,
             'sent_by_name', COALESCE(NULLIF(btrim(COALESCE(ps.full_name, '')), ''), ps.email),
             'recipients', pgd.recipients, 'read', pgd.read_n,
             'one', CASE WHEN pgd.recipients = 1 THEN jsonb_build_object(
                      'user_id', pgd.first_user, 'name', COALESCE(NULLIF(btrim(COALESCE(pu.full_name, '')), ''), pu.email, 'Seller sem nome'), 'email', pu.email) END
           ) ORDER BY pgd.rn), '[]'::jsonb)
      INTO v_total, v_items
      FROM pgd
      LEFT JOIN public.profiles ps ON ps.user_id = pgd.sent_by
      LEFT JOIN public.profiles pu ON pu.user_id = pgd.first_user AND pgd.recipients = 1
     WHERE pgd.rn > v_off AND pgd.rn <= v_off + v_size;
  ELSE
    -- a busca por nome ou e-mail do seller vira uma lista de contas (no máximo 500) antes de olhar as notificações
    IF v_pat IS NOT NULL THEN
      SELECT COALESCE(array_agg(m.user_id), ARRAY[]::uuid[]) INTO v_uids
        FROM (SELECT p0.user_id FROM public.profiles p0
               WHERE COALESCE(p0.full_name, '') ILIKE v_pat OR COALESCE(p0.email, '') ILIKE v_pat LIMIT 500) m;
    END IF;

    -- uma varredura só: a contagem por tipo também dá o total
    SELECT COALESCE(jsonb_object_agg(t.type, t.c), '{}'::jsonb) INTO v_types
      FROM (SELECT n.type, count(*)::int AS c
              FROM public.notifications n
             WHERE v_pat IS NULL OR n.title ILIKE v_pat OR n.message ILIKE v_pat OR n.user_id = ANY(v_uids)
             GROUP BY n.type) t;
    v_total := CASE WHEN v_type IS NULL THEN (SELECT COALESCE(sum(e.value::int), 0)::int FROM jsonb_each_text(v_types) e)
                    ELSE COALESCE((v_types ->> v_type)::int, 0) END;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', x.id, 'type', x.type, 'title', x.title, 'message', x.message, 'is_read', x.is_read, 'created_at', x.created_at,
             'batch_id', x.batch_id, 'user_id', x.user_id,
             'user_name', COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email),
             'user_email', p.email
           ) ORDER BY x.created_at DESC, x.id), '[]'::jsonb)
      INTO v_items
      FROM (SELECT n.*
              FROM public.notifications n
             WHERE (v_type IS NULL OR n.type = v_type)
               AND (v_pat IS NULL OR n.title ILIKE v_pat OR n.message ILIKE v_pat OR n.user_id = ANY(v_uids))
             ORDER BY n.created_at DESC, n.id
             LIMIT v_size OFFSET v_off) x
      LEFT JOIN public.profiles p ON p.user_id = x.user_id;
  END IF;

  SELECT jsonb_build_object(
           'total',      count(*),
           'unread',     count(*) FILTER (WHERE NOT n.is_read),
           'read',       count(*) FILTER (WHERE n.is_read),
           'read_old',   count(*) FILTER (WHERE n.is_read AND n.created_at < now() - interval '30 days'),
           'last_24h',   count(*) FILTER (WHERE n.created_at > now() - interval '24 hours'),
           'oldest',     min(n.created_at),
           'avisos',     (SELECT count(DISTINCT b.batch_id)::int FROM public.notifications b WHERE b.batch_id IS NOT NULL),
           'avisos_rows', count(*) FILTER (WHERE n.batch_id IS NOT NULL),
           'avisos_read', count(*) FILTER (WHERE n.batch_id IS NOT NULL AND n.is_read),
           'last_sent',  max(n.created_at) FILTER (WHERE n.batch_id IS NOT NULL),
           'size_bytes', pg_total_relation_size('public.notifications'))
    INTO v_prog
    FROM public.notifications n;

  RETURN jsonb_build_object('view', v_view, 'items', v_items, 'total', v_total, 'types', v_types, 'program', v_prog, 'generated_at', now());
END
$function$;

-- Um aviso enviado: o texto, quem mandou e, no máximo, 200 destinatários (quem não leu primeiro).
CREATE OR REPLACE FUNCTION app_private.get_admin_notification_batch(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT jsonb_build_object(
           'batch_id', b.batch_id, 'title', b.title, 'message', b.message, 'type', b.type, 'sent_at', b.sent_at,
           'sent_by_name', (SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email) FROM public.profiles p WHERE p.user_id = b.sent_by),
           'recipients', b.recipients, 'read', b.read_n,
           'items', COALESCE((
             SELECT jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', r.name, 'email', r.email, 'is_read', r.is_read) ORDER BY r.is_read, r.name)
               FROM (SELECT n.user_id, n.is_read, p.email,
                            COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email, 'Seller sem nome') AS name
                       FROM public.notifications n
                       LEFT JOIN public.profiles p ON p.user_id = n.user_id
                      WHERE n.batch_id = _batch_id
                      ORDER BY n.is_read, 3 NULLS LAST, 4
                      LIMIT 200) r), '[]'::jsonb))
    INTO v
    FROM (SELECT n.batch_id, min(n.title) AS title, min(n.message) AS message, min(n.type) AS type, min(n.created_at) AS sent_at,
                 (array_agg(n.created_by))[1] AS sent_by, count(*)::int AS recipients, (count(*) FILTER (WHERE n.is_read))::int AS read_n
            FROM public.notifications n
           WHERE n.batch_id = _batch_id
           GROUP BY n.batch_id) b;
  IF v IS NULL THEN RAISE EXCEPTION 'aviso não encontrado'; END IF;
  RETURN v;
END
$function$;

-- ───────────────────────── ações ─────────────────────────

-- Envia um aviso. _audience: 'all' | 'approved' | 'pending' (vários sellers) ou 'one' (um seller, com _user_id).
CREATE OR REPLACE FUNCTION app_private.admin_send_notification(_audience text, _user_id uuid, _title text, _message text, _type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_aud   text := btrim(COALESCE(_audience, ''));
  v_type  text := btrim(COALESCE(_type, 'info'));
  v_title text;
  v_msg   text;
  v_batch uuid := gen_random_uuid();
  v_n     int;
  v_name  text;
BEGIN
  IF v_aud NOT IN ('all', 'approved', 'pending', 'one') THEN RAISE EXCEPTION 'escolha quem vai receber o aviso'; END IF;
  IF v_type NOT IN ('info', 'announcement', 'warning', 'success', 'alert') THEN RAISE EXCEPTION 'tipo de aviso inválido'; END IF;

  -- mesma limpeza do gatilho sanitize_notification, para comparar e medir o texto que de fato vai ser gravado
  v_title := btrim(regexp_replace(regexp_replace(COALESCE(_title, ''), '<[^>]*>', '', 'g'), 'javascript:', '', 'gi'));
  v_msg   := btrim(regexp_replace(regexp_replace(COALESCE(_message, ''), '<[^>]*>', '', 'g'), 'javascript:', '', 'gi'));
  IF length(v_title) < 1 THEN RAISE EXCEPTION 'escreva o título do aviso'; END IF;
  IF length(v_title) > 100 THEN RAISE EXCEPTION 'título muito longo (máximo 100 caracteres)'; END IF;
  IF length(v_msg) < 1 THEN RAISE EXCEPTION 'escreva a mensagem do aviso'; END IF;
  IF length(v_msg) > 500 THEN RAISE EXCEPTION 'mensagem muito longa (máximo 500 caracteres)'; END IF;

  IF v_aud = 'one' THEN
    IF _user_id IS NULL THEN RAISE EXCEPTION 'escolha o seller que vai receber'; END IF;
    SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email, 'Seller sem nome') INTO v_name FROM public.profiles p WHERE p.user_id = _user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'seller não encontrado'; END IF;
  END IF;

  -- clique duplo ou reenvio sem querer
  IF EXISTS (SELECT 1 FROM public.notifications n
              WHERE n.created_by = v_admin AND n.batch_id IS NOT NULL AND n.title = v_title AND n.message = v_msg
                AND n.created_at > now() - interval '5 minutes'
                AND (v_aud <> 'one' OR n.user_id = _user_id)) THEN
    RAISE EXCEPTION 'este aviso já foi enviado há poucos minutos';
  END IF;

  IF v_aud = 'one' THEN
    INSERT INTO public.notifications (user_id, title, message, type, created_by, batch_id) VALUES (_user_id, v_title, v_msg, v_type, v_admin, v_batch);
    v_n := 1;
  ELSE
    INSERT INTO public.notifications (user_id, title, message, type, created_by, batch_id)
    SELECT r.user_id, v_title, v_msg, v_type, v_admin, v_batch FROM app_private.notification_recipients(v_aud) r;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'nenhum seller nessa lista'; END IF;
  END IF;

  PERFORM app_private.admin_audit(v_admin, 'notification_send', 'notification', v_batch::text,
    jsonb_build_object('audience', v_aud, 'user_id', _user_id, 'title', v_title, 'type', v_type, 'delivered', v_n));
  RETURN jsonb_build_object('batch_id', v_batch, 'delivered', v_n, 'name', v_name);
END
$function$;

-- Recolhe um aviso: some da caixa de todos que o receberam (quem leu e quem não leu).
CREATE OR REPLACE FUNCTION app_private.admin_retract_notification(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_title text; v_total int; v_read int;
BEGIN
  IF _batch_id IS NULL THEN RAISE EXCEPTION 'aviso não encontrado'; END IF;
  SELECT min(n.title), count(*)::int, (count(*) FILTER (WHERE n.is_read))::int INTO v_title, v_total, v_read
    FROM public.notifications n WHERE n.batch_id = _batch_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'este aviso já foi recolhido'; END IF;
  DELETE FROM public.notifications WHERE batch_id = _batch_id;
  PERFORM app_private.admin_audit(v_admin, 'notification_retract', 'notification', _batch_id::text,
    jsonb_build_object('title', v_title, 'removed', v_total, 'already_read', v_read));
  RETURN jsonb_build_object('removed', v_total);
END
$function$;

-- Apaga notificações JÁ LIDAS, em lotes de 20 mil (uma chamada só estouraria o tempo limite com centenas de milhares).
-- A tela repete a chamada enquanto 'remaining' for maior que zero. Nunca apaga notificação que o seller ainda não leu.
CREATE OR REPLACE FUNCTION app_private.admin_clean_notifications(_scope text, _reason text)
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
  v_left   int;
BEGIN
  IF v_scope NOT IN ('read_old', 'read_all') THEN RAISE EXCEPTION 'escolha o que apagar'; END IF;
  IF length(v_reason) < 5 THEN RAISE EXCEPTION 'informe o motivo (mínimo 5 caracteres)'; END IF;
  IF length(v_reason) > 1000 THEN RAISE EXCEPTION 'motivo muito longo'; END IF;

  WITH d AS (
    DELETE FROM public.notifications
     WHERE ctid IN (SELECT n.ctid FROM public.notifications n
                     WHERE n.is_read AND (v_scope = 'read_all' OR n.created_at < now() - interval '30 days')
                     LIMIT 20000)
    RETURNING 1)
  SELECT count(*)::int INTO v_n FROM d;
  IF v_n = 0 THEN RAISE EXCEPTION 'nenhuma notificação para apagar'; END IF;

  SELECT count(*)::int INTO v_left FROM public.notifications n
   WHERE n.is_read AND (v_scope = 'read_all' OR n.created_at < now() - interval '30 days');

  PERFORM app_private.admin_audit(v_admin, 'notifications_clean', 'notification', 'bulk',
    jsonb_build_object('scope', v_scope, 'reason', v_reason, 'deleted', v_n, 'remaining', v_left));
  RETURN jsonb_build_object('deleted', v_n, 'remaining', v_left);
END
$function$;

-- ───────────────────────── funções antigas ─────────────────────────

-- O envio em massa antigo (sem senha, sem auditoria, com o filtro 'active' que não existe) e a "limpeza de órfãs"
-- (só apagava linhas sem destinatário, que o seller nunca consegue ler) saem de cena.
DROP FUNCTION IF EXISTS public.admin_broadcast_notification(text, text, text, text);
DROP FUNCTION IF EXISTS app_private.admin_broadcast_notification(text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_purge_orphan_notifications();
DROP FUNCTION IF EXISTS app_private.admin_purge_orphan_notifications();

-- ───────────────────────── wrappers públicos ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_notification_audiences()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_notification_audiences(); $$;

CREATE OR REPLACE FUNCTION public.get_admin_notifications_page(_view text DEFAULT 'avisos', _type text DEFAULT NULL, _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_notifications_page(_view, _type, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_notification_batch(_batch_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_notification_batch(_batch_id); $$;

-- Aviso para vários sellers pede a senha de novo; para um seller só, não.
CREATE OR REPLACE FUNCTION public.admin_send_notification(_audience text, _user_id uuid, _title text, _message text, _type text DEFAULT 'info')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ BEGIN
  IF btrim(COALESCE(_audience, '')) <> 'one' THEN PERFORM app_private.assert_recent_auth(); END IF;
  RETURN app_private.admin_send_notification(_audience, _user_id, _title, _message, _type);
END $$;

CREATE OR REPLACE FUNCTION public.admin_retract_notification(_batch_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_retract_notification(_batch_id); $$;

CREATE OR REPLACE FUNCTION public.admin_clean_notifications(_scope text, _reason text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_clean_notifications(_scope, _reason); END $$;

-- ───────────────────────── permissões das funções ─────────────────────────

REVOKE ALL ON FUNCTION app_private.notification_recipients(text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  app_private.get_admin_notification_audiences(), app_private.get_admin_notifications_page(text, text, text, integer, integer),
  app_private.get_admin_notification_batch(uuid), app_private.admin_send_notification(text, uuid, text, text, text),
  app_private.admin_retract_notification(uuid), app_private.admin_clean_notifications(text, text),
  public.get_admin_notification_audiences(), public.get_admin_notifications_page(text, text, text, integer, integer),
  public.get_admin_notification_batch(uuid), public.admin_send_notification(text, uuid, text, text, text),
  public.admin_retract_notification(uuid), public.admin_clean_notifications(text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.get_admin_notification_audiences(), app_private.get_admin_notifications_page(text, text, text, integer, integer),
  app_private.get_admin_notification_batch(uuid), app_private.admin_send_notification(text, uuid, text, text, text),
  app_private.admin_retract_notification(uuid), app_private.admin_clean_notifications(text, text),
  public.get_admin_notification_audiences(), public.get_admin_notifications_page(text, text, text, integer, integer),
  public.get_admin_notification_batch(uuid), public.admin_send_notification(text, uuid, text, text, text),
  public.admin_retract_notification(uuid), public.admin_clean_notifications(text, text)
  TO authenticated, service_role;
