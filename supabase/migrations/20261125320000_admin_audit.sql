-- Auditoria do admin: leitura única no servidor, registros fechados para escrita direta e ruído tirado na origem.
-- Antes: qualquer admin gravava entrada em nome de outro (a política não olhava o autor), a equipe inseria linha falsa
-- no próprio histórico, o gatilho da equipe guardava a linha inteira (CPF cifrado, impressão digital do documento,
-- telefone, endereço, IP) a cada update (30 das 33 entradas eram só troca de tema), 327 de 335 "produto atualizado"
-- eram linhas vazias, cada curso era registrado em dobro (dois gatilhos iguais) e a tela lia 3x1000 linhas no navegador.

-- ───────────────────────── travas ─────────────────────────

REVOKE ALL ON public.audit_logs, public.staff_audit_log, public.activity_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM authenticated;
REVOKE INSERT ON public.staff_audit_log FROM authenticated;

-- staff_audit_log: só gatilhos, funções do banco e funções de borda (service role) gravam.
DROP POLICY IF EXISTS "System and staff insert audit" ON public.staff_audit_log;

-- audit_logs: o admin grava só em nome de si mesmo (o legado `logAdminAction` continua funcionando).
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins insert own audit logs" ON public.audit_logs;
CREATE POLICY "Admins insert own audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND app_private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;   -- duplicada de "Admin can view audit logs"

-- activity_logs: três políticas de leitura diziam a mesma coisa; fica a que cobre as duas (própria ou admin).
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_logs;

-- ───────────────────────── funções puras de apoio ─────────────────────────

-- Nomes de campos que nunca aparecem com o valor (segredos, documento, chave PIX, versões cifradas).
CREATE OR REPLACE FUNCTION app_private.audit_key_hidden(_k text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT _k IS NOT NULL
     AND _k !~* '^(has|is)_'
     AND (_k ~* '(password|senha|secret|token|api[_-]?key|key_value|_enc$|fingerprint|cvv|card_number|account_number|holder_document|authorization)'
          OR _k ~* '^(cpf|cnpj|document|document_number|pix_key)$');
$function$;

-- Cópia do JSON com os campos escondidos trocados por "[oculto]" (em qualquer profundidade).
CREATE OR REPLACE FUNCTION app_private.audit_redact(_j jsonb, _depth integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _out jsonb; _k text; _v jsonb;
BEGIN
  IF _j IS NULL THEN RETURN NULL; END IF;
  IF _depth > 6 THEN RETURN to_jsonb('[…]'::text); END IF;
  IF jsonb_typeof(_j) = 'object' THEN
    _out := '{}'::jsonb;
    FOR _k, _v IN SELECT e.key, e.value FROM jsonb_each(_j) e LOOP
      _out := _out || jsonb_build_object(_k, CASE WHEN app_private.audit_key_hidden(_k) THEN to_jsonb('[oculto]'::text) ELSE app_private.audit_redact(_v, _depth + 1) END);
    END LOOP;
    RETURN _out;
  ELSIF jsonb_typeof(_j) = 'array' THEN
    SELECT COALESCE(jsonb_agg(app_private.audit_redact(x.v, _depth + 1) ORDER BY x.n), '[]'::jsonb) INTO _out
      FROM jsonb_array_elements(_j) WITH ORDINALITY AS x(v, n);
    RETURN _out;
  END IF;
  RETURN _j;
END
$function$;

-- Só o que mudou: { campo: { from, to } }. Campos de ruído (tema, último acesso, carimbos) ficam de fora.
CREATE OR REPLACE FUNCTION app_private.audit_diff(_before jsonb, _after jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'app_private'
AS $function$
  WITH o AS (
    SELECT CASE WHEN jsonb_typeof(_before) = 'object' THEN _before ELSE '{}'::jsonb END AS b,
           CASE WHEN jsonb_typeof(_after)  = 'object' THEN _after  ELSE '{}'::jsonb END AS a
  )
  SELECT COALESCE(jsonb_object_agg(k.key, jsonb_build_object(
           'from', CASE WHEN app_private.audit_key_hidden(k.key) THEN to_jsonb('[oculto]'::text) ELSE app_private.audit_redact(o.b -> k.key) END,
           'to',   CASE WHEN app_private.audit_key_hidden(k.key) THEN to_jsonb('[oculto]'::text) ELSE app_private.audit_redact(o.a -> k.key) END)),
         '{}'::jsonb)
    FROM o, LATERAL jsonb_object_keys(o.b || o.a) AS k(key)
   WHERE k.key <> ALL (ARRAY['updated_at', 'created_at', 'last_login_at', 'last_ip', 'theme_preference', 'kyc_popup_snoozed_until'])
     AND COALESCE(o.b -> k.key, 'null'::jsonb) IS DISTINCT FROM COALESCE(o.a -> k.key, 'null'::jsonb);
$function$;

-- Ação que mexe em dinheiro, acesso ou dados pessoais.
CREATE OR REPLACE FUNCTION app_private.audit_is_sensitive(_action text, _entity text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_entity IN ('fees', 'custom_user_fees', 'pix_keys', 'bank_accounts'), false)
      OR COALESCE(_action ~* '^(impersonate|reveal|pii_reveal|kill_switch|data_export|audit_export|balance_adjustment|freeze|unfreeze|ban_|block_user|approve_user|approve_kyc|reject_kyc|reject_withdrawal|approve_withdrawal|upload_withdrawal_proof|transaction_refund|update_custom_fees|custom_fees_reset|platform_fee_update|platform_settings|set_max_ticket|max_ticket_set|update_retention|card_release|update_seller_auto_withdraw|update_seller_payment_methods|delete_pix_key|create_staff|create_partner|reset_staff_password|update_staff|configure_staff|update_manager|manager_default|seller_manager|email_verif|update_require_email|manual_approval|set_seller_acquirer|update_acquirer|release_login_lockout|update_(profiles|withdrawals|transactions)$)', false);
$function$;

-- Entradas antigas da equipe guardavam a linha inteira do perfil e 30 de 33 eram só troca de tema: não são ação de ninguém.
CREATE OR REPLACE FUNCTION app_private.audit_is_noise(_before jsonb, _after jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'app_private'
AS $function$
  SELECT COALESCE(jsonb_typeof(_before) = 'object' AND jsonb_typeof(_after) = 'object'
                  AND _before ? 'theme_preference'
                  AND app_private.audit_diff(_before, _after) = '{}'::jsonb, false);
$function$;

CREATE OR REPLACE FUNCTION app_private.audit_person(_full text, _nick text, _email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(btrim(_full), ''), NULLIF(btrim(_nick), ''), NULLIF(split_part(COALESCE(_email, ''), '@', 1), ''));
$function$;

CREATE OR REPLACE FUNCTION app_private.audit_actor_role(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE min(CASE ur.role::text WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'employee' THEN 3 WHEN 'partner' THEN 4 ELSE 5 END)
           WHEN 1 THEN 'admin' WHEN 2 THEN 'manager' WHEN 3 THEN 'employee' WHEN 4 THEN 'partner' ELSE 'seller' END
    FROM public.user_roles ur WHERE ur.user_id = _uid;
$function$;

-- Antes e depois: os dois objetos viram "changes"; só um dos lados vira "snapshot" (criado ou apagado).
CREATE OR REPLACE FUNCTION app_private.audit_change_block(_b jsonb, _a jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'app_private'
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(_b) = 'object' AND jsonb_typeof(_a) = 'object' THEN jsonb_build_object('changes', app_private.audit_diff(_b, _a))
    WHEN jsonb_typeof(_a) = 'object' THEN jsonb_build_object('snapshot', app_private.audit_redact(_a), 'snapshot_of', 'after')
    WHEN jsonb_typeof(_b) = 'object' THEN jsonb_build_object('snapshot', app_private.audit_redact(_b), 'snapshot_of', 'before')
    ELSE '{}'::jsonb END;
$function$;

-- O que a tela mostra de uma entrada: { fields?, changes?, snapshot?, snapshot_of? }, tudo sem segredo.
CREATE OR REPLACE FUNCTION app_private.audit_detail(_source text, _details jsonb, _before jsonb, _after jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _d jsonb; _blk jsonb; _fields jsonb;
BEGIN
  IF _source = 'admin' THEN
    _d := CASE WHEN jsonb_typeof(_details) = 'object' THEN _details ELSE '{}'::jsonb END;
    _blk := app_private.audit_change_block(_d -> 'before', _d -> 'after');
    _fields := app_private.audit_redact(_d - 'before' - 'after');
    IF _fields = '{}'::jsonb THEN RETURN _blk; END IF;
    RETURN _blk || jsonb_build_object('fields', _fields);
  END IF;
  RETURN app_private.audit_change_block(_before, _after);
END
$function$;

-- Resumo curto para a linha da lista: campos que mudaram e até 6 valores simples.
CREATE OR REPLACE FUNCTION app_private.audit_hint(_detail jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _changes jsonb := COALESCE(_detail -> 'changes', '{}'::jsonb); _changed jsonb; _src jsonb; _fields jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(c.k), '[]'::jsonb) INTO _changed
    FROM (SELECT k FROM jsonb_object_keys(_changes) AS k ORDER BY k LIMIT 8) c;
  _src := COALESCE(_detail -> 'fields', _detail -> 'snapshot', '{}'::jsonb);
  IF jsonb_typeof(_src) <> 'object' THEN _src := '{}'::jsonb; END IF;
  SELECT COALESCE(jsonb_object_agg(e.key, CASE WHEN jsonb_typeof(e.value) = 'string' THEN to_jsonb(left(e.value #>> '{}', 80)) ELSE e.value END), '{}'::jsonb) INTO _fields
    FROM (SELECT x.key, x.value FROM jsonb_each(_src) x WHERE jsonb_typeof(x.value) IN ('string', 'number', 'boolean') ORDER BY x.key LIMIT 6) e;
  RETURN jsonb_build_object('changed', _changed, 'changed_n', (SELECT count(*) FROM jsonb_object_keys(_changes)), 'fields', _fields);
END
$function$;

-- ───────────────────────── gatilhos ─────────────────────────

-- Antes de gravar uma entrada vinda do navegador: limita tamanho, esconde segredo e anota o IP de quem fez.
CREATE OR REPLACE FUNCTION app_private.guard_audit_logs_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _h jsonb; _ip text;
BEGIN
  NEW.action := left(NEW.action, 100);
  NEW.entity_type := left(NEW.entity_type, 60);
  NEW.entity_id := left(NEW.entity_id, 255);
  NEW.user_agent := left(NEW.user_agent, 500);
  NEW.details := app_private.audit_redact(COALESCE(NEW.details, '{}'::jsonb));
  IF pg_column_size(NEW.details) > 20000 THEN NEW.details := jsonb_build_object('truncado', true); END IF;
  IF NEW.ip_address IS NULL THEN
    BEGIN
      _h := NULLIF(current_setting('request.headers', true), '')::jsonb;
      _ip := NULLIF(btrim(split_part(COALESCE(_h ->> 'x-forwarded-for', _h ->> 'cf-connecting-ip', _h ->> 'x-real-ip', ''), ',', 1)), '');
      NEW.ip_address := left(_ip, 64);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_00_guard_audit_logs_insert ON public.audit_logs;
CREATE TRIGGER trg_00_guard_audit_logs_insert BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_audit_logs_insert();

-- Equipe: guarda só o que mudou (e só se mudou algo que importa). Segredos entram como "[oculto]".
CREATE OR REPLACE FUNCTION public.log_staff_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _old jsonb; _new jsonb; _diff jsonb; _before jsonb; _after jsonb; _entity text; _target text;
BEGIN
  IF _actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- só registra se for staff ou manager (admin entra também, é útil)
  IF NOT (
    has_role(_actor, 'employee'::app_role)
    OR has_role(_actor, 'manager'::app_role)
    OR has_role(_actor, 'admin'::app_role)
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  _new := CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) END;

  IF TG_OP = 'UPDATE' THEN
    _diff := app_private.audit_diff(_old, _new);
    IF _diff = '{}'::jsonb THEN
      RETURN NEW;   -- só tema, último acesso ou carimbo mudou: não é ação de ninguém
    END IF;
    SELECT jsonb_object_agg(d.key, CASE WHEN app_private.audit_key_hidden(d.key) THEN to_jsonb('[oculto]'::text) ELSE d.value -> 'from' END),
           jsonb_object_agg(d.key, CASE WHEN app_private.audit_key_hidden(d.key) THEN to_jsonb('[oculto*]'::text) ELSE d.value -> 'to' END)
      INTO _before, _after
      FROM jsonb_each(_diff) d;
  ELSE
    _before := app_private.audit_redact(_old);
    _after := app_private.audit_redact(_new);
  END IF;

  _entity := CASE WHEN TG_TABLE_NAME = 'profiles' THEN COALESCE(_new ->> 'user_id', _old ->> 'user_id', _new ->> 'id', _old ->> 'id')
                  ELSE COALESCE(_new ->> 'id', _old ->> 'id') END;
  _target := COALESCE(_new ->> 'user_id', _new ->> 'seller_user_id', _old ->> 'user_id', _old ->> 'seller_user_id');

  INSERT INTO public.staff_audit_log (staff_user_id, action, entity_type, entity_id, before, after, metadata)
  VALUES (_actor, TG_OP || '_' || TG_TABLE_NAME, TG_TABLE_NAME, _entity, _before, _after,
          jsonb_strip_nulls(jsonb_build_object('target_user_id', _target)));
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Produtos e cursos: update que não mudou nada do que se registra não é atividade.
CREATE OR REPLACE FUNCTION public.log_product_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.user_id, 'product_created', 'product', NEW.id::text,
      jsonb_build_object('name', NEW.name, 'price', NEW.price, 'description', NEW.description, 'status', NEW.status, 'image_url', NEW.image_url, 'checkout_url', NEW.checkout_url));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.name, OLD.price, OLD.description, OLD.status, OLD.image_url) IS NOT DISTINCT FROM (NEW.name, NEW.price, NEW.description, NEW.status, NEW.image_url) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (OLD.user_id, 'product_updated', 'product', OLD.id::text,
      jsonb_build_object('name', OLD.name, 'price', OLD.price, 'description', OLD.description, 'status', OLD.status, 'image_url', OLD.image_url),
      jsonb_build_object('name', NEW.name, 'price', NEW.price, 'description', NEW.description, 'status', NEW.status, 'image_url', NEW.image_url));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.user_id, 'product_deleted', 'product', OLD.id::text,
      jsonb_build_object('name', OLD.name, 'price', OLD.price, 'description', OLD.description, 'status', OLD.status, 'image_url', OLD.image_url, 'checkout_url', OLD.checkout_url));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_course_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.user_id, 'course_created', 'course', NEW.id::text,
      jsonb_build_object('title', NEW.title, 'description', NEW.description, 'is_published', NEW.is_published));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.title, OLD.is_published) IS NOT DISTINCT FROM (NEW.title, NEW.is_published) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (OLD.user_id, 'course_updated', 'course', OLD.id::text,
      jsonb_build_object('title', OLD.title, 'is_published', OLD.is_published),
      jsonb_build_object('title', NEW.title, 'is_published', NEW.is_published));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.user_id, 'course_deleted', 'course', OLD.id::text,
      jsonb_build_object('title', OLD.title, 'description', OLD.description));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Os dois gatilhos eram idênticos: cada curso entrava duas vezes.
DROP TRIGGER IF EXISTS log_course_changes_trigger ON public.courses;

-- Limpeza só do que não diz nada: update sem mudança e linha de curso repetida na mesma hora.
DELETE FROM public.activity_logs WHERE action = 'product_updated' AND old_data IS NOT DISTINCT FROM new_data;
DELETE FROM public.activity_logs
 WHERE ctid IN (
   SELECT d.ctid FROM (
     SELECT l.ctid, row_number() OVER (PARTITION BY l.user_id, l.action, l.entity_type, l.entity_id, l.created_at, l.old_data, l.new_data ORDER BY l.id) AS rn
       FROM public.activity_logs l WHERE l.entity_type = 'course'
   ) d WHERE d.rn > 1);

-- ───────────────────────── exportação de vendas do vendedor ─────────────────────────
-- O navegador tentava gravar em activity_logs (sem política, falhava calado): ninguém sabia quem exportou vendas.
CREATE OR REPLACE FUNCTION app_private.log_seller_export(_format text, _count integer, _range_from timestamptz, _range_to timestamptz, _has_search boolean, _privacy boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _format NOT IN ('csv', 'xlsx') THEN RAISE EXCEPTION 'Formato inválido.'; END IF;
  INSERT INTO public.activity_logs (user_id, action, entity_type, new_data)
  VALUES (_uid, 'export_sales', 'transactions', jsonb_strip_nulls(jsonb_build_object(
    'format', _format, 'count', LEAST(GREATEST(COALESCE(_count, 0), 0), 10000000),
    'range_from', _range_from, 'range_to', _range_to, 'filtered_by_search', COALESCE(_has_search, false), 'privacy_mode', COALESCE(_privacy, false))));
END
$function$;

-- ───────────────────────── leitura do admin ─────────────────────────

-- Lista única (administração + equipe + vendedores) com filtros, totais exatos e contagens por filtro.
-- _export = true devolve também o detalhe de cada linha, exige senha recente e registra a exportação na 1ª página.
CREATE OR REPLACE FUNCTION app_private.get_admin_audit_page(
  _source text DEFAULT 'all', _days integer DEFAULT NULL, _actor uuid DEFAULT NULL, _entity text DEFAULT NULL,
  _search text DEFAULT NULL, _only_sensitive boolean DEFAULT false, _page integer DEFAULT 1, _page_size integer DEFAULT 25,
  _export boolean DEFAULT false, _until timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := app_private.assert_admin();
  _src text := CASE WHEN _source IN ('admin', 'staff', 'activity') THEN _source ELSE 'all' END;
  _from timestamptz := NULL;
  _q text := NULLIF(left(btrim(COALESCE(_search, '')), 100), '');
  _pat text;
  _ps integer := LEAST(GREATEST(COALESCE(_page_size, 25), 1), CASE WHEN _export THEN 1000 ELSE 100 END);
  _pg integer := GREATEST(COALESCE(_page, 1), 1);
  _ent text := NULLIF(left(btrim(COALESCE(_entity, '')), 300), '');  -- uma lista separada por vírgula agrupa tipos que a tela mostra com o mesmo nome
  _sens boolean := COALESCE(_only_sensitive, false);
  _today timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  _res jsonb;
  _ov jsonb;
BEGIN
  IF _export THEN PERFORM app_private.assert_recent_auth(); END IF;
  IF _days IS NOT NULL THEN
    IF _days NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Período inválido.'; END IF;
    _from := (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') - make_interval(days => _days - 1)) AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  IF _q IS NOT NULL THEN
    _pat := '%' || replace(replace(replace(_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH s AS (
    SELECT 'admin'::text AS source, a.id, a.created_at, a.admin_user_id AS actor_id, a.action, a.entity_type, a.entity_id,
           a.details AS d_details, NULL::jsonb AS d_before, NULL::jsonb AS d_after, NULL::jsonb AS meta, a.ip_address, a.user_agent
      FROM public.audit_logs a
     WHERE (_from IS NULL OR a.created_at >= _from) AND (_until IS NULL OR a.created_at <= _until)
    UNION ALL
    SELECT 'staff', l.id, l.created_at, l.staff_user_id, l.action, l.entity_type, l.entity_id,
           NULL::jsonb, l.before, l.after, l.metadata, NULL::text, NULL::text
      FROM public.staff_audit_log l
     WHERE (_from IS NULL OR l.created_at >= _from) AND (_until IS NULL OR l.created_at <= _until)
       AND NOT app_private.audit_is_noise(l.before, l.after)
    UNION ALL
    SELECT 'activity', c.id, c.created_at, c.user_id, c.action, c.entity_type, c.entity_id,
           NULL::jsonb, c.old_data, c.new_data, NULL::jsonb, NULL::text, NULL::text
      FROM public.activity_logs c
     WHERE (_from IS NULL OR c.created_at >= _from) AND (_until IS NULL OR c.created_at <= _until)
  ), e AS (
    SELECT s.*,
           CASE WHEN s.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN s.entity_id::uuid END AS eid,
           CASE WHEN s.meta ->> 'target_user_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (s.meta ->> 'target_user_id')::uuid END AS tid
      FROM s
  ), b AS (
    SELECT e.source, e.id, e.created_at, e.actor_id, e.action, e.entity_type, e.entity_id, e.d_details, e.d_before, e.d_after, e.ip_address,
           app_private.audit_person(pa.full_name, pa.nickname, pa.email) AS actor_name,
           pa.email AS actor_email,
           COALESCE(app_private.audit_person(pe.full_name, pe.nickname, pe.email), pr.name, aq.name, co.title,
                    app_private.audit_person(pt.full_name, pt.nickname, pt.email)) AS ent_label,
           COALESCE(pe.email, pt.email) AS ent_email,
           app_private.audit_is_sensitive(e.action, e.entity_type) AS sens
      FROM e
      LEFT JOIN public.profiles pa ON pa.user_id = e.actor_id
      LEFT JOIN public.profiles pe ON e.entity_type IN ('profile', 'profiles', 'seller', 'staff', 'auth.user', 'user')
                                  AND (pe.user_id = e.eid OR (e.entity_type = 'profiles' AND pe.id = e.eid))
      LEFT JOIN public.products pr ON e.entity_type = 'product' AND pr.id = e.eid
      LEFT JOIN public.acquirers aq ON e.entity_type = 'acquirer' AND aq.id = e.eid
      LEFT JOIN public.courses co ON e.entity_type = 'course' AND co.id = e.eid
      LEFT JOIN public.profiles pt ON e.tid IS NOT NULL AND pt.user_id = e.tid
  ), f AS (
    SELECT b.*,
           (_src = 'all' OR b.source = _src) AS m_src,
           (_actor IS NULL OR b.actor_id = _actor) AS m_act,
           (_ent IS NULL OR b.entity_type = ANY(string_to_array(_ent, ','))) AS m_ent
      FROM b
     WHERE (NOT _sens OR b.sens)
       AND (_pat IS NULL OR b.action ILIKE _pat OR b.entity_type ILIKE _pat OR b.entity_id ILIKE _pat
            OR b.actor_name ILIKE _pat OR b.actor_email ILIKE _pat OR b.ent_label ILIKE _pat OR b.ent_email ILIKE _pat)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f WHERE m_src AND m_act AND m_ent),
    'page', _pg,
    'page_size', _ps,
    'sources', (SELECT jsonb_build_object(
        'all', count(*) FILTER (WHERE m_act AND m_ent),
        'admin', count(*) FILTER (WHERE source = 'admin' AND m_act AND m_ent),
        'staff', count(*) FILTER (WHERE source = 'staff' AND m_act AND m_ent),
        'activity', count(*) FILTER (WHERE source = 'activity' AND m_act AND m_ent)) FROM f),
    'entities', (SELECT COALESCE(jsonb_agg(jsonb_build_object('type', x.entity_type, 'n', x.n) ORDER BY x.n DESC, x.entity_type), '[]'::jsonb)
                   FROM (SELECT entity_type, count(*) AS n FROM f WHERE m_src AND m_act GROUP BY entity_type ORDER BY count(*) DESC, entity_type LIMIT 18) x),
    'actors', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.actor_id, 'name', x.name, 'email', x.email,
                      'role', CASE WHEN x.actor_id IS NULL THEN 'system' ELSE app_private.audit_actor_role(x.actor_id) END, 'n', x.n) ORDER BY x.n DESC, x.name), '[]'::jsonb)
                 FROM (SELECT actor_id, max(actor_name) AS name, max(actor_email) AS email, count(*) AS n
                         FROM f WHERE m_src AND m_ent GROUP BY actor_id ORDER BY count(*) DESC LIMIT 40) x),
    'items', (SELECT COALESCE(jsonb_agg(i.item ORDER BY i.created_at DESC, i.id DESC), '[]'::jsonb)
                FROM (SELECT p.created_at, p.id,
                             jsonb_build_object(
                               'id', p.id, 'source', p.source, 'at', p.created_at,
                               'actor', jsonb_build_object('id', p.actor_id, 'name', p.actor_name, 'email', p.actor_email,
                                                           'role', CASE WHEN p.actor_id IS NULL THEN 'system' ELSE app_private.audit_actor_role(p.actor_id) END),
                               'action', p.action, 'entity_type', p.entity_type, 'entity_id', p.entity_id, 'entity_label', p.ent_label,
                               'sensitive', p.sens, 'hint', app_private.audit_hint(dt.d))
                             || CASE WHEN _export THEN jsonb_build_object('detail', dt.d, 'ip', p.ip_address) ELSE '{}'::jsonb END AS item
                        FROM (SELECT * FROM f WHERE m_src AND m_act AND m_ent ORDER BY created_at DESC, id DESC OFFSET (_pg - 1) * _ps LIMIT _ps) p
                        CROSS JOIN LATERAL (SELECT app_private.audit_detail(p.source, p.d_details, p.d_before, p.d_after) AS d) dt) i)
  ) INTO _res;

  IF NOT _export THEN
    SELECT jsonb_build_object(
      'today', count(*) FILTER (WHERE u.created_at >= _today),
      'week', count(*) FILTER (WHERE u.created_at >= now() - interval '7 days'),
      'actors_week', count(DISTINCT u.actor_id) FILTER (WHERE u.created_at >= now() - interval '7 days'),
      'sensitive_week', count(*) FILTER (WHERE u.created_at >= now() - interval '7 days' AND app_private.audit_is_sensitive(u.action, u.entity_type)),
      'last_at', max(u.created_at),
      'total', count(*))
      INTO _ov
      FROM (SELECT created_at, admin_user_id AS actor_id, action, entity_type FROM public.audit_logs
            UNION ALL SELECT created_at, staff_user_id, action, entity_type FROM public.staff_audit_log WHERE NOT app_private.audit_is_noise(before, after)
            UNION ALL SELECT created_at, user_id, action, entity_type FROM public.activity_logs) u;
    _res := _res || jsonb_build_object('overview', _ov);
  ELSIF _pg = 1 THEN
    PERFORM app_private.admin_audit(_uid, 'audit_export', 'export', 'audit', jsonb_build_object(
      'source', _src, 'days', _days, 'actor', _actor, 'entity', _ent, 'search', _q, 'only_sensitive', _sens, 'rows', (_res ->> 'total')::integer));
  END IF;

  RETURN _res;
END
$function$;

-- Uma entrada por inteiro: quem, o quê, em quê, de onde, o detalhe sem segredo e as últimas ações no mesmo alvo.
CREATE OR REPLACE FUNCTION app_private.get_admin_audit_entry(_source text, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE r record; _ent_label text; _related jsonb; _actor jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF _source NOT IN ('admin', 'staff', 'activity') THEN RAISE EXCEPTION 'Origem inválida.'; END IF;

  SELECT x.* INTO r FROM (
    SELECT 'admin'::text AS source, a.id, a.created_at, a.admin_user_id AS actor_id, a.action, a.entity_type, a.entity_id,
           a.details AS d_details, NULL::jsonb AS d_before, NULL::jsonb AS d_after, NULL::jsonb AS meta, a.ip_address, a.user_agent
      FROM public.audit_logs a WHERE _source = 'admin' AND a.id = _id
    UNION ALL
    SELECT 'staff', l.id, l.created_at, l.staff_user_id, l.action, l.entity_type, l.entity_id, NULL::jsonb, l.before, l.after, l.metadata, NULL::text, NULL::text
      FROM public.staff_audit_log l WHERE _source = 'staff' AND l.id = _id
    UNION ALL
    SELECT 'activity', c.id, c.created_at, c.user_id, c.action, c.entity_type, c.entity_id, NULL::jsonb, c.old_data, c.new_data, NULL::jsonb, NULL::text, NULL::text
      FROM public.activity_logs c WHERE _source = 'activity' AND c.id = _id
  ) x;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;

  SELECT jsonb_build_object('id', r.actor_id, 'name', app_private.audit_person(p.full_name, p.nickname, p.email), 'email', p.email,
                            'role', CASE WHEN r.actor_id IS NULL THEN 'system' ELSE app_private.audit_actor_role(r.actor_id) END)
    INTO _actor FROM (SELECT 1) one LEFT JOIN public.profiles p ON p.user_id = r.actor_id;

  _ent_label := CASE
    WHEN r.entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NULL
    WHEN r.entity_type IN ('profile', 'profiles', 'seller', 'staff', 'auth.user', 'user') THEN
      (SELECT app_private.audit_person(p.full_name, p.nickname, p.email) FROM public.profiles p
        WHERE p.user_id = r.entity_id::uuid OR (r.entity_type = 'profiles' AND p.id = r.entity_id::uuid) LIMIT 1)
    WHEN r.entity_type = 'product' THEN (SELECT name FROM public.products WHERE id = r.entity_id::uuid)
    WHEN r.entity_type = 'acquirer' THEN (SELECT name FROM public.acquirers WHERE id = r.entity_id::uuid)
    WHEN r.entity_type = 'course' THEN (SELECT title FROM public.courses WHERE id = r.entity_id::uuid)
    ELSE NULL END;
  IF _ent_label IS NULL AND r.meta ->> 'target_user_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT app_private.audit_person(p.full_name, p.nickname, p.email) INTO _ent_label FROM public.profiles p WHERE p.user_id = (r.meta ->> 'target_user_id')::uuid;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', q.id, 'source', q.source, 'at', q.created_at, 'action', q.action,
                                               'actor_name', app_private.audit_person(p.full_name, p.nickname, p.email)) ORDER BY q.created_at DESC), '[]'::jsonb)
    INTO _related
    FROM (SELECT u.* FROM (
            SELECT 'admin'::text AS source, id, created_at, admin_user_id AS actor_id, action FROM public.audit_logs WHERE entity_type = r.entity_type AND entity_id = r.entity_id
            UNION ALL SELECT 'staff', id, created_at, staff_user_id, action FROM public.staff_audit_log WHERE entity_type = r.entity_type AND entity_id = r.entity_id AND NOT app_private.audit_is_noise(before, after)
            UNION ALL SELECT 'activity', id, created_at, user_id, action FROM public.activity_logs WHERE entity_type = r.entity_type AND entity_id = r.entity_id) u
           WHERE NOT (u.source = r.source AND u.id = r.id) ORDER BY u.created_at DESC LIMIT 8) q
    LEFT JOIN public.profiles p ON p.user_id = q.actor_id;

  RETURN jsonb_build_object(
    'id', r.id, 'source', r.source, 'at', r.created_at, 'actor', _actor,
    'action', r.action, 'entity_type', r.entity_type, 'entity_id', r.entity_id, 'entity_label', _ent_label,
    'sensitive', app_private.audit_is_sensitive(r.action, r.entity_type), 'ip', r.ip_address, 'user_agent', r.user_agent,
    'detail', app_private.audit_detail(r.source, r.d_details, r.d_before, r.d_after),
    'related', _related);
END
$function$;

-- ───────────────────────── funções públicas (SECURITY INVOKER) e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_audit_page(
  _source text DEFAULT 'all', _days integer DEFAULT NULL, _actor uuid DEFAULT NULL, _entity text DEFAULT NULL,
  _search text DEFAULT NULL, _only_sensitive boolean DEFAULT false, _page integer DEFAULT 1, _page_size integer DEFAULT 25,
  _export boolean DEFAULT false, _until timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_audit_page(_source, _days, _actor, _entity, _search, _only_sensitive, _page, _page_size, _export, _until) $function$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_entry(_source text, _id uuid)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_audit_entry(_source, _id) $function$;

CREATE OR REPLACE FUNCTION public.log_seller_export(_format text, _count integer, _range_from timestamptz, _range_to timestamptz, _has_search boolean, _privacy boolean)
RETURNS void
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.log_seller_export(_format, _count, _range_from, _range_to, _has_search, _privacy) $function$;

REVOKE ALL ON FUNCTION
  app_private.audit_key_hidden(text), app_private.audit_redact(jsonb, integer), app_private.audit_diff(jsonb, jsonb),
  app_private.audit_is_sensitive(text, text), app_private.audit_person(text, text, text), app_private.audit_actor_role(uuid),
  app_private.audit_change_block(jsonb, jsonb), app_private.audit_detail(text, jsonb, jsonb, jsonb), app_private.audit_hint(jsonb),
  app_private.guard_audit_logs_insert(), app_private.audit_is_noise(jsonb, jsonb),
  app_private.get_admin_audit_page(text, integer, uuid, text, text, boolean, integer, integer, boolean, timestamptz),
  app_private.get_admin_audit_entry(text, uuid),
  app_private.log_seller_export(text, integer, timestamptz, timestamptz, boolean, boolean),
  public.get_admin_audit_page(text, integer, uuid, text, text, boolean, integer, integer, boolean, timestamptz),
  public.get_admin_audit_entry(text, uuid),
  public.log_seller_export(text, integer, timestamptz, timestamptz, boolean, boolean)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.audit_key_hidden(text), app_private.audit_redact(jsonb, integer), app_private.audit_diff(jsonb, jsonb),
  app_private.audit_is_sensitive(text, text), app_private.audit_person(text, text, text), app_private.audit_actor_role(uuid),
  app_private.audit_change_block(jsonb, jsonb), app_private.audit_detail(text, jsonb, jsonb, jsonb), app_private.audit_hint(jsonb), app_private.audit_is_noise(jsonb, jsonb),
  app_private.get_admin_audit_page(text, integer, uuid, text, text, boolean, integer, integer, boolean, timestamptz),
  app_private.get_admin_audit_entry(text, uuid),
  app_private.log_seller_export(text, integer, timestamptz, timestamptz, boolean, boolean),
  public.get_admin_audit_page(text, integer, uuid, text, text, boolean, integer, integer, boolean, timestamptz),
  public.get_admin_audit_entry(text, uuid),
  public.log_seller_export(text, integer, timestamptz, timestamptz, boolean, boolean)
TO authenticated, service_role;
