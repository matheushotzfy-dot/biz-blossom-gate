
DROP FUNCTION IF EXISTS public.race_leaderboard(uuid);

CREATE TABLE IF NOT EXISTS public.revenue_race_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES public.revenue_races(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  sales_count BIGINT NOT NULL DEFAULT 0,
  sort_hint INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.revenue_race_overrides TO authenticated, anon;
GRANT ALL ON public.revenue_race_overrides TO service_role;
ALTER TABLE public.revenue_race_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "race_overrides_read_all" ON public.revenue_race_overrides;
CREATE POLICY "race_overrides_read_all" ON public.revenue_race_overrides
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "race_overrides_admin_write" ON public.revenue_race_overrides;
CREATE POLICY "race_overrides_admin_write" ON public.revenue_race_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_race_overrides_race ON public.revenue_race_overrides(race_id);

DROP TRIGGER IF EXISTS trg_race_overrides_updated_at ON public.revenue_race_overrides;
CREATE TRIGGER trg_race_overrides_updated_at
  BEFORE UPDATE ON public.revenue_race_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.race_leaderboard(_race_id UUID)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  seller_avatar TEXT,
  revenue_cents BIGINT,
  sales_count BIGINT,
  rank_position BIGINT,
  is_manual BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (SELECT starts_at, ends_at FROM public.revenue_races WHERE id = _race_id),
  real_agg AS (
    SELECT t.user_id AS seller_id,
      COALESCE(SUM(t.net_amount)::BIGINT, 0) AS revenue_cents,
      COUNT(*)::BIGINT AS sales_count
    FROM public.transactions t, r
    WHERE t.status IN ('completed','approved','paid')
      AND t.created_at >= r.starts_at
      AND t.created_at <= r.ends_at
      AND t.user_id IS NOT NULL
    GROUP BY t.user_id
  ),
  merged AS (
    SELECT
      o.seller_id,
      COALESCE(o.display_name, p.nickname, p.full_name, 'Seller') AS seller_name,
      COALESCE(o.avatar_url, p.avatar_url) AS seller_avatar,
      o.revenue_cents,
      o.sales_count,
      TRUE AS is_manual,
      o.id::text AS sort_key
    FROM public.revenue_race_overrides o
    LEFT JOIN public.profiles p ON p.id = o.seller_id
    WHERE o.race_id = _race_id AND o.seller_id IS NOT NULL
    UNION ALL
    SELECT
      NULL::uuid,
      o.display_name,
      o.avatar_url,
      o.revenue_cents,
      o.sales_count,
      TRUE,
      o.id::text
    FROM public.revenue_race_overrides o
    WHERE o.race_id = _race_id AND o.seller_id IS NULL
    UNION ALL
    SELECT
      a.seller_id,
      COALESCE(p.nickname, p.full_name, 'Seller'),
      p.avatar_url,
      a.revenue_cents,
      a.sales_count,
      FALSE,
      a.seller_id::text
    FROM real_agg a
    LEFT JOIN public.profiles p ON p.id = a.seller_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.revenue_race_overrides o2
      WHERE o2.race_id = _race_id AND o2.seller_id = a.seller_id
    )
  )
  SELECT
    seller_id,
    seller_name,
    seller_avatar,
    revenue_cents,
    sales_count,
    ROW_NUMBER() OVER (ORDER BY revenue_cents DESC, sort_key)::BIGINT AS rank_position,
    is_manual
  FROM merged
  ORDER BY revenue_cents DESC, sort_key
  LIMIT 100;
$$;

-- Seed active race
DO $$
DECLARE
  v_race_id UUID;
BEGIN
  UPDATE public.revenue_races SET is_active = FALSE WHERE is_active = TRUE;

  INSERT INTO public.revenue_races (title, description, starts_at, ends_at, is_active)
  VALUES (
    'Corrida Hotzfy · Temporada Premium',
    'Os 3 primeiros colocados levam prêmios exclusivos. Acelere suas vendas e conquiste o topo do ranking.',
    now() - INTERVAL '3 days',
    now() + INTERVAL '27 days',
    TRUE
  )
  RETURNING id INTO v_race_id;

  INSERT INTO public.revenue_race_prizes (race_id, title, description, min_revenue_cents, target_position, sort_order)
  VALUES
    (v_race_id, 'MacBook Air 15" M3',   '1º Lugar · O notebook mais desejado da Apple para levar sua produtividade a outro nível.', 50000000, 1, 0),
    (v_race_id, 'iPhone 16 Pro Max',    '2º Lugar · O smartphone topo de linha da Apple, com câmera profissional e chip A18 Pro.',  30000000, 2, 1),
    (v_race_id, 'AirPods Pro 2',        '3º Lugar · Áudio imersivo com cancelamento de ruído para você celebrar cada venda.',       15000000, 3, 2);
END $$;
