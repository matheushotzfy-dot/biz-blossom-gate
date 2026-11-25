-- APLICADA em 2026-11-25 (aprovada por Lucker, via Lovable query_database): corrige as unidades do ranking da Corrida de faturamento.
--
-- Problema: transactions.net_amount é numeric(10,2) em REAIS, mas app_private.race_leaderboard soma
-- net_amount e devolve o resultado como "revenue_cents" (bigint) sem multiplicar por 100.
-- As linhas manuais (revenue_race_overrides.revenue_cents) e os prêmios (min_revenue_cents) estão em
-- CENTAVOS de verdade. Resultado com vendas reais: o vendedor aparece 100x menor, fica fora das metas
-- e abaixo das linhas manuais; o arredondamento dos outros participantes também sai errado
-- (arredonda em R$ 100.000 em vez de R$ 1.000, porque o cálculo está em reais).
--
-- Também faz o ranking ignorar vendas simuladas (is_simulated), como o resto do painel já faz
-- (Premiações, saldo etc.): hoje uma venda de teste contaria como faturamento real na corrida.
--
-- Não muda assinatura, permissões nem o formato do retorno. Hoje não há nenhuma venda no período da
-- corrida, então o efeito prático é só preparar o terreno antes das primeiras vendas reais.

CREATE OR REPLACE FUNCTION app_private.race_leaderboard(_race_id uuid)
 RETURNS TABLE(seller_id uuid, seller_name text, seller_avatar text, revenue_cents bigint, sales_count bigint, rank_position bigint, is_manual boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH race AS (
    SELECT starts_at, ends_at
    FROM public.revenue_races
    WHERE id = _race_id
      AND (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role))
  ),
  real_agg AS (
    SELECT t.user_id AS seller_id,
      -- net_amount está em reais (numeric 10,2): converte para centavos
      COALESCE(ROUND(SUM(t.net_amount) * 100)::bigint, 0) AS exact_revenue_cents,
      COUNT(*)::bigint AS exact_sales_count
    FROM public.transactions t, race
    WHERE t.status IN ('completed', 'approved', 'paid')
      AND t.is_simulated = false
      AND t.created_at >= race.starts_at
      AND t.created_at <= race.ends_at
      AND t.user_id IS NOT NULL
    GROUP BY t.user_id
  ),
  merged AS (
    SELECT o.seller_id,
      COALESCE(o.display_name, p.nickname, p.full_name, 'Seller') AS seller_name,
      COALESCE(o.avatar_url, p.avatar_url) AS seller_avatar,
      o.revenue_cents AS exact_revenue_cents,
      o.sales_count AS exact_sales_count,
      true AS is_manual,
      o.id::text AS sort_key
    FROM public.revenue_race_overrides o
    LEFT JOIN public.profiles p ON p.user_id = o.seller_id
    WHERE o.race_id = _race_id AND o.seller_id IS NOT NULL AND EXISTS (SELECT 1 FROM race)
    UNION ALL
    SELECT NULL::uuid, o.display_name, o.avatar_url, o.revenue_cents, o.sales_count, true, o.id::text
    FROM public.revenue_race_overrides o
    WHERE o.race_id = _race_id AND o.seller_id IS NULL AND EXISTS (SELECT 1 FROM race)
    UNION ALL
    SELECT a.seller_id,
      COALESCE(p.nickname, p.full_name, 'Seller'),
      p.avatar_url,
      a.exact_revenue_cents,
      a.exact_sales_count,
      false,
      a.seller_id::text
    FROM real_agg a
    LEFT JOIN public.profiles p ON p.user_id = a.seller_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.revenue_race_overrides o2
      WHERE o2.race_id = _race_id AND o2.seller_id = a.seller_id
    )
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY exact_revenue_cents DESC, sort_key)::bigint AS position
    FROM merged
  )
  SELECT
    CASE
      WHEN seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN seller_id
      ELSE NULL::uuid
    END AS seller_id,
    seller_name,
    seller_avatar,
    CASE
      WHEN seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN exact_revenue_cents
      ELSE (exact_revenue_cents / 100000) * 100000   -- outros: arredondado para baixo em R$ 1.000 (em centavos)
    END AS revenue_cents,
    CASE
      WHEN seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN exact_sales_count
      ELSE 0::bigint
    END AS sales_count,
    position AS rank_position,
    is_manual
  FROM ranked
  ORDER BY position
  LIMIT 100;
$function$;
