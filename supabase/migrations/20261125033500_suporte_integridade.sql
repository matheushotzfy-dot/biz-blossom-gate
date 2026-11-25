-- APLICADA em 2026-11-25 (aprovada por Lucker, rodada via Lovable query_database; idempotente) — Suporte: fechar as brechas de integridade e dar ao cliente o que a tela já pede.
--
-- O que encontrei (só leitura, nada foi alterado):
--  1) O cliente pode dar UPDATE em QUALQUER coluna de QUALQUER mensagem dos próprios chamados (policy read_flag_updates
--     + GRANT UPDATE na tabela inteira): dá para trocar o texto de uma resposta da equipe, o sender_type ou os anexos.
--  2) O cliente pode criar chamado já com status 'answered', admin_reply/admin_name/admin_role falsos, replied_at e
--     contadores de não lido à vontade (a policy de INSERT só confere user_id).
--  3) O cliente pode mandar mensagem com created_at inventado (passado/futuro): isso bagunça a ordem da conversa e o
--     last_message_at do chamado (o trigger usa NEW.created_at).
--  4) Não há CHECK em status/priority/tamanhos: qualquer texto entra.
--  5) O cliente não consegue zerar unread_by_customer (não existe policy de UPDATE em support_tickets para ele) nem
--     marcar o chamado como resolvido/reabrir. Hoje a tela guarda o "não lido" só no aparelho (localStorage).
--
-- Dados atuais conferidos antes: 1 chamado e 13 mensagens, todos dentro dos limites abaixo (0 violações).
-- Nada do painel admin muda: ele usa a policy "Admins manage all tickets" e o insert de mensagens como staff.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) CHECKs (valores que o painel admin e a tela já usam)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open','pending','in_progress','answered','resolved','closed'));

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_priority_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_priority_check
  CHECK (priority IN ('low','normal','high','urgent'));

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_subject_len;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_subject_len
  CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200);

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_message_len;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_message_len
  CHECK (char_length(message) BETWEEN 1 AND 4000);

ALTER TABLE public.ticket_messages DROP CONSTRAINT IF EXISTS ticket_messages_body_len;
ALTER TABLE public.ticket_messages ADD CONSTRAINT ticket_messages_body_len
  CHECK (char_length(body) BETWEEN 1 AND 10000);

ALTER TABLE public.ticket_messages DROP CONSTRAINT IF EXISTS ticket_messages_attachments_check;
ALTER TABLE public.ticket_messages ADD CONSTRAINT ticket_messages_attachments_check
  CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 10);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Chamado novo: os campos do servidor vêm do servidor (staff/admin e jobs passam direto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_support_ticket_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL
     OR app_private.has_role(_caller, 'admin'::app_role)
     OR app_private.has_role(_caller, 'manager'::app_role)
     OR app_private.has_role(_caller, 'employee'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.status := 'open';
  NEW.admin_reply := NULL;
  NEW.admin_user_id := NULL;
  NEW.admin_name := NULL;
  NEW.admin_role := NULL;
  NEW.replied_at := NULL;
  NEW.unread_by_staff := 0;      -- a primeira mensagem soma 1 pelo trigger sync_ticket_on_message
  NEW.unread_by_customer := 0;
  NEW.created_at := now();
  NEW.updated_at := now();
  NEW.last_message_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_support_ticket_insert ON public.support_tickets;
CREATE TRIGGER trg_guard_support_ticket_insert
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_support_ticket_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Mensagem do cliente: data e identificação não vêm do navegador
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_ticket_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL
     OR app_private.has_role(_caller, 'admin'::app_role)
     OR app_private.has_role(_caller, 'manager'::app_role)
     OR app_private.has_role(_caller, 'employee'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.sender_type := 'customer';
  NEW.sender_name := NULL;
  NEW.sender_role := NULL;
  NEW.read_by_customer := true;
  NEW.read_by_staff := false;
  NEW.created_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_ticket_message_insert ON public.ticket_messages;
CREATE TRIGGER trg_guard_ticket_message_insert
  BEFORE INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_message_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) UPDATE em ticket_messages: só os dois marcadores de leitura, e só pela equipe.
--    O cliente passa a usar mark_my_ticket_read (abaixo).
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE UPDATE ON public.ticket_messages FROM authenticated;
GRANT UPDATE (read_by_customer, read_by_staff) ON public.ticket_messages TO authenticated;

DROP POLICY IF EXISTS read_flag_updates ON public.ticket_messages;
DROP POLICY IF EXISTS staff_update_read_flags ON public.ticket_messages;
CREATE POLICY staff_update_read_flags ON public.ticket_messages
  FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role)
      OR app_private.has_role(auth.uid(), 'manager'::app_role)
      OR app_private.has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role)
      OR app_private.has_role(auth.uid(), 'manager'::app_role)
      OR app_private.has_role(auth.uid(), 'employee'::app_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) O cliente marca o chamado como lido (vale em qualquer aparelho)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_my_ticket_read(_ticket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = _ticket_id AND user_id = _caller) THEN
    RETURN; -- chamado que não é do usuário: não revela nada
  END IF;
  UPDATE public.support_tickets
     SET unread_by_customer = 0
   WHERE id = _ticket_id AND user_id = _caller AND unread_by_customer <> 0;
  UPDATE public.ticket_messages
     SET read_by_customer = true
   WHERE ticket_id = _ticket_id AND sender_type = 'staff' AND read_by_customer = false;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_my_ticket_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_my_ticket_read(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) O cliente marca como resolvido ou reabre o próprio chamado
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_my_ticket_status(_ticket_id uuid, _status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _current text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF _status NOT IN ('resolved', 'open') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO _current FROM public.support_tickets
   WHERE id = _ticket_id AND user_id = _caller FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF _status = 'resolved' AND _current IN ('resolved', 'closed') THEN RETURN _current; END IF;
  IF _status = 'open' AND _current NOT IN ('resolved', 'closed') THEN RETURN _current; END IF;
  UPDATE public.support_tickets SET status = _status WHERE id = _ticket_id;
  RETURN _status;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_my_ticket_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_ticket_status(uuid, text) TO authenticated;

-- Depois da aprovação eu ligo na tela: trocar o "zerar unread_by_customer" local por mark_my_ticket_read
-- e incluir o botão "Marcar como resolvido" / "Reabrir" usando set_my_ticket_status.
--
-- Reverter (se precisar):
--   DROP TRIGGER trg_guard_support_ticket_insert ON public.support_tickets;
--   DROP TRIGGER trg_guard_ticket_message_insert ON public.ticket_messages;
--   DROP FUNCTION public.guard_support_ticket_insert(), public.guard_ticket_message_insert(),
--                 public.mark_my_ticket_read(uuid), public.set_my_ticket_status(uuid, text);
--   ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_status_check, DROP CONSTRAINT support_tickets_priority_check,
--     DROP CONSTRAINT support_tickets_subject_len, DROP CONSTRAINT support_tickets_message_len;
--   ALTER TABLE public.ticket_messages DROP CONSTRAINT ticket_messages_body_len, DROP CONSTRAINT ticket_messages_attachments_check;
--   (e recriar a policy read_flag_updates + GRANT UPDATE na tabela inteira, se quiser voltar ao desenho antigo)
