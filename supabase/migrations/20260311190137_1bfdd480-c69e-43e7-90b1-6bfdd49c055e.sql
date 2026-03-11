
-- Add affiliate/co-production columns to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS affiliate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_commission numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS co_production_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS co_producer_email text,
  ADD COLUMN IF NOT EXISTS co_production_split numeric NOT NULL DEFAULT 50;

-- Affiliate links table
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  affiliate_user_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  commission_pct numeric NOT NULL DEFAULT 30,
  clicks integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own links" ON public.affiliate_links
  FOR SELECT TO authenticated USING (affiliate_user_id = auth.uid());
CREATE POLICY "Product owners view affiliate links" ON public.affiliate_links
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Affiliates insert own links" ON public.affiliate_links
  FOR INSERT TO authenticated WITH CHECK (affiliate_user_id = auth.uid());
CREATE POLICY "Affiliates update own links" ON public.affiliate_links
  FOR UPDATE TO authenticated USING (affiliate_user_id = auth.uid());
CREATE POLICY "Product owners manage affiliate links" ON public.affiliate_links
  FOR ALL TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Admins manage all affiliate links" ON public.affiliate_links
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny_anon_all_affiliate_links" ON public.affiliate_links
  FOR ALL TO anon USING (false) WITH CHECK (false);
-- Public read for checkout slug resolution
CREATE POLICY "Public read active affiliate links" ON public.affiliate_links
  FOR SELECT TO anon USING (is_active = true);

-- Affiliate sales tracking
CREATE TABLE IF NOT EXISTS public.affiliate_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id uuid REFERENCES public.affiliate_links(id) NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) NOT NULL,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  affiliate_user_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  sale_amount numeric NOT NULL,
  commission_amount numeric NOT NULL,
  commission_pct numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own sales" ON public.affiliate_sales
  FOR SELECT TO authenticated USING (affiliate_user_id = auth.uid());
CREATE POLICY "Sellers view affiliate sales" ON public.affiliate_sales
  FOR SELECT TO authenticated USING (seller_user_id = auth.uid());
CREATE POLICY "Admins manage all affiliate sales" ON public.affiliate_sales
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny_anon_all_affiliate_sales" ON public.affiliate_sales
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Co-production invites/agreements
CREATE TABLE IF NOT EXISTS public.co_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  owner_user_id uuid NOT NULL,
  co_producer_user_id uuid,
  co_producer_email text NOT NULL,
  split_percentage numeric NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.co_productions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage co-productions" ON public.co_productions
  FOR ALL TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Co-producers view own invites" ON public.co_productions
  FOR SELECT TO authenticated USING (
    co_producer_user_id = auth.uid() OR 
    co_producer_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Co-producers update own status" ON public.co_productions
  FOR UPDATE TO authenticated USING (
    co_producer_user_id = auth.uid() OR 
    co_producer_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Admins manage all co-productions" ON public.co_productions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny_anon_all_co_productions" ON public.co_productions
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Enable realtime for affiliate_sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_sales;
