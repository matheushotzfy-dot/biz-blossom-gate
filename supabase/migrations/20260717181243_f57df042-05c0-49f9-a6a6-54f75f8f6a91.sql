
CREATE TABLE public.revenue_races (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  banner_url TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.revenue_race_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id UUID NOT NULL REFERENCES public.revenue_races(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  min_revenue_cents BIGINT NOT NULL DEFAULT 0,
  target_position INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_race_prizes_race ON public.revenue_race_prizes(race_id);
CREATE INDEX idx_races_active ON public.revenue_races(is_active, starts_at, ends_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_races TO authenticated;
GRANT ALL ON public.revenue_races TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_race_prizes TO authenticated;
GRANT ALL ON public.revenue_race_prizes TO service_role;

ALTER TABLE public.revenue_races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_race_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_races_read_all" ON public.revenue_races
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "revenue_race_prizes_read_all" ON public.revenue_race_prizes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "revenue_races_admin_insert" ON public.revenue_races
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "revenue_races_admin_update" ON public.revenue_races
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "revenue_races_admin_delete" ON public.revenue_races
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "revenue_race_prizes_admin_insert" ON public.revenue_race_prizes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "revenue_race_prizes_admin_update" ON public.revenue_race_prizes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "revenue_race_prizes_admin_delete" ON public.revenue_race_prizes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_revenue_races_updated_at BEFORE UPDATE ON public.revenue_races
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_revenue_race_prizes_updated_at BEFORE UPDATE ON public.revenue_race_prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.race_leaderboard(_race_id UUID)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  seller_avatar TEXT,
  revenue_cents BIGINT,
  sales_count BIGINT,
  rank_position BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (SELECT starts_at, ends_at FROM public.revenue_races WHERE id = _race_id),
  agg AS (
    SELECT t.user_id AS seller_id,
      COALESCE(SUM(t.net_amount)::BIGINT, 0) AS revenue_cents,
      COUNT(*)::BIGINT AS sales_count
    FROM public.transactions t, r
    WHERE t.status IN ('completed','approved','paid')
      AND t.created_at >= r.starts_at
      AND t.created_at <= r.ends_at
      AND t.user_id IS NOT NULL
    GROUP BY t.user_id
  )
  SELECT
    a.seller_id,
    COALESCE(p.nickname, p.full_name, 'Seller') AS seller_name,
    p.avatar_url AS seller_avatar,
    a.revenue_cents,
    a.sales_count,
    ROW_NUMBER() OVER (ORDER BY a.revenue_cents DESC)::BIGINT AS rank_position
  FROM agg a
  LEFT JOIN public.profiles p ON p.id = a.seller_id
  ORDER BY a.revenue_cents DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.race_leaderboard(UUID) TO authenticated;

CREATE POLICY "race_assets_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'race-assets');
CREATE POLICY "race_assets_admin_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'race-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "race_assets_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'race-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "race_assets_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'race-assets' AND public.has_role(auth.uid(), 'admin'));
