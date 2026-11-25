-- Corridas de faturamento do admin: travas nas tabelas, validações e funções com auditoria.
-- Antes: a aba escrevia direto em revenue_races / revenue_race_prizes / revenue_race_overrides (sem validação,
-- auditoria feita depois e podendo falhar em silêncio) e o ranking aceitava "participantes de demonstração".

-- ───────────────────────── travas ─────────────────────────

REVOKE INSERT, UPDATE, DELETE ON public.revenue_races, public.revenue_race_prizes, public.revenue_race_overrides FROM authenticated;
REVOKE ALL ON public.revenue_races, public.revenue_race_prizes, public.revenue_race_overrides FROM anon;

DROP POLICY IF EXISTS revenue_races_admin_delete ON public.revenue_races;
DROP POLICY IF EXISTS revenue_races_admin_insert ON public.revenue_races;
DROP POLICY IF EXISTS revenue_races_admin_update ON public.revenue_races;
DROP POLICY IF EXISTS revenue_race_prizes_admin_delete ON public.revenue_race_prizes;
DROP POLICY IF EXISTS revenue_race_prizes_admin_insert ON public.revenue_race_prizes;
DROP POLICY IF EXISTS revenue_race_prizes_admin_update ON public.revenue_race_prizes;
DROP POLICY IF EXISTS race_overrides_admin_write ON public.revenue_race_overrides;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_races_window_chk') THEN
    ALTER TABLE public.revenue_races ADD CONSTRAINT revenue_races_window_chk CHECK (ends_at > starts_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_races_text_chk') THEN
    ALTER TABLE public.revenue_races ADD CONSTRAINT revenue_races_text_chk
      CHECK (char_length(btrim(title)) BETWEEN 3 AND 80 AND (description IS NULL OR char_length(description) <= 500));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_race_prizes_values_chk') THEN
    ALTER TABLE public.revenue_race_prizes ADD CONSTRAINT revenue_race_prizes_values_chk
      CHECK (char_length(btrim(title)) BETWEEN 2 AND 80 AND (description IS NULL OR char_length(description) <= 300)
             AND min_revenue_cents >= 0 AND (target_position IS NULL OR target_position BETWEEN 1 AND 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_race_overrides_values_chk') THEN
    ALTER TABLE public.revenue_race_overrides ADD CONSTRAINT revenue_race_overrides_values_chk
      CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 40 AND revenue_cents BETWEEN 0 AND 100000000000 AND sales_count BETWEEN 0 AND 10000000);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_race_prizes_position ON public.revenue_race_prizes (race_id, target_position) WHERE target_position IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_race_overrides_seller ON public.revenue_race_overrides (race_id, seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_race_prizes_race_sort ON public.revenue_race_prizes (race_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_race_overrides_race ON public.revenue_race_overrides (race_id);

-- ───────────────────────── apoio ─────────────────────────

-- Vendas reais dentro da janela da corrida (mesma regra do ranking: concluídas, não simuladas), em centavos.
CREATE OR REPLACE FUNCTION app_private.race_real_totals(_race_id uuid)
RETURNS TABLE(participants bigint, revenue_cents bigint, sales bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT t.user_id)::bigint,
         COALESCE(ROUND(SUM(t.net_amount) * 100), 0)::bigint,
         COUNT(t.id)::bigint
    FROM public.revenue_races r
    LEFT JOIN public.transactions t
      ON t.created_at >= r.starts_at AND t.created_at <= r.ends_at
     AND t.status IN ('completed', 'approved', 'paid') AND t.is_simulated = false AND t.user_id IS NOT NULL
   WHERE r.id = _race_id;
$function$;

-- ───────────────────────── leitura ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_races()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_live uuid; v_items jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT id INTO v_live FROM public.revenue_races WHERE is_active ORDER BY starts_at DESC, created_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'description', COALESCE(r.description, ''), 'starts_at', r.starts_at, 'ends_at', r.ends_at,
    'is_active', r.is_active, 'is_live', r.id = v_live, 'banner_url', r.banner_url, 'logo_url', r.logo_url, 'created_at', r.created_at,
    'prizes', (SELECT count(*) FROM public.revenue_race_prizes p WHERE p.race_id = r.id),
    'entries', (SELECT count(*) FROM public.revenue_race_overrides o WHERE o.race_id = r.id),
    'fictional', (SELECT count(*) FROM public.revenue_race_overrides o WHERE o.race_id = r.id AND o.seller_id IS NULL),
    'participants', tt.participants, 'revenue_cents', tt.revenue_cents, 'sales', tt.sales
  ) ORDER BY r.starts_at DESC, r.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (SELECT * FROM public.revenue_races ORDER BY starts_at DESC, created_at DESC LIMIT 100) r
  CROSS JOIN LATERAL app_private.race_real_totals(r.id) tt;

  RETURN jsonb_build_object('items', v_items, 'live_id', v_live, 'generated_at', now());
END
$function$;

CREATE OR REPLACE FUNCTION app_private.get_admin_race_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.revenue_races%ROWTYPE;
  v_live uuid; v_tot record; v_prizes jsonb; v_entries jsonb; v_board jsonb; v_hist jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO r FROM public.revenue_races WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'corrida não encontrada'; END IF;
  SELECT id INTO v_live FROM public.revenue_races WHERE is_active ORDER BY starts_at DESC, created_at DESC LIMIT 1;
  SELECT * INTO v_tot FROM app_private.race_real_totals(_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', COALESCE(p.description, ''), 'image_url', p.image_url,
    'kind', CASE WHEN p.target_position IS NOT NULL AND p.target_position > 0 THEN 'place' ELSE 'goal' END,
    'position', p.target_position, 'goal_cents', p.min_revenue_cents, 'sort_order', p.sort_order
  ) ORDER BY p.sort_order, p.created_at, p.id), '[]'::jsonb)
  INTO v_prizes FROM public.revenue_race_prizes p WHERE p.race_id = _id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'seller_id', o.seller_id, 'display_name', o.display_name, 'avatar_url', o.avatar_url,
    'revenue_cents', o.revenue_cents, 'sales_count', o.sales_count, 'updated_at', o.updated_at,
    'seller', CASE WHEN o.seller_id IS NULL THEN NULL ELSE jsonb_build_object('name', COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.full_name), '')), 'email', p.email) END,
    'real_revenue_cents', x.rev, 'real_sales', x.cnt
  ) ORDER BY o.revenue_cents DESC, o.created_at), '[]'::jsonb)
  INTO v_entries
  FROM public.revenue_race_overrides o
  LEFT JOIN public.profiles p ON p.user_id = o.seller_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(ROUND(SUM(t.net_amount) * 100), 0)::bigint AS rev, COUNT(t.id)::bigint AS cnt
      FROM public.transactions t
     WHERE o.seller_id IS NOT NULL AND t.user_id = o.seller_id AND t.status IN ('completed', 'approved', 'paid')
       AND t.is_simulated = false AND t.created_at >= r.starts_at AND t.created_at <= r.ends_at
  ) x ON true
  WHERE o.race_id = _id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rank', l.rank_position, 'seller_id', l.seller_id, 'name', l.seller_name, 'avatar', l.seller_avatar,
    'revenue_cents', l.revenue_cents, 'sales_count', l.sales_count, 'is_manual', l.is_manual,
    'has_account', l.seller_id IS NOT NULL, 'email', p.email
  ) ORDER BY l.rank_position), '[]'::jsonb)
  INTO v_board FROM app_private.race_leaderboard(_id) l LEFT JOIN public.profiles p ON p.user_id = l.seller_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('at', h.created_at, 'action', h.action, 'details', h.details,
                                               'by', NULLIF(btrim(COALESCE(a.full_name, '')), '')) ORDER BY h.created_at DESC), '[]'::jsonb)
  INTO v_hist FROM (
    SELECT * FROM public.audit_logs
     WHERE entity_type IN ('race', 'race_prize', 'race_entry') AND (entity_id = _id::text OR details->>'race_id' = _id::text)
     ORDER BY created_at DESC LIMIT 40
  ) h LEFT JOIN public.profiles a ON a.user_id = h.admin_user_id;

  RETURN jsonb_build_object(
    'race', jsonb_build_object('id', r.id, 'title', r.title, 'description', COALESCE(r.description, ''), 'starts_at', r.starts_at, 'ends_at', r.ends_at,
                               'is_active', r.is_active, 'is_live', r.id = v_live, 'banner_url', r.banner_url, 'logo_url', r.logo_url, 'created_at', r.created_at),
    'live_title', (SELECT title FROM public.revenue_races WHERE id = v_live),
    'totals', jsonb_build_object('participants', v_tot.participants, 'revenue_cents', v_tot.revenue_cents, 'sales', v_tot.sales),
    'prizes', v_prizes, 'entries', v_entries, 'board', v_board, 'history', v_hist, 'generated_at', now());
END
$function$;

-- ───────────────────────── corrida ─────────────────────────

-- Cria (quando _id é nulo; nasce oculta) ou edita título, texto, datas e imagens. Mudar a janela de uma corrida
-- que já começou muda quem vence: pede senha recente.
CREATE OR REPLACE FUNCTION app_private.admin_save_race(_id uuid, _title text, _description text, _starts_at timestamptz, _ends_at timestamptz, _banner_url text, _logo_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  r public.revenue_races%ROWTYPE;
  v_title text := regexp_replace(btrim(COALESCE(_title, '')), '\s+', ' ', 'g');
  v_desc text := btrim(COALESCE(_description, ''));
  v_banner text := NULLIF(btrim(COALESCE(_banner_url, '')), '');
  v_logo text := NULLIF(btrim(COALESCE(_logo_url, '')), '');
  v_id uuid;
BEGIN
  IF char_length(v_title) < 3 OR char_length(v_title) > 80 THEN RAISE EXCEPTION 'o nome da corrida precisa ter de 3 a 80 caracteres'; END IF;
  IF char_length(v_desc) > 500 THEN RAISE EXCEPTION 'a descrição passa de 500 caracteres'; END IF;
  IF _starts_at IS NULL OR _ends_at IS NULL THEN RAISE EXCEPTION 'informe o início e o fim da corrida'; END IF;
  IF _ends_at <= _starts_at THEN RAISE EXCEPTION 'o fim da corrida precisa ser depois do início'; END IF;
  IF _ends_at - _starts_at > interval '400 days' THEN RAISE EXCEPTION 'a corrida pode durar no máximo 400 dias'; END IF;
  IF v_banner IS NOT NULL AND (length(v_banner) > 2048 OR v_banner !~* '^https?://[^[:space:]<>"''\\]+$') THEN RAISE EXCEPTION 'o link do banner precisa começar com http:// ou https://'; END IF;
  IF v_logo IS NOT NULL AND (length(v_logo) > 2048 OR v_logo !~* '^https?://[^[:space:]<>"''\\]+$') THEN RAISE EXCEPTION 'o link do logo precisa começar com http:// ou https://'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.revenue_races (title, description, starts_at, ends_at, is_active, banner_url, logo_url, created_by)
    VALUES (v_title, NULLIF(v_desc, ''), _starts_at, _ends_at, false, v_banner, v_logo, v_admin)
    RETURNING id INTO v_id;
    PERFORM app_private.admin_audit(v_admin, 'race_create', 'race', v_id::text,
      jsonb_build_object('race_id', v_id, 'title', v_title, 'starts_at', _starts_at, 'ends_at', _ends_at));
    RETURN jsonb_build_object('id', v_id);
  END IF;

  SELECT * INTO r FROM public.revenue_races WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'corrida não encontrada'; END IF;
  IF r.starts_at <= now() AND (_starts_at IS DISTINCT FROM r.starts_at OR _ends_at IS DISTINCT FROM r.ends_at) THEN
    PERFORM app_private.assert_recent_auth();
  END IF;
  UPDATE public.revenue_races
     SET title = v_title, description = NULLIF(v_desc, ''), starts_at = _starts_at, ends_at = _ends_at, banner_url = v_banner, logo_url = v_logo
   WHERE id = r.id;
  PERFORM app_private.admin_audit(v_admin, 'race_update', 'race', r.id::text, jsonb_build_object(
    'race_id', r.id, 'title', v_title,
    'title_from', CASE WHEN r.title <> v_title THEN r.title END,
    'starts_from', CASE WHEN r.starts_at IS DISTINCT FROM _starts_at THEN r.starts_at END, 'starts_to', CASE WHEN r.starts_at IS DISTINCT FROM _starts_at THEN _starts_at END,
    'ends_from', CASE WHEN r.ends_at IS DISTINCT FROM _ends_at THEN r.ends_at END, 'ends_to', CASE WHEN r.ends_at IS DISTINCT FROM _ends_at THEN _ends_at END,
    'banner_changed', r.banner_url IS DISTINCT FROM v_banner, 'logo_changed', r.logo_url IS DISTINCT FROM v_logo));
  RETURN jsonb_build_object('id', r.id);
END
$function$;

-- Só uma corrida fica no ar por vez (o seller vê a de início mais recente entre as ativas). Ligar outra exige _replace.
CREATE OR REPLACE FUNCTION app_private.admin_set_race_active(_id uuid, _active boolean, _replace boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  r public.revenue_races%ROWTYPE;
  o record; v_replaced text[] := '{}';
BEGIN
  SELECT * INTO r FROM public.revenue_races WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'corrida não encontrada'; END IF;
  IF COALESCE(_active, false) THEN
    IF r.is_active THEN RETURN jsonb_build_object('id', r.id, 'is_active', true, 'replaced', v_replaced); END IF;
    FOR o IN SELECT * FROM public.revenue_races WHERE is_active AND id <> r.id FOR UPDATE LOOP
      IF NOT COALESCE(_replace, false) THEN
        RAISE EXCEPTION 'já existe uma corrida no ar: “%”. Confirme a troca para continuar', o.title;
      END IF;
      UPDATE public.revenue_races SET is_active = false WHERE id = o.id;
      v_replaced := array_append(v_replaced, o.title::text);
      PERFORM app_private.admin_audit(v_admin, 'race_deactivate', 'race', o.id::text, jsonb_build_object('race_id', o.id, 'title', o.title, 'replaced_by', r.id));
    END LOOP;
    UPDATE public.revenue_races SET is_active = true WHERE id = r.id;
    PERFORM app_private.admin_audit(v_admin, 'race_activate', 'race', r.id::text, jsonb_build_object('race_id', r.id, 'title', r.title));
  ELSE
    IF NOT r.is_active THEN RETURN jsonb_build_object('id', r.id, 'is_active', false, 'replaced', v_replaced); END IF;
    UPDATE public.revenue_races SET is_active = false WHERE id = r.id;
    PERFORM app_private.admin_audit(v_admin, 'race_deactivate', 'race', r.id::text, jsonb_build_object('race_id', r.id, 'title', r.title));
  END IF;
  RETURN jsonb_build_object('id', r.id, 'is_active', COALESCE(_active, false), 'replaced', v_replaced);
END
$function$;

-- Apagar leva prêmios e ranking manual junto. Só vale para corrida fora do ar e sem vendas reais no período
-- (senão se perde o histórico de quem venceu: oculte em vez de apagar).
CREATE OR REPLACE FUNCTION app_private.admin_delete_race(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  r public.revenue_races%ROWTYPE;
  v_tot record; v_prizes int; v_entries int;
BEGIN
  PERFORM app_private.assert_recent_auth();
  SELECT * INTO r FROM public.revenue_races WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'corrida não encontrada'; END IF;
  IF r.is_active THEN RAISE EXCEPTION 'tire a corrida do ar antes de apagar'; END IF;
  SELECT * INTO v_tot FROM app_private.race_real_totals(r.id);
  IF v_tot.sales > 0 THEN RAISE EXCEPTION 'esta corrida tem % vendas reais no período: oculte em vez de apagar para guardar quem venceu', v_tot.sales; END IF;
  SELECT count(*) INTO v_prizes FROM public.revenue_race_prizes WHERE race_id = r.id;
  SELECT count(*) INTO v_entries FROM public.revenue_race_overrides WHERE race_id = r.id;
  DELETE FROM public.revenue_races WHERE id = r.id;
  PERFORM app_private.admin_audit(v_admin, 'race_delete', 'race', r.id::text,
    jsonb_build_object('race_id', r.id, 'title', r.title, 'prizes', v_prizes, 'entries', v_entries));
  RETURN jsonb_build_object('id', r.id);
END
$function$;

-- ───────────────────────── prêmios ─────────────────────────

-- _kind 'place' = prêmio de uma colocação exata (1º, 2º...); 'goal' = meta de faturamento (bateu, levou).
CREATE OR REPLACE FUNCTION app_private.admin_save_race_prize(_id uuid, _race_id uuid, _title text, _description text, _image_url text, _kind text, _position integer, _goal_cents bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  r public.revenue_races%ROWTYPE;
  p public.revenue_race_prizes%ROWTYPE;
  v_title text := regexp_replace(btrim(COALESCE(_title, '')), '\s+', ' ', 'g');
  v_desc text := btrim(COALESCE(_description, ''));
  v_img text := NULLIF(btrim(COALESCE(_image_url, '')), '');
  v_pos int; v_goal bigint; v_id uuid;
BEGIN
  IF char_length(v_title) < 2 OR char_length(v_title) > 80 THEN RAISE EXCEPTION 'o nome do prêmio precisa ter de 2 a 80 caracteres'; END IF;
  IF char_length(v_desc) > 300 THEN RAISE EXCEPTION 'a descrição passa de 300 caracteres'; END IF;
  IF v_img IS NOT NULL AND (length(v_img) > 2048 OR v_img !~* '^https?://[^[:space:]<>"''\\]+$') THEN RAISE EXCEPTION 'o link da imagem precisa começar com http:// ou https://'; END IF;
  IF _kind = 'place' THEN
    IF _position IS NULL OR _position < 1 OR _position > 100 THEN RAISE EXCEPTION 'a colocação precisa ir de 1º a 100º'; END IF;
    v_pos := _position; v_goal := 0;
  ELSIF _kind = 'goal' THEN
    IF _goal_cents IS NULL OR _goal_cents <= 0 OR _goal_cents > 10000000000 THEN RAISE EXCEPTION 'a meta precisa ser maior que zero e ir até R$ 100.000.000'; END IF;
    v_pos := NULL; v_goal := _goal_cents;
  ELSE
    RAISE EXCEPTION 'escolha se o prêmio é por colocação ou por meta de faturamento';
  END IF;

  IF _id IS NULL THEN
    SELECT * INTO r FROM public.revenue_races WHERE id = _race_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'corrida não encontrada'; END IF;
    IF r.starts_at <= now() THEN PERFORM app_private.assert_recent_auth(); END IF;
    IF v_pos IS NOT NULL AND EXISTS (SELECT 1 FROM public.revenue_race_prizes WHERE race_id = r.id AND target_position = v_pos) THEN
      RAISE EXCEPTION 'esta corrida já tem um prêmio para o %º lugar', v_pos;
    END IF;
    INSERT INTO public.revenue_race_prizes (race_id, title, description, image_url, min_revenue_cents, target_position, sort_order)
    VALUES (r.id, v_title, NULLIF(v_desc, ''), v_img, v_goal, v_pos, COALESCE((SELECT max(sort_order) FROM public.revenue_race_prizes WHERE race_id = r.id), -1) + 1)
    RETURNING id INTO v_id;
    PERFORM app_private.admin_audit(v_admin, 'race_prize_create', 'race_prize', v_id::text,
      jsonb_build_object('race_id', r.id, 'title', v_title, 'kind', _kind, 'position', v_pos, 'goal_cents', v_goal));
    RETURN jsonb_build_object('id', v_id);
  END IF;

  SELECT * INTO p FROM public.revenue_race_prizes WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prêmio não encontrado'; END IF;
  SELECT * INTO r FROM public.revenue_races WHERE id = p.race_id;
  IF r.starts_at <= now() AND (v_pos IS DISTINCT FROM p.target_position OR v_goal IS DISTINCT FROM CASE WHEN p.target_position IS NULL THEN p.min_revenue_cents ELSE 0 END) THEN
    PERFORM app_private.assert_recent_auth();
  END IF;
  IF v_pos IS NOT NULL AND EXISTS (SELECT 1 FROM public.revenue_race_prizes WHERE race_id = p.race_id AND target_position = v_pos AND id <> p.id) THEN
    RAISE EXCEPTION 'esta corrida já tem um prêmio para o %º lugar', v_pos;
  END IF;
  UPDATE public.revenue_race_prizes
     SET title = v_title, description = NULLIF(v_desc, ''), image_url = v_img, min_revenue_cents = v_goal, target_position = v_pos
   WHERE id = p.id;
  PERFORM app_private.admin_audit(v_admin, 'race_prize_update', 'race_prize', p.id::text, jsonb_build_object(
    'race_id', p.race_id, 'title', v_title, 'kind', _kind,
    'position_from', p.target_position, 'position_to', v_pos,
    'goal_from', CASE WHEN p.target_position IS NULL THEN p.min_revenue_cents END, 'goal_to', CASE WHEN v_pos IS NULL THEN v_goal END));
  RETURN jsonb_build_object('id', p.id);
END
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_move_race_prize(_id uuid, _dir text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  p public.revenue_race_prizes%ROWTYPE;
  v_ids uuid[]; v_i int; v_j int; v_tmp uuid;
BEGIN
  IF _dir NOT IN ('up', 'down') THEN RAISE EXCEPTION 'direção inválida'; END IF;
  SELECT * INTO p FROM public.revenue_race_prizes WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'prêmio não encontrado'; END IF;
  PERFORM 1 FROM public.revenue_races WHERE id = p.race_id FOR UPDATE;
  SELECT array_agg(id ORDER BY sort_order, created_at, id) INTO v_ids FROM public.revenue_race_prizes WHERE race_id = p.race_id;
  v_i := array_position(v_ids, _id);
  v_j := CASE WHEN _dir = 'up' THEN v_i - 1 ELSE v_i + 1 END;
  IF v_j < 1 OR v_j > cardinality(v_ids) THEN RETURN jsonb_build_object('moved', false); END IF;
  v_tmp := v_ids[v_i]; v_ids[v_i] := v_ids[v_j]; v_ids[v_j] := v_tmp;
  UPDATE public.revenue_race_prizes z SET sort_order = n.pos
    FROM (SELECT id, (ord - 1)::int AS pos FROM unnest(v_ids) WITH ORDINALITY AS u(id, ord)) n
   WHERE z.id = n.id AND z.sort_order IS DISTINCT FROM n.pos;
  PERFORM app_private.admin_audit(v_admin, 'race_prize_move', 'race_prize', p.id::text, jsonb_build_object('race_id', p.race_id, 'title', p.title, 'dir', _dir));
  RETURN jsonb_build_object('moved', true);
END
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_delete_race_prize(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  p public.revenue_race_prizes%ROWTYPE;
  r public.revenue_races%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.revenue_race_prizes WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prêmio não encontrado'; END IF;
  SELECT * INTO r FROM public.revenue_races WHERE id = p.race_id;
  IF r.starts_at <= now() THEN PERFORM app_private.assert_recent_auth(); END IF;
  DELETE FROM public.revenue_race_prizes WHERE id = p.id;
  PERFORM app_private.admin_audit(v_admin, 'race_prize_delete', 'race_prize', p.id::text,
    jsonb_build_object('race_id', p.race_id, 'title', p.title, 'position', p.target_position, 'goal_cents', CASE WHEN p.target_position IS NULL THEN p.min_revenue_cents END));
  RETURN jsonb_build_object('id', p.id);
END
$function$;

-- ───────────────────────── ranking manual ─────────────────────────

-- Valor fixo no ranking. Com _seller_id, SUBSTITUI o faturamento real daquele seller na corrida; sem conta, cria um
-- participante que os sellers veem como pessoa. Muda quem ganha: senha recente e motivo obrigatório (vai para a auditoria).
CREATE OR REPLACE FUNCTION app_private.admin_save_race_entry(_id uuid, _race_id uuid, _seller_id uuid, _display_name text, _avatar_url text, _revenue_cents bigint, _sales_count bigint, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  r public.revenue_races%ROWTYPE;
  o public.revenue_race_overrides%ROWTYPE;
  v_name text := regexp_replace(btrim(COALESCE(_display_name, '')), '\s+', ' ', 'g');
  v_avatar text := NULLIF(btrim(COALESCE(_avatar_url, '')), '');
  v_reason text := btrim(COALESCE(_reason, ''));
  v_prof text; v_id uuid;
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF char_length(v_reason) < 5 OR char_length(v_reason) > 300 THEN RAISE EXCEPTION 'explique o motivo em 5 a 300 caracteres'; END IF;
  IF _revenue_cents IS NULL OR _revenue_cents < 0 OR _revenue_cents > 100000000000 THEN RAISE EXCEPTION 'o faturamento precisa ir de R$ 0 a R$ 1.000.000.000'; END IF;
  IF _sales_count IS NULL OR _sales_count < 0 OR _sales_count > 10000000 THEN RAISE EXCEPTION 'a quantidade de vendas precisa ser um número de 0 a 10.000.000'; END IF;
  IF v_avatar IS NOT NULL AND (length(v_avatar) > 2048 OR v_avatar !~* '^https?://[^[:space:]<>"''\\]+$') THEN RAISE EXCEPTION 'o link da foto precisa começar com http:// ou https://'; END IF;

  IF _id IS NULL THEN
    SELECT * INTO r FROM public.revenue_races WHERE id = _race_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'corrida não encontrada'; END IF;
    IF _seller_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.full_name), '')) INTO v_prof FROM public.profiles p WHERE p.user_id = _seller_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'seller não encontrado'; END IF;
      IF EXISTS (SELECT 1 FROM public.revenue_race_overrides WHERE race_id = r.id AND seller_id = _seller_id) THEN
        RAISE EXCEPTION 'este seller já tem um valor fixo nesta corrida: edite o que existe';
      END IF;
      IF v_name = '' THEN v_name := COALESCE(v_prof, 'Seller'); END IF;
    END IF;
    IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN RAISE EXCEPTION 'o nome exibido precisa ter de 2 a 40 caracteres'; END IF;
    INSERT INTO public.revenue_race_overrides (race_id, seller_id, display_name, avatar_url, revenue_cents, sales_count)
    VALUES (r.id, _seller_id, v_name, v_avatar, _revenue_cents, _sales_count) RETURNING id INTO v_id;
    PERFORM app_private.admin_audit(v_admin, 'race_entry_create', 'race_entry', v_id::text, jsonb_build_object(
      'race_id', r.id, 'name', v_name, 'linked', _seller_id IS NOT NULL, 'seller_id', _seller_id, 'revenue_cents', _revenue_cents, 'sales_count', _sales_count,
      'reason', v_reason, 'race_ended', r.ends_at <= now()));
    RETURN jsonb_build_object('id', v_id);
  END IF;

  SELECT * INTO o FROM public.revenue_race_overrides WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'entrada não encontrada'; END IF;
  SELECT * INTO r FROM public.revenue_races WHERE id = o.race_id;
  IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN RAISE EXCEPTION 'o nome exibido precisa ter de 2 a 40 caracteres'; END IF;
  UPDATE public.revenue_race_overrides SET display_name = v_name, avatar_url = v_avatar, revenue_cents = _revenue_cents, sales_count = _sales_count WHERE id = o.id;
  PERFORM app_private.admin_audit(v_admin, 'race_entry_update', 'race_entry', o.id::text, jsonb_build_object(
    'race_id', o.race_id, 'name', v_name, 'name_from', CASE WHEN o.display_name <> v_name THEN o.display_name END,
    'linked', o.seller_id IS NOT NULL, 'seller_id', o.seller_id,
    'revenue_from', o.revenue_cents, 'revenue_to', _revenue_cents, 'sales_from', o.sales_count, 'sales_to', _sales_count,
    'reason', v_reason, 'race_ended', r.ends_at <= now()));
  RETURN jsonb_build_object('id', o.id);
END
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_delete_race_entry(_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  o public.revenue_race_overrides%ROWTYPE;
  r public.revenue_races%ROWTYPE;
  v_reason text := btrim(COALESCE(_reason, ''));
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF char_length(v_reason) < 5 OR char_length(v_reason) > 300 THEN RAISE EXCEPTION 'explique o motivo em 5 a 300 caracteres'; END IF;
  SELECT * INTO o FROM public.revenue_race_overrides WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'entrada não encontrada'; END IF;
  SELECT * INTO r FROM public.revenue_races WHERE id = o.race_id;
  DELETE FROM public.revenue_race_overrides WHERE id = o.id;
  PERFORM app_private.admin_audit(v_admin, 'race_entry_delete', 'race_entry', o.id::text, jsonb_build_object(
    'race_id', o.race_id, 'name', o.display_name, 'linked', o.seller_id IS NOT NULL, 'seller_id', o.seller_id,
    'revenue_cents', o.revenue_cents, 'sales_count', o.sales_count, 'reason', v_reason, 'race_ended', r.ends_at <= now()));
  RETURN jsonb_build_object('id', o.id);
END
$function$;

-- ───────────────────────── funções públicas ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_races()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_races(); $$;

CREATE OR REPLACE FUNCTION public.get_admin_race_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_race_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_save_race(_id uuid, _title text, _description text, _starts_at timestamptz, _ends_at timestamptz, _banner_url text, _logo_url text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_save_race(_id, _title, _description, _starts_at, _ends_at, _banner_url, _logo_url); $$;

CREATE OR REPLACE FUNCTION public.admin_set_race_active(_id uuid, _active boolean, _replace boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_race_active(_id, _active, _replace); $$;

CREATE OR REPLACE FUNCTION public.admin_delete_race(_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_delete_race(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_save_race_prize(_id uuid, _race_id uuid, _title text, _description text, _image_url text, _kind text, _position integer, _goal_cents bigint)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_save_race_prize(_id, _race_id, _title, _description, _image_url, _kind, _position, _goal_cents); $$;

CREATE OR REPLACE FUNCTION public.admin_move_race_prize(_id uuid, _dir text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_move_race_prize(_id, _dir); $$;

CREATE OR REPLACE FUNCTION public.admin_delete_race_prize(_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_delete_race_prize(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_save_race_entry(_id uuid, _race_id uuid, _seller_id uuid, _display_name text, _avatar_url text, _revenue_cents bigint, _sales_count bigint, _reason text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_save_race_entry(_id, _race_id, _seller_id, _display_name, _avatar_url, _revenue_cents, _sales_count, _reason); $$;

CREATE OR REPLACE FUNCTION public.admin_delete_race_entry(_id uuid, _reason text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_delete_race_entry(_id, _reason); $$;

-- ───────────────────────── permissões das funções ─────────────────────────

REVOKE ALL ON FUNCTION
  app_private.race_real_totals(uuid),
  app_private.get_admin_races(), app_private.get_admin_race_detail(uuid),
  app_private.admin_save_race(uuid, text, text, timestamptz, timestamptz, text, text),
  app_private.admin_set_race_active(uuid, boolean, boolean), app_private.admin_delete_race(uuid),
  app_private.admin_save_race_prize(uuid, uuid, text, text, text, text, integer, bigint),
  app_private.admin_move_race_prize(uuid, text), app_private.admin_delete_race_prize(uuid),
  app_private.admin_save_race_entry(uuid, uuid, uuid, text, text, bigint, bigint, text),
  app_private.admin_delete_race_entry(uuid, text),
  public.get_admin_races(), public.get_admin_race_detail(uuid),
  public.admin_save_race(uuid, text, text, timestamptz, timestamptz, text, text),
  public.admin_set_race_active(uuid, boolean, boolean), public.admin_delete_race(uuid),
  public.admin_save_race_prize(uuid, uuid, text, text, text, text, integer, bigint),
  public.admin_move_race_prize(uuid, text), public.admin_delete_race_prize(uuid),
  public.admin_save_race_entry(uuid, uuid, uuid, text, text, bigint, bigint, text),
  public.admin_delete_race_entry(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.race_real_totals(uuid),
  app_private.get_admin_races(), app_private.get_admin_race_detail(uuid),
  app_private.admin_save_race(uuid, text, text, timestamptz, timestamptz, text, text),
  app_private.admin_set_race_active(uuid, boolean, boolean), app_private.admin_delete_race(uuid),
  app_private.admin_save_race_prize(uuid, uuid, text, text, text, text, integer, bigint),
  app_private.admin_move_race_prize(uuid, text), app_private.admin_delete_race_prize(uuid),
  app_private.admin_save_race_entry(uuid, uuid, uuid, text, text, bigint, bigint, text),
  app_private.admin_delete_race_entry(uuid, text),
  public.get_admin_races(), public.get_admin_race_detail(uuid),
  public.admin_save_race(uuid, text, text, timestamptz, timestamptz, text, text),
  public.admin_set_race_active(uuid, boolean, boolean), public.admin_delete_race(uuid),
  public.admin_save_race_prize(uuid, uuid, text, text, text, text, integer, bigint),
  public.admin_move_race_prize(uuid, text), public.admin_delete_race_prize(uuid),
  public.admin_save_race_entry(uuid, uuid, uuid, text, text, bigint, bigint, text),
  public.admin_delete_race_entry(uuid, text)
  TO authenticated, service_role;

-- ───────────────────────── bucket das imagens ─────────────────────────
-- O bucket é privado (o seller lê por link assinado da edge `get-race-asset-urls`); só imagens e até 5 MB.
UPDATE storage.buckets
   SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 WHERE id = 'race-assets';
