-- Ferramentas do admin: pausas de emergência, exportações e notas sobre sellers.
-- Antes: o navegador gravava as pausas direto em platform_settings (sem motivo, sem senha, auditoria feita depois e
-- podendo falhar em silêncio), a pausa de pagamentos não era lida por nada, as exportações saíam de listas limitadas
-- (sem auditoria e sem proteção contra fórmula no CSV) e as notas eram gravadas mas nenhuma tela do admin as mostrava.

-- ───────────────────────── travas ─────────────────────────

-- platform_settings: só funções gravam (as de Configurações e esta). Leitura direta do admin continua.
REVOKE INSERT, UPDATE, DELETE ON public.platform_settings FROM authenticated;
REVOKE ALL ON public.platform_settings FROM anon;
DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins manage platform settings" ON public.platform_settings;

-- seller_notes: nota não se edita nem se apaga; o admin lê pelas funções e a equipe escreve pela própria política.
REVOKE ALL ON public.seller_notes FROM anon;
REVOKE UPDATE, DELETE ON public.seller_notes FROM authenticated;
DROP POLICY IF EXISTS "Admins manage seller notes" ON public.seller_notes;
DROP POLICY IF EXISTS "Admins read seller notes" ON public.seller_notes;
CREATE POLICY "Admins read seller notes" ON public.seller_notes FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role));

-- Quem não é admin não escolhe o próprio cargo na nota (o padrão da coluna era 'admin', inclusive para a equipe).
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
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_00_guard_seller_notes_insert ON public.seller_notes;
CREATE TRIGGER trg_00_guard_seller_notes_insert BEFORE INSERT ON public.seller_notes
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_seller_notes_insert();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_notes_role_chk') THEN
    ALTER TABLE public.seller_notes ADD CONSTRAINT seller_notes_role_chk CHECK (author_role IN ('admin', 'staff', 'manager'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seller_notes_seller_created ON public.seller_notes (seller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_notes_created ON public.seller_notes (created_at DESC);

-- ───────────────────────── as pausas valem no banco ─────────────────────────

-- Saques: mesma regra de antes, mas sem quebrar com valor que não seja booleano.
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_kill_switch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'kill_switches' AND value -> 'withdrawals' = 'true'::jsonb) THEN
    RAISE EXCEPTION 'Solicitações de saque estão temporariamente pausadas. Tente novamente mais tarde.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_withdrawal_kill_switch() FROM PUBLIC, anon, authenticated;

-- A pausa de saques passa a valer antes das demais regras (antes o aviso de "saldo insuficiente" chegava primeiro).
DROP TRIGGER IF EXISTS trg_enforce_withdrawal_kill_switch ON public.withdrawals;
DROP TRIGGER IF EXISTS trg_05_enforce_withdrawal_kill_switch ON public.withdrawals;
CREATE TRIGGER trg_05_enforce_withdrawal_kill_switch BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_kill_switch();

-- Pagamentos: nenhuma função lia essa pausa. Agora nenhuma cobrança real nasce enquanto ela estiver ligada,
-- qualquer que seja a função que tente criar a transação (venda simulada, de teste, segue passando).
CREATE OR REPLACE FUNCTION app_private.enforce_payments_kill_switch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.is_simulated, false) = false
     AND EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'kill_switches' AND value -> 'payments' = 'true'::jsonb) THEN
    RAISE EXCEPTION 'Pagamentos estão temporariamente pausados. Tente novamente em instantes.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION app_private.enforce_payments_kill_switch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_enforce_payments_kill_switch ON public.transactions;
CREATE TRIGGER trg_zz_enforce_payments_kill_switch BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_payments_kill_switch();

-- O seller e o checkout podem saber que há pausa antes de tentar (só os dois avisos, nada mais da tabela).
CREATE OR REPLACE FUNCTION app_private.get_platform_pauses()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'payments',    COALESCE((SELECT value -> 'payments'    = 'true'::jsonb FROM public.platform_settings WHERE key = 'kill_switches'), false),
    'withdrawals', COALESCE((SELECT value -> 'withdrawals' = 'true'::jsonb FROM public.platform_settings WHERE key = 'kill_switches'), false));
$function$;

CREATE OR REPLACE FUNCTION public.get_platform_pauses()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_platform_pauses(); $$;

-- ───────────────────────── leitura da tela ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_tools()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_val  jsonb;
  v_meta jsonb;
  v_sw   jsonb := '{}'::jsonb;
  k      text;
  v_hist jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT value INTO v_val FROM public.platform_settings WHERE key = 'kill_switches';
  v_val := COALESCE(v_val, '{}'::jsonb);
  v_meta := COALESCE(v_val -> 'meta', '{}'::jsonb);

  FOREACH k IN ARRAY ARRAY['payments', 'withdrawals'] LOOP
    v_sw := v_sw || jsonb_build_object(k, jsonb_build_object(
      'paused', COALESCE(v_val -> k = 'true'::jsonb, false),
      'at',     v_meta -> k ->> 'at',
      'reason', NULLIF(v_meta -> k ->> 'reason', ''),
      'by',     (SELECT NULLIF(btrim(COALESCE(p.full_name, '')), '') FROM public.profiles p WHERE p.user_id::text = v_meta -> k ->> 'by')));
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('at', h.created_at, 'action', h.action, 'details', h.details,
                                               'by', NULLIF(btrim(COALESCE(a.full_name, '')), '')) ORDER BY h.created_at DESC), '[]'::jsonb)
    INTO v_hist
    FROM (SELECT * FROM public.audit_logs
           WHERE action LIKE 'kill_switch\_%' OR action LIKE 'seller\_note\_%' OR action = 'data_export'
           ORDER BY created_at DESC LIMIT 25) h
    LEFT JOIN public.profiles a ON a.user_id = h.admin_user_id;

  RETURN jsonb_build_object(
    'switches', v_sw,
    'program', jsonb_build_object(
      'notes', (SELECT count(*) FROM public.seller_notes),
      'exports_30d', (SELECT count(*) FROM public.audit_logs WHERE action = 'data_export' AND created_at >= now() - interval '30 days'),
      'sellers', (SELECT count(*) FROM app_private.notification_recipients('all'))),
    'history', v_hist,
    'generated_at', now());
END
$function$;

CREATE OR REPLACE FUNCTION app_private.get_admin_seller_notes(_seller_id uuid DEFAULT NULL, _limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lim integer := LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
BEGIN
  PERFORM app_private.assert_admin();
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public.seller_notes n WHERE _seller_id IS NULL OR n.seller_user_id = _seller_id),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'seller_id', x.seller_user_id, 'seller_name', COALESCE(NULLIF(btrim(COALESCE(s.full_name, '')), ''), s.email, 'Seller sem nome'),
        'seller_email', s.email, 'author_name', NULLIF(btrim(COALESCE(a.full_name, '')), ''), 'author_role', x.author_role,
        'content', x.content, 'created_at', x.created_at) ORDER BY x.created_at DESC, x.id)
      FROM (SELECT * FROM public.seller_notes n WHERE _seller_id IS NULL OR n.seller_user_id = _seller_id ORDER BY n.created_at DESC, n.id LIMIT v_lim) x
      LEFT JOIN public.profiles s ON s.user_id = x.seller_user_id
      LEFT JOIN public.profiles a ON a.user_id = x.author_user_id), '[]'::jsonb),
    'generated_at', now());
END
$function$;

-- ───────────────────────── ações ─────────────────────────

-- Liga ou desliga uma pausa de emergência. Pede motivo e senha, grava quem, quando e por quê, e audita na mesma transação.
CREATE OR REPLACE FUNCTION app_private.admin_set_kill_switch(_key text, _paused boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin  uuid := app_private.assert_admin();
  v_reason text := btrim(COALESCE(_reason, ''));
  v_cur    jsonb;
  v_prev   boolean;
  v_pay    boolean;
  v_wd     boolean;
  v_meta   jsonb;
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF _key IS NULL OR _key NOT IN ('payments', 'withdrawals') THEN RAISE EXCEPTION 'pausa desconhecida'; END IF;
  IF _paused IS NULL THEN RAISE EXCEPTION 'informe se a operação fica pausada ou liberada'; END IF;
  IF char_length(v_reason) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo de 5 caracteres)'; END IF;
  IF char_length(v_reason) > 300 THEN RAISE EXCEPTION 'o motivo pode ter até 300 caracteres'; END IF;

  INSERT INTO public.platform_settings (key, value) VALUES ('kill_switches', '{"payments": false, "withdrawals": false}'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  SELECT value INTO v_cur FROM public.platform_settings WHERE key = 'kill_switches' FOR UPDATE;

  v_pay := COALESCE(v_cur -> 'payments' = 'true'::jsonb, false);
  v_wd  := COALESCE(v_cur -> 'withdrawals' = 'true'::jsonb, false);
  v_prev := CASE _key WHEN 'payments' THEN v_pay ELSE v_wd END;
  IF v_prev = _paused THEN RETURN jsonb_build_object('changed', false, 'paused', _paused); END IF;

  IF _key = 'payments' THEN v_pay := _paused; ELSE v_wd := _paused; END IF;
  v_meta := COALESCE(v_cur -> 'meta', '{}'::jsonb)
         || jsonb_build_object(_key, jsonb_build_object('at', now(), 'by', v_admin, 'reason', v_reason, 'paused', _paused));

  UPDATE public.platform_settings
     SET value = jsonb_build_object('payments', v_pay, 'withdrawals', v_wd, 'meta', v_meta), updated_at = now(), updated_by = v_admin
   WHERE key = 'kill_switches';

  PERFORM app_private.admin_audit(v_admin, 'kill_switch_' || _key || '_' || CASE WHEN _paused THEN 'on' ELSE 'off' END, 'platform_settings', 'kill_switches',
    jsonb_build_object('key', _key, 'paused', _paused, 'reason', v_reason, 'payments', v_pay, 'withdrawals', v_wd));
  RETURN jsonb_build_object('changed', true, 'paused', _paused);
END
$function$;

-- Nota interna sobre um seller. Não se edita nem se apaga; o texto não vai para a auditoria (só o tamanho).
CREATE OR REPLACE FUNCTION app_private.admin_add_seller_note(_seller_id uuid, _content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_text  text := btrim(regexp_replace(regexp_replace(COALESCE(_content, ''), '<[^>]*>', '', 'g'), 'javascript:', '', 'gi'));
  v_name  text;
  v_dup   uuid;
  v_id    uuid;
BEGIN
  IF _seller_id IS NULL THEN RAISE EXCEPTION 'escolha o seller'; END IF;
  IF char_length(v_text) < 3 THEN RAISE EXCEPTION 'escreva a nota (mínimo de 3 caracteres)'; END IF;
  IF char_length(v_text) > 2000 THEN RAISE EXCEPTION 'a nota pode ter até 2000 caracteres'; END IF;
  SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email, 'Seller sem nome') INTO v_name FROM public.profiles p WHERE p.user_id = _seller_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'seller não encontrado'; END IF;

  -- clique duplo: a mesma nota, do mesmo autor, no mesmo seller, em menos de 1 minuto é a mesma
  SELECT id INTO v_dup FROM public.seller_notes
   WHERE seller_user_id = _seller_id AND author_user_id = v_admin AND content = v_text AND created_at > now() - interval '1 minute' LIMIT 1;
  IF v_dup IS NOT NULL THEN RETURN jsonb_build_object('id', v_dup, 'duplicate', true); END IF;

  INSERT INTO public.seller_notes (seller_user_id, author_user_id, author_role, content) VALUES (_seller_id, v_admin, 'admin', v_text) RETURNING id INTO v_id;
  PERFORM app_private.admin_audit(v_admin, 'seller_note_create', 'seller', _seller_id::text,
    jsonb_build_object('note_id', v_id, 'seller_name', v_name, 'length', char_length(v_text)));
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END
$function$;

-- Exportação em páginas (a tela junta as páginas e monta o CSV). Pede senha em toda página e audita no começo.
-- Quem escolhe as colunas e o formato é a tela; aqui só sai o que o admin já enxerga, sem CPF/CNPJ, telefone do cliente ou endereço.
-- Ordem fixa (data, id) e cursor (_after_at, _after_id): a página seguinte começa depois da última linha da anterior.
CREATE OR REPLACE FUNCTION app_private.admin_export_page(_kind text, _from timestamptz, _to timestamptz, _after_at timestamptz DEFAULT NULL, _after_id uuid DEFAULT NULL, _limit integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_lim   integer := LEAST(GREATEST(COALESCE(_limit, 1000), 1), 1000);
  v_first boolean := (_after_at IS NULL);
  v_total bigint;
  v_rows  jsonb;
  v_last  jsonb;
  v_count integer;
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF _kind IS NULL OR _kind NOT IN ('transactions', 'sellers', 'withdrawals') THEN RAISE EXCEPTION 'tipo de exportação desconhecido'; END IF;
  IF (_after_at IS NULL) <> (_after_id IS NULL) THEN RAISE EXCEPTION 'cursor incompleto'; END IF;
  IF _kind <> 'sellers' THEN
    IF _from IS NULL OR _to IS NULL OR _to <= _from THEN RAISE EXCEPTION 'escolha um período válido'; END IF;
    IF _to - _from > interval '400 days' THEN RAISE EXCEPTION 'o período pode ter no máximo 400 dias'; END IF;
  END IF;

  IF _kind = 'transactions' THEN
    IF v_first THEN SELECT count(*) INTO v_total FROM public.transactions t WHERE t.created_at >= _from AND t.created_at < _to; END IF;
    SELECT COALESCE(jsonb_agg(r.j ORDER BY r.created_at, r.id), '[]'::jsonb), count(*)::int,
           (array_agg(jsonb_build_object('at', r.created_at, 'id', r.id) ORDER BY r.created_at DESC, r.id DESC))[1]
      INTO v_rows, v_count, v_last
      FROM (SELECT t.created_at, t.id, jsonb_build_object(
              'id', t.id, 'created_at', t.created_at, 'status', t.status, 'amount', t.amount, 'net_amount', t.net_amount,
              'seller_name', COALESCE(NULLIF(btrim(COALESCE(s.full_name, '')), ''), s.email), 'seller_email', s.email, 'product', pr.name,
              'customer_name', t.customer_name, 'customer_email', t.customer_email, 'payment_method', t.payment_method, 'simulated', t.is_simulated) AS j
              FROM public.transactions t
              LEFT JOIN public.profiles s ON s.user_id = t.user_id
              LEFT JOIN public.products pr ON pr.id = t.product_id
             WHERE t.created_at >= _from AND t.created_at < _to
               AND (v_first OR (t.created_at, t.id) > (_after_at, _after_id))
             ORDER BY t.created_at, t.id LIMIT v_lim) r;

  ELSIF _kind = 'withdrawals' THEN
    IF v_first THEN SELECT count(*) INTO v_total FROM public.withdrawals w WHERE w.created_at >= _from AND w.created_at < _to; END IF;
    SELECT COALESCE(jsonb_agg(r.j ORDER BY r.created_at, r.id), '[]'::jsonb), count(*)::int,
           (array_agg(jsonb_build_object('at', r.created_at, 'id', r.id) ORDER BY r.created_at DESC, r.id DESC))[1]
      INTO v_rows, v_count, v_last
      FROM (SELECT w.created_at, w.id, jsonb_build_object(
              'id', w.id, 'created_at', w.created_at, 'seller_name', COALESCE(NULLIF(btrim(COALESCE(s.full_name, '')), ''), s.email), 'seller_email', s.email,
              'amount', w.amount, 'fee_amount', w.fee_amount, 'net_amount', w.net_amount, 'status', w.status, 'type', w.withdrawal_type) AS j
              FROM public.withdrawals w
              LEFT JOIN public.profiles s ON s.user_id = w.user_id
             WHERE w.created_at >= _from AND w.created_at < _to
               AND (v_first OR (w.created_at, w.id) > (_after_at, _after_id))
             ORDER BY w.created_at, w.id LIMIT v_lim) r;

  ELSE
    IF v_first THEN SELECT count(*) INTO v_total FROM public.profiles p
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'employee', 'manager', 'partner')); END IF;
    SELECT COALESCE(jsonb_agg(r.j ORDER BY r.created_at, r.id), '[]'::jsonb), count(*)::int,
           (array_agg(jsonb_build_object('at', r.created_at, 'id', r.id) ORDER BY r.created_at DESC, r.id DESC))[1]
      INTO v_rows, v_count, v_last
      FROM (SELECT p.created_at, p.user_id AS id, jsonb_build_object(
              'id', p.user_id, 'name', p.full_name, 'email', p.email, 'phone', p.phone, 'status', p.account_status, 'created_at', p.created_at) AS j
              FROM public.profiles p
             WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'employee', 'manager', 'partner'))
               AND (v_first OR (p.created_at, p.user_id) > (_after_at, _after_id))
             ORDER BY p.created_at, p.user_id LIMIT v_lim) r;
  END IF;

  IF v_first THEN
    PERFORM app_private.admin_audit(v_admin, 'data_export', 'export', _kind,
      jsonb_build_object('kind', _kind, 'from', CASE WHEN _kind = 'sellers' THEN NULL ELSE _from END, 'to', CASE WHEN _kind = 'sellers' THEN NULL ELSE _to END, 'total', v_total));
  END IF;

  RETURN jsonb_build_object('rows', v_rows, 'count', v_count, 'total', v_total,
    'next', CASE WHEN v_count >= v_lim THEN v_last ELSE NULL END);
END
$function$;

-- ───────────────────────── funções públicas (wrappers) ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_tools()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_tools(); $$;

CREATE OR REPLACE FUNCTION public.get_admin_seller_notes(_seller_id uuid DEFAULT NULL, _limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_seller_notes(_seller_id, _limit); $$;

CREATE OR REPLACE FUNCTION public.admin_set_kill_switch(_key text, _paused boolean, _reason text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_kill_switch(_key, _paused, _reason); $$;

CREATE OR REPLACE FUNCTION public.admin_add_seller_note(_seller_id uuid, _content text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_add_seller_note(_seller_id, _content); $$;

CREATE OR REPLACE FUNCTION public.admin_export_page(_kind text, _from timestamptz, _to timestamptz, _after_at timestamptz DEFAULT NULL, _after_id uuid DEFAULT NULL, _limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_export_page(_kind, _from, _to, _after_at, _after_id, _limit); $$;

-- ───────────────────────── permissões ─────────────────────────

REVOKE ALL ON FUNCTION
  app_private.get_admin_tools(), app_private.get_admin_seller_notes(uuid, integer),
  app_private.admin_set_kill_switch(text, boolean, text), app_private.admin_add_seller_note(uuid, text),
  app_private.admin_export_page(text, timestamptz, timestamptz, timestamptz, uuid, integer),
  public.get_admin_tools(), public.get_admin_seller_notes(uuid, integer),
  public.admin_set_kill_switch(text, boolean, text), public.admin_add_seller_note(uuid, text),
  public.admin_export_page(text, timestamptz, timestamptz, timestamptz, uuid, integer)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.get_admin_tools(), app_private.get_admin_seller_notes(uuid, integer),
  app_private.admin_set_kill_switch(text, boolean, text), app_private.admin_add_seller_note(uuid, text),
  app_private.admin_export_page(text, timestamptz, timestamptz, timestamptz, uuid, integer),
  public.get_admin_tools(), public.get_admin_seller_notes(uuid, integer),
  public.admin_set_kill_switch(text, boolean, text), public.admin_add_seller_note(uuid, text),
  public.admin_export_page(text, timestamptz, timestamptz, timestamptz, uuid, integer)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION app_private.get_platform_pauses(), public.get_platform_pauses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.get_platform_pauses(), public.get_platform_pauses() TO anon, authenticated, service_role;
