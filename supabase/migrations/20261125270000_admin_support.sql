-- Suporte do admin: caixa de chamados, resposta, encerramento e prioridade.
--
-- Antes: a tela lia `support_tickets` direto (só o admin tinha policy, então a equipe com permissão de suporte via a caixa
-- vazia), respondia gravando direto em `ticket_messages` (qualquer atendente ou gerente lia e respondia TODOS os chamados,
-- sem olhar `view_support`/`respond_support`, e o nome e o cargo da resposta vinham do navegador), e "Encerrar" apagava os
-- anexos do chamado para sempre. Um chamado respondido em que o cliente escreve de novo seguia como "Respondido" e não
-- entrava em "Pendentes".
--
-- Agora: tudo passa por funções do banco que conferem a permissão (admin, ou atendente/gerente com `view_support` para ver
-- e também `respond_support` para responder), o nome e o cargo da resposta saem do cadastro de quem responde, a situação do
-- chamado ("aguardando a equipe", "respondido", "encerrado") vem das datas como na tela do seller, e cada resposta,
-- encerramento, reabertura e mudança de prioridade vai para a auditoria.

-- ───────────────────────── índices ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last ON public.support_tickets (last_message_at DESC NULLS LAST);

-- ───────────────────────── permissão ─────────────────────────

-- 'view' = ver os chamados; 'reply' = ver e responder, encerrar, reabrir e mudar a prioridade.
CREATE OR REPLACE FUNCTION app_private.can_support(_uid uuid, _need text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _uid IS NOT NULL AND (
    app_private.has_role(_uid, 'admin'::app_role)
    OR (app_private.has_staff_permission(_uid, 'view_support')
        AND (_need <> 'reply' OR app_private.has_staff_permission(_uid, 'respond_support')))
  );
$$;

CREATE OR REPLACE FUNCTION app_private.assert_support(_need text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT app_private.can_support(v_uid, _need) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN v_uid;
END;
$$;

-- Com quem está a bola. Mesma regra de `ticketStage` (src/components/support/supportModel.ts): o banco mantém
-- status = 'answered' mesmo depois de o cliente escrever de novo, então vale a data da última mensagem.
CREATE OR REPLACE FUNCTION app_private.ticket_stage(_status text, _replied_at timestamptz, _last_message_at timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _status IN ('closed', 'resolved') THEN 'done'
    WHEN NOT (_status = 'answered' OR _replied_at IS NOT NULL) THEN 'waiting'
    WHEN _replied_at IS NOT NULL AND _last_message_at IS NOT NULL AND _last_message_at - _replied_at > interval '1.5 seconds' THEN 'waiting'
    ELSE 'answered'
  END;
$$;

-- Base da caixa: um chamado por linha, com a situação, o nome e o e-mail de quem abriu e a busca já aplicada.
CREATE OR REPLACE FUNCTION app_private.support_base(_pat text, _code text)
RETURNS TABLE (id uuid, user_id uuid, subject text, message text, status text, priority text, created_at timestamptz,
               last_message_at timestamptz, replied_at timestamptz, unread_by_staff integer, admin_reply text,
               stage text, full_name text, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.user_id, t.subject, t.message, t.status, t.priority, t.created_at, t.last_message_at, t.replied_at,
         COALESCE(t.unread_by_staff, 0), t.admin_reply,
         app_private.ticket_stage(t.status, t.replied_at, t.last_message_at), p.full_name, p.email
    FROM public.support_tickets t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
   WHERE _pat IS NULL
      OR t.subject ILIKE _pat OR t.message ILIKE _pat OR COALESCE(t.admin_reply, '') ILIKE _pat
      OR COALESCE(p.full_name, '') ILIKE _pat OR COALESCE(p.email, '') ILIKE _pat
      OR (_code IS NOT NULL AND replace(t.id::text, '-', '') LIKE _code);
$$;

-- ───────────────────────── permissões das tabelas ─────────────────────────

REVOKE ALL ON public.support_tickets, public.ticket_messages FROM anon;
-- Ninguém altera ou apaga chamado e mensagem direto: o cliente usa as funções dele, a equipe usa as de baixo.
REVOKE UPDATE, DELETE ON public.support_tickets FROM authenticated;
REVOKE UPDATE, DELETE ON public.ticket_messages FROM authenticated;

-- O cliente só lê e escreve nos próprios chamados. A equipe lê (para a tela e o tempo real) com `view_support`, mas
-- escreve só pelas funções abaixo: não há mais insert direto de resposta nem update direto de status.
DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff read tickets" ON public.support_tickets;
CREATE POLICY "Staff read tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (app_private.can_support(auth.uid(), 'view'));

DROP POLICY IF EXISTS customer_inserts_own_ticket_messages ON public.ticket_messages;
DROP POLICY IF EXISTS customer_reads_own_ticket_messages ON public.ticket_messages;
DROP POLICY IF EXISTS staff_update_read_flags ON public.ticket_messages;
DROP POLICY IF EXISTS "Staff read ticket messages" ON public.ticket_messages;

CREATE POLICY customer_inserts_own_ticket_messages ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND sender_type = 'customer'
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid())
  );

CREATE POLICY customer_reads_own_ticket_messages ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()));

CREATE POLICY "Staff read ticket messages" ON public.ticket_messages
  FOR SELECT TO authenticated USING (app_private.can_support(auth.uid(), 'view'));

-- Anexos: o cliente mexe nos do próprio chamado; a equipe lê com `view_support` e envia/apaga com `respond_support`.
DROP POLICY IF EXISTS ticket_attachments_select ON storage.objects;
DROP POLICY IF EXISTS ticket_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS ticket_attachments_delete ON storage.objects;

CREATE POLICY ticket_attachments_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments' AND (
    EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id::text = (storage.foldername(objects.name))[1] AND st.user_id = auth.uid())
    OR app_private.can_support(auth.uid(), 'view')));

CREATE POLICY ticket_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments' AND (
    EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id::text = (storage.foldername(objects.name))[1] AND st.user_id = auth.uid())
    OR app_private.can_support(auth.uid(), 'reply')));

CREATE POLICY ticket_attachments_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments' AND (
    EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id::text = (storage.foldername(objects.name))[1] AND st.user_id = auth.uid())
    OR app_private.can_support(auth.uid(), 'reply')));

-- ───────────────────────── leitura ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_support_page(
  _filter text DEFAULT 'waiting', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := app_private.assert_support('view');
  v_filter text := COALESCE(NULLIF(btrim(COALESCE(_filter, '')), ''), 'waiting');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_code   text;
  v_page   int  := LEAST(GREATEST(COALESCE(_page, 1), 1), 100000);
  v_size   int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int;
  v_items  jsonb := '[]'::jsonb;
  v_counts jsonb;
  v_total  int := 0;
  v_prog   jsonb;
  v_median numeric;
  v_sample int;
BEGIN
  IF v_filter NOT IN ('waiting', 'unread', 'urgent', 'answered', 'done', 'all') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL AND length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
  v_pat  := CASE WHEN v_q IS NULL THEN NULL ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
  v_code := CASE WHEN v_q ~ '^#?[0-9a-fA-F]{4,8}$' THEN lower(replace(v_q, '#', '')) || '%' ELSE NULL END;
  v_off  := (v_page - 1) * v_size;

  SELECT jsonb_build_object(
           'waiting',  count(*) FILTER (WHERE stage = 'waiting'),
           'unread',   count(*) FILTER (WHERE unread_by_staff > 0),
           'urgent',   count(*) FILTER (WHERE priority = 'urgent' AND stage <> 'done'),
           'answered', count(*) FILTER (WHERE stage = 'answered'),
           'done',     count(*) FILTER (WHERE stage = 'done'),
           'all',      count(*))
    INTO v_counts FROM app_private.support_base(v_pat, v_code);

  v_total := (v_counts ->> CASE v_filter WHEN 'all' THEN 'all' ELSE v_filter END)::int;

  SELECT COALESCE(jsonb_agg(x.j ORDER BY x.ord), '[]'::jsonb) INTO v_items
    FROM (
      SELECT row_number() OVER (ORDER BY (b.stage = 'waiting') DESC,
                                         CASE WHEN b.stage = 'waiting' THEN b.last_message_at END ASC NULLS LAST,
                                         b.last_message_at DESC NULLS LAST, b.created_at DESC) AS ord,
             jsonb_build_object(
               'id', b.id, 'subject', b.subject, 'first', left(b.message, 400), 'status', b.status, 'stage', b.stage, 'priority', b.priority,
               'created_at', b.created_at, 'last_message_at', COALESCE(b.last_message_at, b.created_at), 'replied_at', b.replied_at,
               'unread_by_staff', b.unread_by_staff,
               'last_sender', lm.sender_type, 'last_body', left(COALESCE(lm.body, b.message), 200),
               'user', jsonb_build_object('user_id', b.user_id, 'name', NULLIF(btrim(COALESCE(b.full_name, '')), ''), 'email', b.email)
             ) AS j
        FROM app_private.support_base(v_pat, v_code) b
        LEFT JOIN LATERAL (SELECT m.sender_type, m.body FROM public.ticket_messages m WHERE m.ticket_id = b.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
       WHERE CASE v_filter
               WHEN 'waiting'  THEN b.stage = 'waiting'
               WHEN 'unread'   THEN b.unread_by_staff > 0
               WHEN 'urgent'   THEN b.priority = 'urgent' AND b.stage <> 'done'
               WHEN 'answered' THEN b.stage = 'answered'
               WHEN 'done'     THEN b.stage = 'done'
               ELSE true END
       ORDER BY ord
       OFFSET v_off LIMIT v_size
    ) x;

  -- mediana da primeira resposta da equipe, nos chamados abertos nos últimos 30 dias
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (fs.first_staff - t.created_at))), count(*)
    INTO v_median, v_sample
    FROM public.support_tickets t
    JOIN LATERAL (SELECT min(m.created_at) AS first_staff FROM public.ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'staff') fs
      ON fs.first_staff IS NOT NULL
   WHERE t.created_at > now() - interval '30 days';

  SELECT jsonb_build_object(
           'waiting',        count(*) FILTER (WHERE s = 'waiting'),
           'waiting_since',  min(COALESCE(last_message_at, created_at)) FILTER (WHERE s = 'waiting'),
           'unread',         COALESCE(sum(unread_by_staff), 0),
           'unread_tickets', count(*) FILTER (WHERE unread_by_staff > 0),
           'urgent',         count(*) FILTER (WHERE priority = 'urgent' AND s <> 'done'),
           'answered',       count(*) FILTER (WHERE s = 'answered'),
           'done',           count(*) FILTER (WHERE s = 'done'),
           'total',          count(*))
    INTO v_prog
    FROM (SELECT unread_by_staff, priority, last_message_at, created_at, app_private.ticket_stage(status, replied_at, last_message_at) AS s FROM public.support_tickets) g;

  RETURN jsonb_build_object(
    'items', v_items, 'total', v_total, 'counts', v_counts, 'can_reply', app_private.can_support(v_uid, 'reply'),
    'program', v_prog || jsonb_build_object('median_first_reply_seconds', CASE WHEN v_sample > 0 THEN round(v_median) END, 'reply_sample', v_sample),
    'generated_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.get_admin_support_ticket(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := app_private.assert_support('view');
  t      public.support_tickets;
  p      public.profiles;
  v_msgs jsonb;
  v_n    int;
  v_ctx  jsonb;
  v_prev jsonb;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado não encontrado'; END IF;
  SELECT * INTO p FROM public.profiles WHERE user_id = t.user_id;

  SELECT count(*) INTO v_n FROM public.ticket_messages WHERE ticket_id = _id;
  SELECT COALESCE(jsonb_agg(m.j ORDER BY m.created_at), '[]'::jsonb) INTO v_msgs
    FROM (SELECT x.created_at,
                 jsonb_build_object('id', x.id, 'sender_type', x.sender_type, 'sender_name', x.sender_name, 'sender_role', x.sender_role,
                                    'body', x.body, 'created_at', x.created_at, 'attachments', COALESCE(x.attachments, '[]'::jsonb)) AS j
            FROM public.ticket_messages x WHERE x.ticket_id = _id ORDER BY x.created_at DESC LIMIT 300) m;
  -- se a primeira mensagem não chegou a ser gravada, o texto do chamado ocupa o lugar dela
  IF v_n = 0 THEN
    v_msgs := jsonb_build_array(jsonb_build_object('id', 'first', 'sender_type', 'customer', 'sender_name', NULL, 'sender_role', NULL,
                                                   'body', t.message, 'created_at', t.created_at, 'attachments', '[]'::jsonb));
  END IF;

  SELECT jsonb_build_object(
           'sales', count(*) FILTER (WHERE tx.status IN ('approved', 'paid', 'completed')),
           'gross', COALESCE(sum(tx.amount) FILTER (WHERE tx.status IN ('approved', 'paid', 'completed')), 0),
           'last_sale', max(tx.created_at) FILTER (WHERE tx.status IN ('approved', 'paid', 'completed')))
    INTO v_ctx FROM public.transactions tx WHERE tx.user_id = t.user_id AND COALESCE(tx.is_simulated, false) = false;

  SELECT COALESCE(jsonb_agg(o.j ORDER BY o.created_at DESC), '[]'::jsonb) INTO v_prev
    FROM (SELECT s.created_at, jsonb_build_object('id', s.id, 'subject', s.subject, 'status', s.status, 'stage', app_private.ticket_stage(s.status, s.replied_at, s.last_message_at), 'created_at', s.created_at) AS j
            FROM public.support_tickets s WHERE s.user_id = t.user_id AND s.id <> t.id ORDER BY s.created_at DESC LIMIT 5) o;

  RETURN jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'first', t.message, 'status', t.status, 'priority', t.priority,
    'stage', app_private.ticket_stage(t.status, t.replied_at, t.last_message_at),
    'created_at', t.created_at, 'last_message_at', COALESCE(t.last_message_at, t.created_at), 'replied_at', t.replied_at, 'unread_by_staff', t.unread_by_staff,
    'messages', v_msgs, 'messages_total', GREATEST(v_n, 1), 'can_reply', app_private.can_support(v_uid, 'reply'),
    'user', jsonb_build_object(
      'user_id', t.user_id, 'name', NULLIF(btrim(COALESCE(p.full_name, '')), ''), 'email', p.email, 'account_status', p.account_status,
      'joined_at', p.created_at, 'sales', COALESCE((v_ctx ->> 'sales')::int, 0), 'gross', COALESCE((v_ctx ->> 'gross')::numeric, 0), 'last_sale', v_ctx -> 'last_sale',
      'tickets_total', (SELECT count(*) FROM public.support_tickets s2 WHERE s2.user_id = t.user_id), 'previous', v_prev));
END;
$function$;

-- ───────────────────────── escrita ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_reply_ticket(_ticket_id uuid, _body text, _attachments jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid := app_private.assert_support('reply');
  t       public.support_tickets;
  v_body  text := btrim(COALESCE(_body, ''));
  v_att   jsonb := '[]'::jsonb;
  a       jsonb;
  v_name  text;
  v_role  text;
  v_id    uuid;
  v_at    timestamptz;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado não encontrado'; END IF;
  IF t.status IN ('closed', 'resolved') THEN RAISE EXCEPTION 'o chamado está encerrado: reabra para responder'; END IF;

  IF _attachments IS NULL OR jsonb_typeof(_attachments) <> 'array' THEN _attachments := '[]'::jsonb; END IF;
  IF jsonb_array_length(_attachments) > 3 THEN RAISE EXCEPTION 'no máximo 3 anexos por mensagem'; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(_attachments) LOOP
    IF jsonb_typeof(a) <> 'object' OR COALESCE(a ->> 'path', '') NOT LIKE (_ticket_id::text || '/%') OR position('..' IN (a ->> 'path')) > 0 THEN
      RAISE EXCEPTION 'anexo inválido';
    END IF;
    v_att := v_att || jsonb_build_array(jsonb_build_object(
      'path', a ->> 'path', 'name', left(COALESCE(NULLIF(btrim(a ->> 'name'), ''), 'arquivo'), 200),
      'size', CASE WHEN COALESCE(a ->> 'size', '') ~ '^[0-9]{1,10}$' THEN LEAST((a ->> 'size')::bigint, 5242880) ELSE 0 END, 'type', left(COALESCE(a ->> 'type', ''), 100)));
  END LOOP;

  IF v_body = '' AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'escreva a resposta'; END IF;
  IF length(v_body) > 2000 THEN RAISE EXCEPTION 'resposta muito longa (máximo 2000 caracteres)'; END IF;
  IF v_body = '' THEN v_body := '(anexo)'; END IF;

  -- clique duplo ou reenvio sem querer
  IF EXISTS (SELECT 1 FROM public.ticket_messages m WHERE m.ticket_id = _ticket_id AND m.sender_id = v_uid AND m.sender_type = 'staff'
                AND m.body = v_body AND m.created_at > now() - interval '10 seconds') THEN
    RAISE EXCEPTION 'essa resposta acabou de ser enviada';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email, 'Suporte') INTO v_name FROM public.profiles p WHERE p.user_id = v_uid;
  v_name := COALESCE(v_name, 'Suporte');
  v_role := CASE WHEN app_private.has_role(v_uid, 'admin'::app_role) THEN 'admin'
                 WHEN app_private.has_role(v_uid, 'manager'::app_role) THEN 'manager'
                 WHEN app_private.has_role(v_uid, 'employee'::app_role) THEN 'employee'
                 ELSE 'staff' END;

  INSERT INTO public.ticket_messages (ticket_id, sender_id, sender_type, sender_name, sender_role, body, attachments, read_by_staff, read_by_customer)
  VALUES (_ticket_id, v_uid, 'staff', v_name, v_role, v_body, v_att, true, false)
  RETURNING id, created_at INTO v_id, v_at;

  -- quem responde já leu o chamado
  UPDATE public.support_tickets SET unread_by_staff = 0 WHERE id = _ticket_id AND unread_by_staff <> 0;
  UPDATE public.ticket_messages SET read_by_staff = true WHERE ticket_id = _ticket_id AND sender_type = 'customer' AND read_by_staff = false;

  PERFORM app_private.admin_audit(v_uid, 'ticket_reply', 'support_ticket', _ticket_id::text,
    jsonb_build_object('message_id', v_id, 'attachments', jsonb_array_length(v_att), 'length', length(v_body)));
  RETURN jsonb_build_object('id', v_id, 'created_at', v_at, 'name', v_name, 'role', v_role);
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_set_ticket_status(_ticket_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := app_private.assert_support('reply');
  v_cur text;
BEGIN
  IF _status NOT IN ('closed', 'open') THEN RAISE EXCEPTION 'situação inválida'; END IF;
  SELECT status INTO v_cur FROM public.support_tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado não encontrado'; END IF;

  IF _status = 'closed' THEN
    IF v_cur IN ('closed', 'resolved') THEN RETURN jsonb_build_object('status', v_cur, 'changed', false); END IF;
    UPDATE public.support_tickets SET status = 'closed' WHERE id = _ticket_id;
    PERFORM app_private.admin_audit(v_uid, 'ticket_close', 'support_ticket', _ticket_id::text, jsonb_build_object('from', v_cur));
    RETURN jsonb_build_object('status', 'closed', 'changed', true);
  END IF;

  IF v_cur NOT IN ('closed', 'resolved') THEN RETURN jsonb_build_object('status', v_cur, 'changed', false); END IF;
  UPDATE public.support_tickets SET status = 'open' WHERE id = _ticket_id;
  PERFORM app_private.admin_audit(v_uid, 'ticket_reopen', 'support_ticket', _ticket_id::text, jsonb_build_object('from', v_cur));
  RETURN jsonb_build_object('status', 'open', 'changed', true);
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_set_ticket_priority(_ticket_id uuid, _priority text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := app_private.assert_support('reply');
  v_cur text;
BEGIN
  IF _priority NOT IN ('low', 'normal', 'high', 'urgent') THEN RAISE EXCEPTION 'prioridade inválida'; END IF;
  SELECT priority INTO v_cur FROM public.support_tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado não encontrado'; END IF;
  IF v_cur = _priority THEN RETURN jsonb_build_object('priority', v_cur, 'changed', false); END IF;
  UPDATE public.support_tickets SET priority = _priority WHERE id = _ticket_id;
  PERFORM app_private.admin_audit(v_uid, 'ticket_priority', 'support_ticket', _ticket_id::text, jsonb_build_object('from', v_cur, 'to', _priority));
  RETURN jsonb_build_object('priority', _priority, 'changed', true);
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_mark_ticket_read(_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM app_private.assert_support('view');
  UPDATE public.support_tickets SET unread_by_staff = 0 WHERE id = _ticket_id AND unread_by_staff <> 0;
  UPDATE public.ticket_messages SET read_by_staff = true WHERE ticket_id = _ticket_id AND sender_type = 'customer' AND read_by_staff = false;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ───────────────────────── wrappers públicos ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_support_page(_filter text DEFAULT 'waiting', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_support_page(_filter, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_support_ticket(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_support_ticket(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_reply_ticket(_ticket_id uuid, _body text, _attachments jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_reply_ticket(_ticket_id, _body, _attachments); $$;

CREATE OR REPLACE FUNCTION public.admin_set_ticket_status(_ticket_id uuid, _status text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_ticket_status(_ticket_id, _status); $$;

CREATE OR REPLACE FUNCTION public.admin_set_ticket_priority(_ticket_id uuid, _priority text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_ticket_priority(_ticket_id, _priority); $$;

CREATE OR REPLACE FUNCTION public.admin_mark_ticket_read(_ticket_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_mark_ticket_read(_ticket_id); $$;

-- ───────────────────────── permissões das funções ─────────────────────────

REVOKE ALL ON FUNCTION app_private.support_base(text, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  app_private.can_support(uuid, text), app_private.assert_support(text), app_private.ticket_stage(text, timestamptz, timestamptz),
  app_private.get_admin_support_page(text, text, integer, integer), app_private.get_admin_support_ticket(uuid),
  app_private.admin_reply_ticket(uuid, text, jsonb), app_private.admin_set_ticket_status(uuid, text),
  app_private.admin_set_ticket_priority(uuid, text), app_private.admin_mark_ticket_read(uuid),
  public.get_admin_support_page(text, text, integer, integer), public.get_admin_support_ticket(uuid),
  public.admin_reply_ticket(uuid, text, jsonb), public.admin_set_ticket_status(uuid, text),
  public.admin_set_ticket_priority(uuid, text), public.admin_mark_ticket_read(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.can_support(uuid, text), app_private.assert_support(text), app_private.ticket_stage(text, timestamptz, timestamptz),
  app_private.get_admin_support_page(text, text, integer, integer), app_private.get_admin_support_ticket(uuid),
  app_private.admin_reply_ticket(uuid, text, jsonb), app_private.admin_set_ticket_status(uuid, text),
  app_private.admin_set_ticket_priority(uuid, text), app_private.admin_mark_ticket_read(uuid),
  public.get_admin_support_page(text, text, integer, integer), public.get_admin_support_ticket(uuid),
  public.admin_reply_ticket(uuid, text, jsonb), public.admin_set_ticket_status(uuid, text),
  public.admin_set_ticket_priority(uuid, text), public.admin_mark_ticket_read(uuid)
  TO authenticated, service_role;
