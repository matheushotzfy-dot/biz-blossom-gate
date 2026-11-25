-- Admin > Auditoria financeira > Histórico: paginação estável e contagem por tipo de ação.
--
-- Antes a ordem era só por data (linhas com o mesmo instante podiam repetir ou sumir entre páginas) e a tela
-- não tinha como mostrar quantas ações de cada tipo existiam no período. Agora a ordem desempata por id e a
-- resposta traz `summary` com a contagem por grupo, respeitando seller e período mas não o filtro de ação.
CREATE OR REPLACE FUNCTION app_private.get_financial_action_history(
  _seller uuid DEFAULT NULL::uuid,
  _from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _action text DEFAULT NULL::text,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _rows jsonb; _total bigint; _summary jsonb;
BEGIN
  WITH scope AS (
    SELECT l.* FROM public.financial_action_log l
    WHERE (_seller IS NULL OR l.seller_user_id = _seller)
      AND (_from IS NULL OR l.created_at >= _from)
      AND (_to IS NULL OR l.created_at < _to)
  )
  SELECT jsonb_build_object(
    'total',      count(*),
    'ajuste',     count(*) FILTER (WHERE action LIKE 'ajuste%'),
    'reembolso',  count(*) FILTER (WHERE action LIKE 'reembolso%'),
    'chargeback', count(*) FILTER (WHERE action LIKE 'chargeback%'),
    'disputa',    count(*) FILTER (WHERE action LIKE 'disputa%')
  ) INTO _summary FROM scope;

  SELECT count(*) INTO _total FROM public.financial_action_log l
   WHERE (_seller IS NULL OR l.seller_user_id = _seller) AND (_from IS NULL OR l.created_at >= _from) AND (_to IS NULL OR l.created_at < _to)
     AND (_action IS NULL OR l.action LIKE _action || '%');

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC, r.id), '[]'::jsonb) INTO _rows FROM (
    SELECT l.*, sp.full_name AS seller_name, sp.email AS seller_email, ap.full_name AS actor_name, ap.email AS actor_email
    FROM public.financial_action_log l
    LEFT JOIN public.profiles sp ON sp.user_id = l.seller_user_id
    LEFT JOIN public.profiles ap ON ap.user_id = l.actor_id
    WHERE (_seller IS NULL OR l.seller_user_id = _seller) AND (_from IS NULL OR l.created_at >= _from) AND (_to IS NULL OR l.created_at < _to)
      AND (_action IS NULL OR l.action LIKE _action || '%')
    ORDER BY l.created_at DESC, l.id
    LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(_offset, 0), 0)
  ) r;

  RETURN jsonb_build_object('total', _total, 'rows', _rows, 'summary', _summary);
END $function$;
