
-- ═══════════════════════════════════════════════════════════════
-- 1) REALTIME: suporte funcional em tempo real
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- ═══════════════════════════════════════════════════════════════
-- 2) PAYMENT LINKS — cobrança avulsa (Mercado Pago style)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  image_url TEXT,
  accept_pix BOOLEAN NOT NULL DEFAULT true,
  accept_card BOOLEAN NOT NULL DEFAULT false,
  accept_boleto BOOLEAN NOT NULL DEFAULT false,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_user ON public.payment_links(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_slug ON public.payment_links(slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT SELECT ON public.payment_links TO anon;
GRANT ALL ON public.payment_links TO service_role;

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manages_payment_links" ON public.payment_links;
CREATE POLICY "owner_manages_payment_links" ON public.payment_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public_reads_active_payment_link" ON public.payment_links;
CREATE POLICY "public_reads_active_payment_link" ON public.payment_links
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "admin_reads_payment_links" ON public.payment_links;
CREATE POLICY "admin_reads_payment_links" ON public.payment_links
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- add reference on transactions (nullable)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_link ON public.transactions(payment_link_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_pl() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_payment_links_updated ON public.payment_links;
CREATE TRIGGER trg_payment_links_updated BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pl();

-- ═══════════════════════════════════════════════════════════════
-- 3) REVENUE GOALS — metas de faturamento por período (admin)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.revenue_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  period_type TEXT NOT NULL DEFAULT 'custom' CHECK (period_type IN ('week','month','custom')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reward_title TEXT NOT NULL,
  reward_description TEXT,
  reward_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_goals_active ON public.revenue_goals(is_active, ends_at);

GRANT SELECT ON public.revenue_goals TO authenticated;
GRANT ALL ON public.revenue_goals TO service_role;

ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_reads_active_goals" ON public.revenue_goals;
CREATE POLICY "auth_reads_active_goals" ON public.revenue_goals
  FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin_manages_goals" ON public.revenue_goals;
CREATE POLICY "admin_manages_goals" ON public.revenue_goals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- achievements
CREATE TABLE IF NOT EXISTS public.revenue_goal_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.revenue_goals(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achieved_amount NUMERIC(14,2) NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending','paid','cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE (goal_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_ach_seller ON public.revenue_goal_achievements(seller_id);
CREATE INDEX IF NOT EXISTS idx_goal_ach_goal ON public.revenue_goal_achievements(goal_id);

GRANT SELECT ON public.revenue_goal_achievements TO authenticated;
GRANT ALL ON public.revenue_goal_achievements TO service_role;

ALTER TABLE public.revenue_goal_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_reads_own_ach" ON public.revenue_goal_achievements;
CREATE POLICY "seller_reads_own_ach" ON public.revenue_goal_achievements
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin_manages_ach" ON public.revenue_goal_achievements;
CREATE POLICY "admin_manages_ach" ON public.revenue_goal_achievements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC: leaderboard/progress of a specific goal per seller
CREATE OR REPLACE FUNCTION public.get_goal_progress(_goal_id UUID)
RETURNS TABLE(seller_id UUID, seller_name TEXT, revenue NUMERIC, achieved BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g record;
BEGIN
  SELECT * INTO g FROM public.revenue_goals WHERE id = _goal_id;
  IF g IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.user_id AS seller_id,
    COALESCE(p.full_name, p.nickname, split_part(p.email,'@',1), 'Vendedor') AS seller_name,
    COALESCE(SUM(t.amount), 0)::NUMERIC AS revenue,
    COALESCE(SUM(t.amount), 0) >= g.target_amount AS achieved
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.status IN ('approved','completed','paid')
    AND t.created_at >= g.starts_at
    AND t.created_at <= g.ends_at
  GROUP BY t.user_id, p.full_name, p.nickname, p.email
  ORDER BY revenue DESC
  LIMIT 200;
END $$;

GRANT EXECUTE ON FUNCTION public.get_goal_progress(UUID) TO authenticated, service_role;

-- Own progress for a seller against a goal
CREATE OR REPLACE FUNCTION public.get_my_goal_progress(_goal_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(t.amount), 0)::NUMERIC
  FROM public.transactions t, public.revenue_goals g
  WHERE g.id = _goal_id
    AND t.user_id = auth.uid()
    AND t.status IN ('approved','completed','paid')
    AND t.created_at >= g.starts_at
    AND t.created_at <= g.ends_at
$$;

GRANT EXECUTE ON FUNCTION public.get_my_goal_progress(UUID) TO authenticated, service_role;
