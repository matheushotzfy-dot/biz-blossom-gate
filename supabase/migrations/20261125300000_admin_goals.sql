-- Metas de faturamento do admin: travas nas tabelas, validações e funções com auditoria.
-- Antes: a aba escrevia direto em revenue_goals (sem validação; a auditoria saía do navegador, depois, e podia falhar
-- em silêncio: zero registros até hoje), as datas eram lidas em UTC, o ranking somava o valor BRUTO e contava venda
-- simulada, e a tabela de prêmios entregues (revenue_goal_achievements) não tinha nenhum uso.
-- Medida única da meta (a mesma da Corrida e das Premiações): valor LÍQUIDO das vendas pagas, não simuladas,
-- dentro da janela da meta.

-- ───────────────────────── travas ─────────────────────────

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.revenue_goals, public.revenue_goal_achievements FROM authenticated;
REVOKE ALL ON public.revenue_goals, public.revenue_goal_achievements FROM anon;

-- A leitura continua pelas policies de SELECT (meta ativa para quem está logado, tudo para o admin; o seller lê o próprio prêmio).
DROP POLICY IF EXISTS admin_manages_goals ON public.revenue_goals;
DROP POLICY IF EXISTS admin_manages_ach ON public.revenue_goal_achievements;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_goals_text_chk') THEN
    ALTER TABLE public.revenue_goals ADD CONSTRAINT revenue_goals_text_chk
      CHECK (char_length(btrim(title)) BETWEEN 3 AND 80 AND char_length(btrim(reward_title)) BETWEEN 2 AND 80
             AND (description IS NULL OR char_length(description) <= 500)
             AND (reward_description IS NULL OR char_length(reward_description) <= 500));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_goals_window_chk') THEN
    ALTER TABLE public.revenue_goals ADD CONSTRAINT revenue_goals_window_chk
      CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '400 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_goals_target_max_chk') THEN
    ALTER TABLE public.revenue_goals ADD CONSTRAINT revenue_goals_target_max_chk CHECK (target_amount <= 100000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_goal_achievements_values_chk') THEN
    ALTER TABLE public.revenue_goal_achievements ADD CONSTRAINT revenue_goal_achievements_values_chk
      CHECK (achieved_amount >= 0 AND (notes IS NULL OR char_length(notes) <= 300) AND ((reward_status = 'paid') = (paid_at IS NOT NULL)));
  END IF;
END $$;

-- ───────────────────────── apoio ─────────────────────────

-- Faturamento de cada seller dentro da janela da meta, em reais (líquido, vendas pagas, sem simuladas).
-- Interna: só as funções abaixo chamam (por isso não tem EXECUTE para quem está logado).
CREATE OR REPLACE FUNCTION app_private.goal_revenue(_goal_id uuid)
RETURNS TABLE(seller_id uuid, revenue numeric, sales bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.user_id, ROUND(SUM(COALESCE(t.net_amount, 0)), 2), COUNT(t.id)::bigint
    FROM public.revenue_goals g
    JOIN public.transactions t
      ON t.created_at >= g.starts_at AND t.created_at <= g.ends_at
     AND t.status IN ('completed', 'approved', 'paid') AND t.is_simulated = false AND t.user_id IS NOT NULL
   WHERE g.id = _goal_id
   GROUP BY t.user_id;
$function$;

-- As funções antigas (valor bruto, venda simulada contada, só 200 sellers, sem auditoria) saem; as novas as substituem.
DROP FUNCTION IF EXISTS public.get_goal_progress(uuid);
DROP FUNCTION IF EXISTS app_private.get_goal_progress(uuid);

-- Ninguém chama esta ainda (o seller não tem tela de metas) e ela segue sem EXECUTE para quem está logado;
-- agora usa a mesma medida. Quando existir a tela, conceda EXECUTE a `authenticated`.
CREATE OR REPLACE FUNCTION public.get_my_goal_progress(_goal_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT r.revenue FROM app_private.goal_revenue(_goal_id) r
                    WHERE r.seller_id = auth.uid()
                      AND EXISTS (SELECT 1 FROM public.revenue_goals g WHERE g.id = _goal_id AND g.is_active)), 0)::numeric;
$function$;

-- ───────────────────────── leitura ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_goals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb; v_total int;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT count(*) INTO v_total FROM public.revenue_goals;

  SELECT COALESCE(jsonb_agg(s.j ORDER BY s.created_at DESC, s.id), '[]'::jsonb) INTO v_items FROM (
    SELECT g.id, g.created_at, jsonb_build_object(
      'id', g.id, 'title', g.title, 'description', COALESCE(g.description, ''), 'target', g.target_amount,
      'starts_at', g.starts_at, 'ends_at', g.ends_at, 'reward_title', g.reward_title,
      'reward_description', COALESCE(g.reward_description, ''), 'is_active', g.is_active, 'created_at', g.created_at,
      'sellers', x.sellers, 'reached', x.reached, 'to_deliver', x.to_deliver, 'revenue', x.revenue, 'top', x.top,
      'awards', jsonb_build_object('pending', a.pending, 'paid', a.paid, 'cancelled', a.cancelled)
    ) AS j
      FROM public.revenue_goals g
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS sellers,
               (count(*) FILTER (WHERE r.revenue >= g.target_amount))::int AS reached,
               (count(*) FILTER (WHERE r.revenue >= g.target_amount AND COALESCE(ac.reward_status, 'pending') = 'pending'))::int AS to_deliver,
               COALESCE(sum(r.revenue), 0) AS revenue, COALESCE(max(r.revenue), 0) AS top
          FROM app_private.goal_revenue(g.id) r
          LEFT JOIN public.revenue_goal_achievements ac ON ac.goal_id = g.id AND ac.seller_id = r.seller_id
      ) x ON true
      LEFT JOIN LATERAL (
        SELECT (count(*) FILTER (WHERE ac.reward_status = 'pending'))::int AS pending,
               (count(*) FILTER (WHERE ac.reward_status = 'paid'))::int AS paid,
               (count(*) FILTER (WHERE ac.reward_status = 'cancelled'))::int AS cancelled
          FROM public.revenue_goal_achievements ac WHERE ac.goal_id = g.id
      ) a ON true
     ORDER BY g.created_at DESC, g.id
     LIMIT 100
  ) s;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'generated_at', now());
END
$function$;

CREATE OR REPLACE FUNCTION app_private.get_admin_goal_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g public.revenue_goals%ROWTYPE;
  v_rank jsonb; v_hist jsonb; v_tot record;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO g FROM public.revenue_goals WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'meta não encontrada'; END IF;

  SELECT count(*)::int AS sellers, COALESCE(sum(r.revenue), 0) AS revenue, COALESCE(sum(r.sales), 0)::bigint AS sales
    INTO v_tot FROM app_private.goal_revenue(_id) r;

  WITH rv AS (SELECT * FROM app_private.goal_revenue(_id)),
  ids AS (SELECT seller_id FROM rv UNION SELECT a.seller_id FROM public.revenue_goal_achievements a WHERE a.goal_id = _id),
  rws AS (
    SELECT i.seller_id, COALESCE(rv.revenue, 0) AS revenue, COALESCE(rv.sales, 0) AS sales,
           COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.full_name), ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), 'Seller') AS name,
           p.email, a.id AS award_id, a.reward_status, a.paid_at, a.notes, a.achieved_amount, a.achieved_at
      FROM ids i
      LEFT JOIN rv ON rv.seller_id = i.seller_id
      LEFT JOIN public.profiles p ON p.user_id = i.seller_id
      LEFT JOIN public.revenue_goal_achievements a ON a.goal_id = _id AND a.seller_id = i.seller_id
  ),
  top AS (SELECT * FROM rws ORDER BY revenue DESC, name, seller_id LIMIT 500)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM rws),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'seller_id', t.seller_id, 'name', t.name, 'email', t.email, 'revenue', t.revenue, 'sales', t.sales,
      'reached', t.revenue >= g.target_amount,
      'award', CASE WHEN t.award_id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', t.award_id, 'status', t.reward_status, 'paid_at', t.paid_at, 'note', t.notes,
        'amount', t.achieved_amount, 'registered_at', t.achieved_at) END
    ) ORDER BY t.revenue DESC, t.name, t.seller_id) FROM top t), '[]'::jsonb))
  INTO v_rank;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('at', h.created_at, 'action', h.action, 'details', h.details,
                                               'by', NULLIF(btrim(COALESCE(a.full_name, '')), '')) ORDER BY h.created_at DESC), '[]'::jsonb)
  INTO v_hist FROM (
    SELECT * FROM public.audit_logs
     WHERE entity_type IN ('revenue_goal', 'revenue_goal_award') AND (entity_id = _id::text OR details->>'goal_id' = _id::text)
     ORDER BY created_at DESC LIMIT 40
  ) h LEFT JOIN public.profiles a ON a.user_id = h.admin_user_id;

  RETURN jsonb_build_object(
    'goal', jsonb_build_object('id', g.id, 'title', g.title, 'description', COALESCE(g.description, ''), 'target', g.target_amount,
                               'starts_at', g.starts_at, 'ends_at', g.ends_at, 'reward_title', g.reward_title,
                               'reward_description', COALESCE(g.reward_description, ''), 'is_active', g.is_active, 'created_at', g.created_at),
    'totals', jsonb_build_object('sellers', v_tot.sellers, 'revenue', v_tot.revenue, 'sales', v_tot.sales),
    'ranking', v_rank, 'history', v_hist, 'generated_at', now());
END
$function$;

-- ───────────────────────── escrita ─────────────────────────

-- Criar (nasce oculta) ou editar. Valor e datas só mudam enquanto ninguém tem prêmio registrado, e com senha
-- recente quando a meta já começou: mudar o valor ou a janela muda quem bateu.
CREATE OR REPLACE FUNCTION app_private.admin_save_goal(
  _id uuid, _title text, _description text, _target numeric, _starts_at timestamptz, _ends_at timestamptz,
  _reward_title text, _reward_description text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  g public.revenue_goals%ROWTYPE;
  v_title text := regexp_replace(btrim(COALESCE(_title, '')), '\s+', ' ', 'g');
  v_reward text := regexp_replace(btrim(COALESCE(_reward_title, '')), '\s+', ' ', 'g');
  v_desc text := btrim(COALESCE(_description, ''));
  v_rdesc text := btrim(COALESCE(_reward_description, ''));
  v_target numeric;
  v_id uuid;
  v_core boolean;
BEGIN
  IF char_length(v_title) < 3 OR char_length(v_title) > 80 THEN RAISE EXCEPTION 'dê um nome à meta, de 3 a 80 caracteres'; END IF;
  IF char_length(v_reward) < 2 OR char_length(v_reward) > 80 THEN RAISE EXCEPTION 'diga qual é o prêmio, de 2 a 80 caracteres'; END IF;
  IF char_length(v_desc) > 500 THEN RAISE EXCEPTION 'a descrição passa de 500 caracteres'; END IF;
  IF char_length(v_rdesc) > 500 THEN RAISE EXCEPTION 'os detalhes do prêmio passam de 500 caracteres'; END IF;
  v_target := round(_target, 2);
  IF v_target IS NULL OR v_target < 0.01 OR v_target > 100000000 THEN RAISE EXCEPTION 'a meta precisa ser maior que zero e ir até R$ 100.000.000'; END IF;
  IF _starts_at IS NULL OR _ends_at IS NULL THEN RAISE EXCEPTION 'informe o início e o fim'; END IF;
  IF _ends_at <= _starts_at THEN RAISE EXCEPTION 'o fim precisa ser depois do início'; END IF;
  IF _ends_at - _starts_at > interval '400 days' THEN RAISE EXCEPTION 'a meta pode durar no máximo 400 dias'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.revenue_goals (title, description, target_amount, period_type, starts_at, ends_at, reward_title, reward_description, is_active)
    VALUES (v_title, NULLIF(v_desc, ''), v_target, 'custom', _starts_at, _ends_at, v_reward, NULLIF(v_rdesc, ''), false)
    RETURNING id INTO v_id;
    PERFORM app_private.admin_audit(v_admin, 'goal_create', 'revenue_goal', v_id::text,
      jsonb_build_object('title', v_title, 'target', v_target, 'starts_at', _starts_at, 'ends_at', _ends_at, 'reward', v_reward));
    RETURN jsonb_build_object('id', v_id);
  END IF;

  SELECT * INTO g FROM public.revenue_goals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'meta não encontrada'; END IF;

  v_core := v_target IS DISTINCT FROM g.target_amount
         OR date_trunc('minute', _starts_at) IS DISTINCT FROM date_trunc('minute', g.starts_at)
         OR date_trunc('minute', _ends_at) IS DISTINCT FROM date_trunc('minute', g.ends_at);
  IF v_core THEN
    IF EXISTS (SELECT 1 FROM public.revenue_goal_achievements WHERE goal_id = g.id) THEN
      RAISE EXCEPTION 'esta meta já tem prêmio registrado: crie outra para mudar o valor ou as datas';
    END IF;
    IF g.starts_at <= now() THEN PERFORM app_private.assert_recent_auth(); END IF;
  END IF;

  UPDATE public.revenue_goals
     SET title = v_title, description = NULLIF(v_desc, ''), target_amount = v_target, starts_at = _starts_at, ends_at = _ends_at,
         reward_title = v_reward, reward_description = NULLIF(v_rdesc, ''), updated_at = now()
   WHERE id = g.id;

  PERFORM app_private.admin_audit(v_admin, 'goal_update', 'revenue_goal', g.id::text, jsonb_strip_nulls(jsonb_build_object(
    'title', v_title,
    'title_from', CASE WHEN v_title IS DISTINCT FROM g.title THEN g.title END,
    'target_from', CASE WHEN v_target IS DISTINCT FROM g.target_amount THEN g.target_amount END,
    'target_to', CASE WHEN v_target IS DISTINCT FROM g.target_amount THEN v_target END,
    'starts_from', CASE WHEN date_trunc('minute', _starts_at) IS DISTINCT FROM date_trunc('minute', g.starts_at) THEN g.starts_at END,
    'starts_to', CASE WHEN date_trunc('minute', _starts_at) IS DISTINCT FROM date_trunc('minute', g.starts_at) THEN _starts_at END,
    'ends_from', CASE WHEN date_trunc('minute', _ends_at) IS DISTINCT FROM date_trunc('minute', g.ends_at) THEN g.ends_at END,
    'ends_to', CASE WHEN date_trunc('minute', _ends_at) IS DISTINCT FROM date_trunc('minute', g.ends_at) THEN _ends_at END,
    'reward_from', CASE WHEN v_reward IS DISTINCT FROM g.reward_title THEN g.reward_title END,
    'reward_to', CASE WHEN v_reward IS DISTINCT FROM g.reward_title THEN v_reward END)));
  RETURN jsonb_build_object('id', g.id);
END
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_set_goal_active(_id uuid, _active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  g public.revenue_goals%ROWTYPE;
BEGIN
  IF _active IS NULL THEN RAISE EXCEPTION 'informe se a meta fica no ar ou oculta'; END IF;
  SELECT * INTO g FROM public.revenue_goals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'meta não encontrada'; END IF;
  IF g.is_active = _active THEN RETURN jsonb_build_object('changed', false); END IF;
  UPDATE public.revenue_goals SET is_active = _active, updated_at = now() WHERE id = g.id;
  PERFORM app_private.admin_audit(v_admin, CASE WHEN _active THEN 'goal_activate' ELSE 'goal_deactivate' END, 'revenue_goal', g.id::text,
    jsonb_build_object('title', g.title));
  RETURN jsonb_build_object('changed', true);
END
$function$;

-- Apagar leva junto o histórico de prêmios: por isso só meta oculta e sem nenhum prêmio registrado, com senha e motivo.
CREATE OR REPLACE FUNCTION app_private.admin_delete_goal(_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  g public.revenue_goals%ROWTYPE;
  v_reason text := btrim(COALESCE(_reason, ''));
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF char_length(v_reason) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  IF char_length(v_reason) > 300 THEN RAISE EXCEPTION 'o motivo passa de 300 caracteres'; END IF;
  SELECT * INTO g FROM public.revenue_goals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'meta não encontrada'; END IF;
  IF g.is_active THEN RAISE EXCEPTION 'oculte a meta antes de apagar'; END IF;
  IF EXISTS (SELECT 1 FROM public.revenue_goal_achievements WHERE goal_id = g.id) THEN
    RAISE EXCEPTION 'esta meta tem prêmios registrados: mantenha oculta em vez de apagar';
  END IF;
  DELETE FROM public.revenue_goals WHERE id = g.id;
  PERFORM app_private.admin_audit(v_admin, 'goal_delete', 'revenue_goal', g.id::text,
    jsonb_build_object('title', g.title, 'target', g.target_amount, 'starts_at', g.starts_at, 'ends_at', g.ends_at, 'reason', v_reason));
  RETURN jsonb_build_object('deleted', true);
END
$function$;

-- Registra o que aconteceu com o prêmio de um seller que bateu a meta. `paid` é definitivo; `cancelled` pode ser reaberto.
CREATE OR REPLACE FUNCTION app_private.admin_set_goal_award(_goal_id uuid, _seller_id uuid, _status text, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := app_private.assert_admin();
  g public.revenue_goals%ROWTYPE;
  a public.revenue_goal_achievements%ROWTYPE;
  v_note text := btrim(COALESCE(_note, ''));
  v_rev numeric; v_name text; v_id uuid; v_has boolean;
BEGIN
  PERFORM app_private.assert_recent_auth();
  IF _status IS NULL OR _status NOT IN ('pending', 'paid', 'cancelled') THEN RAISE EXCEPTION 'situação do prêmio inválida'; END IF;
  IF char_length(v_note) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  IF char_length(v_note) > 300 THEN RAISE EXCEPTION 'o motivo passa de 300 caracteres'; END IF;

  SELECT * INTO g FROM public.revenue_goals WHERE id = _goal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'meta não encontrada'; END IF;
  SELECT COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.full_name), ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), 'Seller')
    INTO v_name FROM public.profiles p WHERE p.user_id = _seller_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'seller não encontrado'; END IF;

  SELECT COALESCE((SELECT r.revenue FROM app_private.goal_revenue(_goal_id) r WHERE r.seller_id = _seller_id), 0) INTO v_rev;
  SELECT * INTO a FROM public.revenue_goal_achievements WHERE goal_id = _goal_id AND seller_id = _seller_id FOR UPDATE;
  v_has := FOUND;

  IF v_has THEN
    IF a.reward_status = 'paid' THEN RAISE EXCEPTION 'o prêmio já foi marcado como entregue e não pode mudar'; END IF;
    IF a.reward_status = _status THEN RAISE EXCEPTION 'o prêmio já está nesta situação'; END IF;
    IF a.reward_status = 'cancelled' AND _status = 'paid' THEN RAISE EXCEPTION 'reabra o prêmio antes de marcar como entregue'; END IF;
  ELSIF v_rev < g.target_amount THEN
    RAISE EXCEPTION 'este seller ainda não bateu a meta';
  END IF;
  IF _status = 'paid' AND v_rev < g.target_amount THEN RAISE EXCEPTION 'este seller não está mais acima da meta (houve estorno?)'; END IF;

  INSERT INTO public.revenue_goal_achievements (goal_id, seller_id, achieved_amount, reward_status, paid_at, notes)
  VALUES (_goal_id, _seller_id, round(v_rev, 2), _status, CASE WHEN _status = 'paid' THEN now() END, v_note)
  ON CONFLICT (goal_id, seller_id) DO UPDATE
    SET achieved_amount = EXCLUDED.achieved_amount, reward_status = EXCLUDED.reward_status, paid_at = EXCLUDED.paid_at, notes = EXCLUDED.notes
  RETURNING id INTO v_id;

  PERFORM app_private.admin_audit(v_admin, 'goal_award_' || _status, 'revenue_goal_award', v_id::text, jsonb_build_object(
    'goal_id', _goal_id, 'goal_title', g.title, 'seller_id', _seller_id, 'seller_name', v_name,
    'status_from', CASE WHEN v_has THEN a.reward_status END, 'status_to', _status, 'amount', round(v_rev, 2), 'note', v_note));
  RETURN jsonb_build_object('id', v_id, 'status', _status);
END
$function$;

-- ───────────────────────── funções chamáveis pelo painel ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_goals()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_goals(); $$;

CREATE OR REPLACE FUNCTION public.get_admin_goal_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_goal_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_save_goal(_id uuid, _title text, _description text, _target numeric, _starts_at timestamptz, _ends_at timestamptz, _reward_title text, _reward_description text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_save_goal(_id, _title, _description, _target, _starts_at, _ends_at, _reward_title, _reward_description); $$;

CREATE OR REPLACE FUNCTION public.admin_set_goal_active(_id uuid, _active boolean)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_goal_active(_id, _active); $$;

CREATE OR REPLACE FUNCTION public.admin_delete_goal(_id uuid, _reason text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_delete_goal(_id, _reason); $$;

CREATE OR REPLACE FUNCTION public.admin_set_goal_award(_goal_id uuid, _seller_id uuid, _status text, _note text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.admin_set_goal_award(_goal_id, _seller_id, _status, _note); $$;

-- ───────────────────────── permissões das funções ─────────────────────────

REVOKE ALL ON FUNCTION app_private.goal_revenue(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.goal_revenue(uuid) TO service_role;

REVOKE ALL ON FUNCTION
  app_private.get_admin_goals(), app_private.get_admin_goal_detail(uuid),
  app_private.admin_save_goal(uuid, text, text, numeric, timestamptz, timestamptz, text, text),
  app_private.admin_set_goal_active(uuid, boolean), app_private.admin_delete_goal(uuid, text),
  app_private.admin_set_goal_award(uuid, uuid, text, text),
  public.get_admin_goals(), public.get_admin_goal_detail(uuid),
  public.admin_save_goal(uuid, text, text, numeric, timestamptz, timestamptz, text, text),
  public.admin_set_goal_active(uuid, boolean), public.admin_delete_goal(uuid, text),
  public.admin_set_goal_award(uuid, uuid, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  app_private.get_admin_goals(), app_private.get_admin_goal_detail(uuid),
  app_private.admin_save_goal(uuid, text, text, numeric, timestamptz, timestamptz, text, text),
  app_private.admin_set_goal_active(uuid, boolean), app_private.admin_delete_goal(uuid, text),
  app_private.admin_set_goal_award(uuid, uuid, text, text),
  public.get_admin_goals(), public.get_admin_goal_detail(uuid),
  public.admin_save_goal(uuid, text, text, numeric, timestamptz, timestamptz, text, text),
  public.admin_set_goal_active(uuid, boolean), public.admin_delete_goal(uuid, text),
  public.admin_set_goal_award(uuid, uuid, text, text)
  TO authenticated, service_role;
