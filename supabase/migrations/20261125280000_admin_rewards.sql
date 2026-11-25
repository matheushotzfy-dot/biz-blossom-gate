-- Premiações do admin: leitura e escrita só por função, regras de andamento no servidor.
--
-- Antes: a aba lia `reward_claims` e `award_tiers` direto do navegador (todas as linhas, busca no cliente) e gravava direto
-- (status em qualquer direção, de "entregue" de volta para "aguardando"; cancelamento sem motivo; metas dos marcos sem validação).
-- O campo "Notas internas" da tela era o mesmo `admin_notes` que o seller LÊ em "Seus resgates": agora ele se chama
-- "Mensagem para o seller" e a nota interna de verdade vai para a trilha de auditoria.

-- ───────────────────────── tabelas ─────────────────────────

REVOKE ALL ON public.reward_claims, public.award_tiers FROM anon;
REVOKE UPDATE, DELETE ON public.reward_claims FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.award_tiers FROM authenticated;

DROP POLICY IF EXISTS "Admins update reward claims" ON public.reward_claims;
DROP POLICY IF EXISTS "Admins delete reward claims" ON public.reward_claims;
DROP POLICY IF EXISTS "Admins manage award tiers" ON public.award_tiers;

-- tamanhos (a tabela está vazia; o formulário do seller já respeita todos eles)
ALTER TABLE public.reward_claims
  ADD CONSTRAINT reward_claims_text_sizes_chk CHECK (
    char_length(recipient_name) BETWEEN 3 AND 120 AND char_length(phone) <= 30 AND char_length(COALESCE(document, '')) <= 30
    AND char_length(shipping_zip) <= 12 AND char_length(shipping_street) <= 160 AND char_length(shipping_number) <= 20
    AND char_length(COALESCE(shipping_complement, '')) <= 80 AND char_length(shipping_neighborhood) <= 100
    AND char_length(shipping_city) <= 100 AND char_length(shipping_state) = 2
    AND char_length(COALESCE(tracking_code, '')) <= 100 AND char_length(COALESCE(tracking_carrier, '')) <= 60
    AND char_length(COALESCE(admin_notes, '')) <= 500
  );

CREATE INDEX IF NOT EXISTS idx_reward_claims_status_created ON public.reward_claims (status, created_at);

-- ───────────────────────── aviso ao seller ─────────────────────────

CREATE OR REPLACE FUNCTION public.notify_reward_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_message text;
  v_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id,
            'Premiação solicitada',
            'Sua premiação "' || NEW.tier_label || '" foi registrada e está em análise.',
            'info');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'preparing' THEN
      v_title := 'Premiação em preparação';
      v_message := 'Sua premiação "' || NEW.tier_label || '" está sendo preparada para envio.';
      v_type := 'info';
    ELSIF NEW.status = 'shipped' THEN
      v_title := 'Premiação enviada';
      v_message := 'Sua premiação "' || NEW.tier_label || '" foi postada.'
        || CASE WHEN NEW.tracking_code IS NOT NULL
                THEN ' Rastreio: ' || COALESCE(NEW.tracking_carrier || ' ', '') || NEW.tracking_code
                ELSE '' END;
      v_type := 'success';
    ELSIF NEW.status = 'delivered' THEN
      v_title := 'Premiação entregue';
      v_message := 'Sua premiação "' || NEW.tier_label || '" foi entregue. Aproveite!';
      v_type := 'success';
    ELSIF NEW.status = 'cancelled' THEN
      v_title := 'Premiação cancelada';
      v_message := 'A solicitação da premiação "' || NEW.tier_label || '" foi cancelada.'
        || CASE WHEN NULLIF(btrim(COALESCE(NEW.admin_notes, '')), '') IS NOT NULL THEN ' Motivo: ' || btrim(NEW.admin_notes) ELSE '' END;
      v_type := 'error';
    ELSIF NEW.status = 'pending' AND OLD.status = 'cancelled' THEN
      v_title := 'Premiação reaberta';
      v_message := 'A solicitação da premiação "' || NEW.tier_label || '" foi reaberta e voltou para análise.';
      v_type := 'info';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, v_title, v_message, v_type);
  END IF;
  RETURN NEW;
END;
$function$;

-- ───────────────────────── leitura ─────────────────────────

-- Pedidos de premiação. _status: open (aguardando + preparo + postadas), pending, preparing, shipped, delivered, cancelled, all.
-- Em "open" o que espera há mais tempo vem primeiro; nas demais, o mais recente.
CREATE OR REPLACE FUNCTION app_private.get_admin_reward_claims_page(_status text DEFAULT 'open', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text := lower(btrim(COALESCE(_status, 'open')));
  v_q      text := NULLIF(lower(btrim(COALESCE(_search, ''))), '');
  v_pat    text;
  v_code   text;
  v_size   int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_page   int  := GREATEST(COALESCE(_page, 1), 1);
  v_open   boolean;
  v_total  int;
  v_items  jsonb;
  v_counts jsonb;
  v_prog   jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_status NOT IN ('open', 'pending', 'preparing', 'shipped', 'delivered', 'cancelled', 'all') THEN v_status := 'open'; END IF;
  v_open := v_status = 'open';
  v_q := left(v_q, 80);
  v_pat := CASE WHEN v_q IS NULL THEN NULL ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
  v_code := CASE WHEN v_q ~ '^#[0-9a-f]{4,8}$' THEN substr(v_q, 2) ELSE NULL END;

  WITH f AS (
    SELECT c.*, p.full_name AS p_name, p.email AS p_email
      FROM public.reward_claims c
      LEFT JOIN public.profiles p ON p.user_id = c.user_id
     WHERE (v_status = 'all' OR (v_open AND c.status IN ('pending', 'preparing', 'shipped')) OR c.status = v_status)
       AND (v_q IS NULL
            OR lower(c.recipient_name) LIKE v_pat OR lower(c.tier_label) LIKE v_pat OR lower(c.shipping_city) LIKE v_pat
            OR lower(COALESCE(c.tracking_code, '')) LIKE v_pat
            OR lower(COALESCE(p.full_name, '')) LIKE v_pat OR lower(COALESCE(p.email, '')) LIKE v_pat
            OR (v_code IS NOT NULL AND replace(c.id::text, '-', '') LIKE v_code || '%'))
  ), pg AS (
    SELECT f.*, row_number() OVER (ORDER BY
             CASE WHEN v_open THEN CASE f.status WHEN 'pending' THEN 0 WHEN 'preparing' THEN 1 ELSE 2 END END ASC NULLS LAST,
             CASE WHEN v_open THEN f.created_at END ASC NULLS LAST,
             f.created_at DESC, f.id) AS ord
      FROM f
     ORDER BY ord
     OFFSET (v_page - 1) * v_size LIMIT v_size
  )
  SELECT (SELECT count(*)::int FROM f),
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id', pg.id, 'user_id', pg.user_id, 'tier_id', pg.tier_id, 'tier_label', pg.tier_label, 'tier_value', pg.tier_value,
           'recipient_name', pg.recipient_name, 'shipping_city', pg.shipping_city, 'shipping_state', pg.shipping_state, 'status', pg.status,
           'tracking_carrier', pg.tracking_carrier, 'tracking_code', pg.tracking_code, 'created_at', pg.created_at, 'delivered_at', pg.delivered_at,
           'updated_at', pg.updated_at, 'has_message', (NULLIF(btrim(COALESCE(pg.admin_notes, '')), '') IS NOT NULL),
           'seller', jsonb_build_object('user_id', pg.user_id, 'name', NULLIF(btrim(COALESCE(pg.p_name, '')), ''), 'email', pg.p_email)
         ) ORDER BY pg.ord) FROM pg), '[]'::jsonb)
    INTO v_total, v_items;

  SELECT jsonb_build_object(
      'open',      count(*) FILTER (WHERE status IN ('pending', 'preparing', 'shipped')),
      'pending',   count(*) FILTER (WHERE status = 'pending'),
      'preparing', count(*) FILTER (WHERE status = 'preparing'),
      'shipped',   count(*) FILTER (WHERE status = 'shipped'),
      'delivered', count(*) FILTER (WHERE status = 'delivered'),
      'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
      'all',       count(*)),
    jsonb_build_object(
      'pending',          count(*) FILTER (WHERE status = 'pending'),
      'pending_since',    min(created_at) FILTER (WHERE status = 'pending'),
      'in_progress',      count(*) FILTER (WHERE status IN ('preparing', 'shipped')),
      'delivered_30d',    count(*) FILTER (WHERE status = 'delivered' AND delivered_at >= now() - interval '30 days'),
      'median_days_to_deliver', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (d.delivered_at - d.created_at)) / 86400))::numeric, 1)
                                   FROM public.reward_claims d WHERE d.status = 'delivered' AND d.delivered_at IS NOT NULL AND d.delivered_at >= now() - interval '90 days'),
      'delivered_sample', count(*) FILTER (WHERE status = 'delivered' AND delivered_at IS NOT NULL AND delivered_at >= now() - interval '90 days'),
      'total',            count(*))
    INTO v_counts, v_prog
    FROM public.reward_claims;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'counts', v_counts, 'program', v_prog, 'generated_at', now());
END
$function$;

-- Um pedido por inteiro: dados de envio, o seller (com o faturamento que sustenta a meta), outros pedidos dele e a trilha.
CREATE OR REPLACE FUNCTION app_private.get_admin_reward_claim_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.reward_claims%ROWTYPE;
  v_rev numeric; v_sales int;
  v_seller jsonb; v_other jsonb; v_hist jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO c FROM public.reward_claims WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido não encontrado'; END IF;

  SELECT COALESCE(sum(t.net_amount), 0), count(*)::int INTO v_rev, v_sales
    FROM public.transactions t WHERE t.user_id = c.user_id AND t.status = 'completed' AND t.is_simulated = false;

  SELECT jsonb_build_object('user_id', c.user_id, 'name', NULLIF(btrim(COALESCE(p.full_name, '')), ''), 'email', p.email,
                            'account_status', p.account_status, 'joined_at', p.created_at, 'revenue', v_rev, 'sales', v_sales)
    INTO v_seller FROM (SELECT 1) x LEFT JOIN public.profiles p ON p.user_id = c.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'tier_label', o.tier_label, 'status', o.status, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]'::jsonb)
    INTO v_other FROM public.reward_claims o WHERE o.user_id = c.user_id AND o.id <> c.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('at', h.created_at, 'action', h.action, 'details', h.details,
                                               'by', NULLIF(btrim(COALESCE(a.full_name, '')), '')) ORDER BY h.created_at DESC), '[]'::jsonb)
    INTO v_hist FROM (
      SELECT * FROM public.audit_logs WHERE entity_type = 'reward_claim' AND entity_id = c.id::text ORDER BY created_at DESC LIMIT 60
    ) h LEFT JOIN public.profiles a ON a.user_id = h.admin_user_id;

  RETURN jsonb_build_object(
    'id', c.id, 'user_id', c.user_id, 'tier_id', c.tier_id, 'tier_label', c.tier_label, 'tier_value', c.tier_value,
    'status', c.status, 'created_at', c.created_at, 'updated_at', c.updated_at, 'delivered_at', c.delivered_at,
    'recipient_name', c.recipient_name, 'phone', c.phone, 'document', c.document,
    'shipping_street', c.shipping_street, 'shipping_number', c.shipping_number, 'shipping_complement', c.shipping_complement,
    'shipping_neighborhood', c.shipping_neighborhood, 'shipping_city', c.shipping_city, 'shipping_state', c.shipping_state, 'shipping_zip', c.shipping_zip,
    'tracking_carrier', c.tracking_carrier, 'tracking_code', c.tracking_code, 'tracking_url', c.tracking_url, 'message', c.admin_notes,
    'seller', v_seller, 'other_claims', v_other, 'history', v_hist);
END
$function$;

-- Marcos de faturamento com quantos sellers já bateram a meta, quantos ainda não pediram e a situação dos pedidos.
CREATE OR REPLACE FUNCTION app_private.get_admin_award_tiers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_items jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  WITH rev AS (
    SELECT t.user_id, sum(t.net_amount) AS r
      FROM public.transactions t WHERE t.status = 'completed' AND t.is_simulated = false GROUP BY t.user_id
  ), cl AS (
    SELECT tier_id, count(*) AS total,
           count(*) FILTER (WHERE status IN ('pending', 'preparing', 'shipped')) AS open,
           count(*) FILTER (WHERE status = 'delivered') AS delivered,
           count(*) FILTER (WHERE status = 'cancelled') AS cancelled
      FROM public.reward_claims GROUP BY tier_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'tier', t.tier, 'value', t.value, 'description', t.description, 'phrase', t.phrase,
      'rewards', to_jsonb(t.rewards), 'image_url', t.image_url, 'sort_order', t.sort_order, 'is_active', t.is_active,
      'claims', jsonb_build_object('total', COALESCE(cl.total, 0), 'open', COALESCE(cl.open, 0), 'delivered', COALESCE(cl.delivered, 0), 'cancelled', COALESCE(cl.cancelled, 0)),
      'reached', (SELECT count(*) FROM rev WHERE rev.r >= t.value),
      'waiting_to_claim', (SELECT count(*) FROM rev WHERE rev.r >= t.value AND NOT EXISTS (SELECT 1 FROM public.reward_claims c WHERE c.user_id = rev.user_id AND c.tier_id = t.id))
    ) ORDER BY t.sort_order, t.created_at, t.id), '[]'::jsonb)
    INTO v_items
    FROM public.award_tiers t LEFT JOIN cl ON cl.tier_id = t.id;
  RETURN jsonb_build_object('items', v_items, 'generated_at', now());
END
$function$;

-- ───────────────────────── pedidos: escrita ─────────────────────────

-- Muda o andamento e/ou o rastreio de um pedido. Passar NULL em um campo mantém o valor; texto vazio apaga.
--   pendente → preparando | postado | entregue | cancelado        postado exige o código de rastreio
--   preparando → postado | entregue | cancelado                    cancelado exige o motivo (o seller vê)
--   postado → entregue | cancelado                                  cancelado → pendente (reabrir)
--   entregue é final
-- Entregue direto, sem postagem, existe porque há premiações que não viajam (acesso a grupo, encontro).
CREATE OR REPLACE FUNCTION app_private.admin_set_reward_claim(_id uuid, _status text, _carrier text, _code text, _url text, _message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  c public.reward_claims%ROWTYPE;
  v_to text; v_carrier text; v_code text; v_url text; v_msg text;
  v_action text;
BEGIN
  SELECT * INTO c FROM public.reward_claims WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido não encontrado'; END IF;

  v_to := lower(btrim(COALESCE(_status, c.status)));
  IF v_to NOT IN ('pending', 'preparing', 'shipped', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'andamento inválido'; END IF;

  v_carrier := CASE WHEN _carrier IS NULL THEN c.tracking_carrier ELSE NULLIF(btrim(_carrier), '') END;
  v_code    := CASE WHEN _code    IS NULL THEN c.tracking_code    ELSE NULLIF(btrim(_code), '') END;
  v_url     := CASE WHEN _url     IS NULL THEN c.tracking_url     ELSE NULLIF(btrim(_url), '') END;
  v_msg     := CASE WHEN _message IS NULL THEN c.admin_notes      ELSE NULLIF(btrim(_message), '') END;

  IF length(COALESCE(v_carrier, '')) > 60 THEN RAISE EXCEPTION 'transportadora muito longa (máximo 60 caracteres)'; END IF;
  IF length(COALESCE(v_code, '')) > 100 THEN RAISE EXCEPTION 'código de rastreio muito longo (máximo 100 caracteres)'; END IF;
  IF length(COALESCE(v_msg, '')) > 500 THEN RAISE EXCEPTION 'mensagem muito longa (máximo 500 caracteres)'; END IF;
  IF v_url IS NOT NULL AND (length(v_url) > 2048 OR v_url !~* '^https?://[^[:space:]<>"''\\]+$') THEN
    RAISE EXCEPTION 'o link de rastreio precisa começar com http:// ou https://';
  END IF;

  IF v_to <> c.status THEN
    IF NOT (
      (c.status = 'pending'   AND v_to IN ('preparing', 'shipped', 'delivered', 'cancelled')) OR
      (c.status = 'preparing' AND v_to IN ('shipped', 'delivered', 'cancelled')) OR
      (c.status = 'shipped'   AND v_to IN ('delivered', 'cancelled')) OR
      (c.status = 'cancelled' AND v_to = 'pending')
    ) THEN
      RAISE EXCEPTION 'não dá para mudar um pedido % para %', CASE c.status WHEN 'delivered' THEN 'entregue' WHEN 'cancelled' THEN 'cancelado' WHEN 'shipped' THEN 'postado' WHEN 'preparing' THEN 'em preparo' ELSE 'aguardando' END,
        CASE v_to WHEN 'delivered' THEN 'entregue' WHEN 'cancelled' THEN 'cancelado' WHEN 'shipped' THEN 'postado' WHEN 'preparing' THEN 'em preparo' ELSE 'aguardando' END;
    END IF;
  ELSIF c.status IN ('delivered', 'cancelled') AND (v_carrier IS DISTINCT FROM c.tracking_carrier OR v_code IS DISTINCT FROM c.tracking_code OR v_url IS DISTINCT FROM c.tracking_url) THEN
    RAISE EXCEPTION 'este pedido já está encerrado';
  END IF;

  IF v_to = 'shipped' AND v_code IS NULL THEN RAISE EXCEPTION 'informe o código de rastreio para marcar como postado'; END IF;
  IF v_to = 'cancelled' AND v_to <> c.status AND length(COALESCE(v_msg, '')) < 5 THEN RAISE EXCEPTION 'informe o motivo do cancelamento (mínimo 5 caracteres)'; END IF;
  IF v_to = 'pending' AND c.status = 'cancelled' THEN v_msg := NULL; END IF;

  UPDATE public.reward_claims SET
    status = v_to, tracking_carrier = v_carrier, tracking_code = v_code, tracking_url = v_url, admin_notes = v_msg,
    delivered_at = CASE WHEN v_to = 'delivered' THEN COALESCE(c.delivered_at, now()) ELSE NULL END
   WHERE id = c.id;

  v_action := CASE WHEN v_to = c.status THEN 'reward_claim_update'
                   WHEN v_to = 'pending' THEN 'reward_claim_reopened'
                   ELSE 'reward_claim_' || v_to END;
  PERFORM app_private.admin_audit(v_admin, v_action, 'reward_claim', c.id::text,
    jsonb_build_object('from', c.status, 'to', v_to, 'tier', c.tier_label, 'carrier', v_carrier, 'code', v_code, 'message', v_msg));
  RETURN jsonb_build_object('id', c.id, 'status', v_to);
END
$function$;

-- Corrige os dados de envio enquanto o pedido ainda não foi postado (o seller não edita depois de enviar). O seller é avisado.
CREATE OR REPLACE FUNCTION app_private.admin_update_reward_claim_shipping(
  _id uuid, _recipient_name text, _phone text, _document text, _zip text, _street text, _number text,
  _complement text, _neighborhood text, _city text, _state text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  c public.reward_claims%ROWTYPE;
  v_name text := regexp_replace(btrim(COALESCE(_recipient_name, '')), '\s+', ' ', 'g');
  v_phone text := btrim(COALESCE(_phone, ''));
  v_doc text := NULLIF(btrim(COALESCE(_document, '')), '');
  v_zip text := btrim(COALESCE(_zip, ''));
  v_street text := regexp_replace(btrim(COALESCE(_street, '')), '\s+', ' ', 'g');
  v_number text := btrim(COALESCE(_number, ''));
  v_comp text := NULLIF(regexp_replace(btrim(COALESCE(_complement, '')), '\s+', ' ', 'g'), '');
  v_hood text := regexp_replace(btrim(COALESCE(_neighborhood, '')), '\s+', ' ', 'g');
  v_city text := regexp_replace(btrim(COALESCE(_city, '')), '\s+', ' ', 'g');
  v_uf text := upper(btrim(COALESCE(_state, '')));
  v_reason text := btrim(COALESCE(_reason, ''));
  v_fields text[] := '{}';
  v_pd text; v_zd text;
BEGIN
  SELECT * INTO c FROM public.reward_claims WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido não encontrado'; END IF;
  IF c.status NOT IN ('pending', 'preparing') THEN RAISE EXCEPTION 'o endereço só muda antes da postagem'; END IF;
  IF length(v_reason) < 5 THEN RAISE EXCEPTION 'informe o motivo da correção (mínimo 5 caracteres)'; END IF;
  IF length(v_reason) > 300 THEN RAISE EXCEPTION 'motivo muito longo'; END IF;

  v_pd := regexp_replace(v_phone, '\D', '', 'g'); v_zd := regexp_replace(v_zip, '\D', '', 'g');
  IF char_length(v_name) < 3 OR char_length(v_name) > 120 THEN RAISE EXCEPTION 'informe o nome de quem recebe'; END IF;
  IF length(v_pd) NOT IN (10, 11, 12, 13) OR length(v_phone) > 30 THEN RAISE EXCEPTION 'telefone inválido'; END IF;
  IF v_doc IS NOT NULL AND (length(regexp_replace(v_doc, '\D', '', 'g')) NOT IN (11, 14) OR length(v_doc) > 30) THEN RAISE EXCEPTION 'CPF ou CNPJ inválido'; END IF;
  IF length(v_zd) <> 8 THEN RAISE EXCEPTION 'o CEP precisa ter 8 números'; END IF;
  v_zip := substr(v_zd, 1, 5) || '-' || substr(v_zd, 6, 3);
  IF char_length(v_street) < 2 OR char_length(v_street) > 160 THEN RAISE EXCEPTION 'informe a rua'; END IF;
  IF char_length(v_number) < 1 OR char_length(v_number) > 20 THEN RAISE EXCEPTION 'informe o número ou s/n'; END IF;
  IF char_length(COALESCE(v_comp, '')) > 80 THEN RAISE EXCEPTION 'complemento muito longo (máximo 80 caracteres)'; END IF;
  IF char_length(v_hood) < 2 OR char_length(v_hood) > 100 THEN RAISE EXCEPTION 'informe o bairro'; END IF;
  IF char_length(v_city) < 2 OR char_length(v_city) > 100 THEN RAISE EXCEPTION 'informe a cidade'; END IF;
  IF v_uf !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$' THEN RAISE EXCEPTION 'escolha um estado válido'; END IF;

  IF v_name IS DISTINCT FROM c.recipient_name THEN v_fields := array_append(v_fields, 'nome'::text); END IF;
  IF v_phone IS DISTINCT FROM c.phone THEN v_fields := array_append(v_fields, 'telefone'::text); END IF;
  IF v_doc IS DISTINCT FROM c.document THEN v_fields := array_append(v_fields, 'documento'::text); END IF;
  IF v_zip IS DISTINCT FROM c.shipping_zip THEN v_fields := array_append(v_fields, 'CEP'::text); END IF;
  IF v_street IS DISTINCT FROM c.shipping_street THEN v_fields := array_append(v_fields, 'rua'::text); END IF;
  IF v_number IS DISTINCT FROM c.shipping_number THEN v_fields := array_append(v_fields, 'número'::text); END IF;
  IF v_comp IS DISTINCT FROM c.shipping_complement THEN v_fields := array_append(v_fields, 'complemento'::text); END IF;
  IF v_hood IS DISTINCT FROM c.shipping_neighborhood THEN v_fields := array_append(v_fields, 'bairro'::text); END IF;
  IF v_city IS DISTINCT FROM c.shipping_city THEN v_fields := array_append(v_fields, 'cidade'::text); END IF;
  IF v_uf IS DISTINCT FROM c.shipping_state THEN v_fields := array_append(v_fields, 'estado'::text); END IF;
  IF cardinality(v_fields) = 0 THEN RAISE EXCEPTION 'nada mudou no endereço'; END IF;

  UPDATE public.reward_claims SET recipient_name = v_name, phone = v_phone, document = v_doc, shipping_zip = v_zip, shipping_street = v_street,
    shipping_number = v_number, shipping_complement = v_comp, shipping_neighborhood = v_hood, shipping_city = v_city, shipping_state = v_uf
   WHERE id = c.id;

  PERFORM app_private.admin_audit(v_admin, 'reward_claim_address', 'reward_claim', c.id::text,
    jsonb_build_object('fields', to_jsonb(v_fields), 'reason', v_reason, 'tier', c.tier_label));
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (c.user_id, 'Endereço da premiação atualizado',
          'Atualizamos os dados de envio da premiação "' || c.tier_label || '" (' || array_to_string(v_fields, ', ') || '). Se algo estiver errado, fale com o suporte.', 'info');
  RETURN jsonb_build_object('id', c.id, 'changed', to_jsonb(v_fields));
END
$function$;

-- Anotação interna: fica só na trilha de auditoria (o seller não lê `audit_logs`).
CREATE OR REPLACE FUNCTION app_private.admin_add_reward_claim_note(_id uuid, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_note text := btrim(COALESCE(_note, ''));
  v_tier text;
BEGIN
  SELECT tier_label INTO v_tier FROM public.reward_claims WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido não encontrado'; END IF;
  IF length(v_note) < 2 THEN RAISE EXCEPTION 'escreva a anotação'; END IF;
  IF length(v_note) > 500 THEN RAISE EXCEPTION 'anotação muito longa (máximo 500 caracteres)'; END IF;
  PERFORM app_private.admin_audit(v_admin, 'reward_claim_note', 'reward_claim', _id::text, jsonb_build_object('note', v_note, 'tier', v_tier));
  RETURN jsonb_build_object('id', _id);
END
$function$;

-- ───────────────────────── marcos: escrita ─────────────────────────

-- Cria (_create = true, sempre inativo e no fim da fila) ou edita um marco. Mudar a meta ou ligar um marco muda quem pode
-- resgatar, então pede senha confirmada nos últimos 10 min; só texto, imagem e recompensas não pedem.
CREATE OR REPLACE FUNCTION app_private.admin_save_award_tier(
  _id text, _create boolean, _title text, _tier text, _value numeric, _description text, _phrase text,
  _rewards text[], _image_url text, _is_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  t public.award_tiers%ROWTYPE;
  v_id text;
  v_title text := regexp_replace(btrim(COALESCE(_title, '')), '\s+', ' ', 'g');
  v_tier text := regexp_replace(btrim(COALESCE(_tier, '')), '\s+', ' ', 'g');
  v_desc text := btrim(COALESCE(_description, ''));
  v_phrase text := btrim(COALESCE(_phrase, ''));
  v_img text := NULLIF(btrim(COALESCE(_image_url, '')), '');
  v_rewards text[];
  v_active boolean := COALESCE(_is_active, false);
BEGIN
  IF char_length(v_title) < 2 OR char_length(v_title) > 60 THEN RAISE EXCEPTION 'o nome da peça precisa ter de 2 a 60 caracteres'; END IF;
  IF char_length(v_tier) > 30 THEN RAISE EXCEPTION 'o nível precisa ter até 30 caracteres'; END IF;
  IF _value IS NULL OR _value <= 0 OR _value > 100000000 THEN RAISE EXCEPTION 'a meta precisa ser maior que zero e ir até R$ 100.000.000'; END IF;
  IF char_length(v_desc) > 300 THEN RAISE EXCEPTION 'a descrição passa de 300 caracteres'; END IF;
  IF char_length(v_phrase) > 160 THEN RAISE EXCEPTION 'a frase passa de 160 caracteres'; END IF;
  IF v_img IS NOT NULL AND (length(v_img) > 2048 OR v_img !~* '^https?://[^[:space:]<>"''\\]+$') THEN RAISE EXCEPTION 'o link da imagem precisa começar com http:// ou https://'; END IF;

  SELECT COALESCE(array_agg(x ORDER BY o), '{}') INTO v_rewards
    FROM (SELECT regexp_replace(btrim(r), '\s+', ' ', 'g') AS x, o FROM unnest(COALESCE(_rewards, '{}')) WITH ORDINALITY AS u(r, o)) q
   WHERE x <> '';
  IF cardinality(v_rewards) > 8 THEN RAISE EXCEPTION 'no máximo 8 itens de recompensa'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rewards) r WHERE char_length(r) > 80) THEN RAISE EXCEPTION 'cada item de recompensa vai até 80 caracteres'; END IF;

  IF COALESCE(_create, false) THEN
    v_id := 'm' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    INSERT INTO public.award_tiers (id, title, tier, value, description, phrase, rewards, image_url, sort_order, is_active)
    VALUES (v_id, v_title, v_tier, _value, v_desc, v_phrase, v_rewards, v_img, COALESCE((SELECT max(sort_order) FROM public.award_tiers), 0) + 1, false);
    PERFORM app_private.admin_audit(v_admin, 'award_tier_create', 'award_tier', v_id, jsonb_build_object('title', v_title, 'value', _value));
    RETURN jsonb_build_object('id', v_id);
  END IF;

  SELECT * INTO t FROM public.award_tiers WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'marco não encontrado'; END IF;
  IF _value IS DISTINCT FROM t.value OR (v_active AND NOT t.is_active) THEN PERFORM app_private.assert_recent_auth(); END IF;

  UPDATE public.award_tiers SET title = v_title, tier = v_tier, value = _value, description = v_desc, phrase = v_phrase,
         rewards = v_rewards, image_url = v_img, is_active = v_active
   WHERE id = t.id;
  PERFORM app_private.admin_audit(v_admin, 'award_tier_update', 'award_tier', t.id::text,
    jsonb_build_object('title', v_title, 'value_from', t.value, 'value_to', _value, 'active_from', t.is_active, 'active_to', v_active));
  RETURN jsonb_build_object('id', t.id);
END
$function$;

-- Sobe ou desce um marco na trilha (renumera de 1 a N para não deixar buracos nem empates).
CREATE OR REPLACE FUNCTION app_private.admin_move_award_tier(_id text, _dir text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  v_ids text[]; v_i int; v_j int; v_tmp text;
BEGIN
  IF _dir NOT IN ('up', 'down') THEN RAISE EXCEPTION 'direção inválida'; END IF;
  SELECT array_agg(id ORDER BY sort_order, created_at, id) INTO v_ids FROM public.award_tiers;
  v_i := array_position(v_ids, _id);
  IF v_i IS NULL THEN RAISE EXCEPTION 'marco não encontrado'; END IF;
  v_j := CASE WHEN _dir = 'up' THEN v_i - 1 ELSE v_i + 1 END;
  IF v_j < 1 OR v_j > cardinality(v_ids) THEN RETURN jsonb_build_object('moved', false); END IF;
  v_tmp := v_ids[v_i]; v_ids[v_i] := v_ids[v_j]; v_ids[v_j] := v_tmp;
  UPDATE public.award_tiers a SET sort_order = n.pos
    FROM (SELECT id, ord::int AS pos FROM unnest(v_ids) WITH ORDINALITY AS u(id, ord)) n WHERE a.id = n.id AND a.sort_order IS DISTINCT FROM n.pos;
  PERFORM app_private.admin_audit(v_admin, 'award_tier_move', 'award_tier', _id, jsonb_build_object('dir', _dir));
  RETURN jsonb_build_object('moved', true);
END
$function$;

-- Apagar só vale para marco que nunca teve pedido; os demais se ocultam (o pedido guarda o id da peça).
CREATE OR REPLACE FUNCTION app_private.admin_delete_award_tier(_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  t public.award_tiers%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.award_tiers WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'marco não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.reward_claims WHERE tier_id = t.id) THEN
    RAISE EXCEPTION 'esta peça já tem pedidos: oculte o marco em vez de apagar';
  END IF;
  DELETE FROM public.award_tiers WHERE id = t.id;
  PERFORM app_private.admin_audit(v_admin, 'award_tier_delete', 'award_tier', t.id::text, jsonb_build_object('title', t.title, 'value', t.value));
  RETURN jsonb_build_object('id', t.id);
END
$function$;

-- ───────────────────────── funções públicas ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_reward_claims_page(_status text DEFAULT 'open', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_reward_claims_page(_status, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_reward_claim_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_reward_claim_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.get_admin_award_tiers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_award_tiers(); $$;

CREATE OR REPLACE FUNCTION public.admin_set_reward_claim(_id uuid, _status text, _carrier text, _code text, _url text, _message text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_reward_claim(_id, _status, _carrier, _code, _url, _message); $$;

CREATE OR REPLACE FUNCTION public.admin_update_reward_claim_shipping(
  _id uuid, _recipient_name text, _phone text, _document text, _zip text, _street text, _number text,
  _complement text, _neighborhood text, _city text, _state text, _reason text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_update_reward_claim_shipping(_id, _recipient_name, _phone, _document, _zip, _street, _number, _complement, _neighborhood, _city, _state, _reason); $$;

CREATE OR REPLACE FUNCTION public.admin_add_reward_claim_note(_id uuid, _note text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_add_reward_claim_note(_id, _note); $$;

CREATE OR REPLACE FUNCTION public.admin_save_award_tier(
  _id text, _create boolean, _title text, _tier text, _value numeric, _description text, _phrase text,
  _rewards text[], _image_url text, _is_active boolean)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_save_award_tier(_id, _create, _title, _tier, _value, _description, _phrase, _rewards, _image_url, _is_active); $$;

CREATE OR REPLACE FUNCTION public.admin_move_award_tier(_id text, _dir text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_move_award_tier(_id, _dir); $$;

CREATE OR REPLACE FUNCTION public.admin_delete_award_tier(_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_delete_award_tier(_id); END $$;

-- ───────────────────────── permissões das funções ─────────────────────────

REVOKE ALL ON FUNCTION
  app_private.get_admin_reward_claims_page(text, text, integer, integer), app_private.get_admin_reward_claim_detail(uuid), app_private.get_admin_award_tiers(),
  app_private.admin_set_reward_claim(uuid, text, text, text, text, text),
  app_private.admin_update_reward_claim_shipping(uuid, text, text, text, text, text, text, text, text, text, text, text),
  app_private.admin_add_reward_claim_note(uuid, text),
  app_private.admin_save_award_tier(text, boolean, text, text, numeric, text, text, text[], text, boolean),
  app_private.admin_move_award_tier(text, text), app_private.admin_delete_award_tier(text),
  public.get_admin_reward_claims_page(text, text, integer, integer), public.get_admin_reward_claim_detail(uuid), public.get_admin_award_tiers(),
  public.admin_set_reward_claim(uuid, text, text, text, text, text),
  public.admin_update_reward_claim_shipping(uuid, text, text, text, text, text, text, text, text, text, text, text),
  public.admin_add_reward_claim_note(uuid, text),
  public.admin_save_award_tier(text, boolean, text, text, numeric, text, text, text[], text, boolean),
  public.admin_move_award_tier(text, text), public.admin_delete_award_tier(text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.get_admin_reward_claims_page(text, text, integer, integer), app_private.get_admin_reward_claim_detail(uuid), app_private.get_admin_award_tiers(),
  app_private.admin_set_reward_claim(uuid, text, text, text, text, text),
  app_private.admin_update_reward_claim_shipping(uuid, text, text, text, text, text, text, text, text, text, text, text),
  app_private.admin_add_reward_claim_note(uuid, text),
  app_private.admin_save_award_tier(text, boolean, text, text, numeric, text, text, text[], text, boolean),
  app_private.admin_move_award_tier(text, text), app_private.admin_delete_award_tier(text),
  public.get_admin_reward_claims_page(text, text, integer, integer), public.get_admin_reward_claim_detail(uuid), public.get_admin_award_tiers(),
  public.admin_set_reward_claim(uuid, text, text, text, text, text),
  public.admin_update_reward_claim_shipping(uuid, text, text, text, text, text, text, text, text, text, text, text),
  public.admin_add_reward_claim_note(uuid, text),
  public.admin_save_award_tier(text, boolean, text, text, numeric, text, text, text[], text, boolean),
  public.admin_move_award_tier(text, text), public.admin_delete_award_tier(text)
  TO authenticated, service_role;
