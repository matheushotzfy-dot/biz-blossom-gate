
-- Manager ↔ Seller assignments
CREATE TABLE public.manager_seller_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(manager_user_id, seller_user_id)
);

ALTER TABLE public.manager_seller_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers see own assignments" ON public.manager_seller_assignments
  FOR SELECT TO authenticated
  USING (manager_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage assignments" ON public.manager_seller_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_all_manager_assignments" ON public.manager_seller_assignments
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Manager fee limits
CREATE TABLE public.manager_fee_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_transaction_percentage numeric NOT NULL DEFAULT 2.00,
  min_transaction_fixed numeric NOT NULL DEFAULT 1.00,
  min_withdrawal_fee numeric NOT NULL DEFAULT 3.00,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_fee_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fee limits" ON public.manager_fee_limits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers read fee limits" ON public.manager_fee_limits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "deny_anon_all_fee_limits" ON public.manager_fee_limits
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Seller notes
CREATE TABLE public.seller_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  author_role text NOT NULL DEFAULT 'admin',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seller notes" ON public.seller_notes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers read assigned seller notes" ON public.seller_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments 
      WHERE manager_user_id = auth.uid() AND seller_user_id = seller_notes.seller_user_id
    )
  );

CREATE POLICY "Managers insert notes for assigned sellers" ON public.seller_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role)
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments 
      WHERE manager_user_id = auth.uid() AND seller_user_id = seller_notes.seller_user_id
    )
  );

CREATE POLICY "deny_anon_all_seller_notes" ON public.seller_notes
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Managers update custom_user_fees for assigned sellers
CREATE POLICY "Managers manage fees for assigned sellers" ON public.custom_user_fees
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = custom_user_fees.user_id
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = custom_user_fees.user_id
    )
  );

-- Managers view assigned seller profiles
CREATE POLICY "Managers view assigned seller profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = profiles.user_id
    )
  );

-- Managers update assigned seller profiles (KYC)
CREATE POLICY "Managers update assigned seller profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = profiles.user_id
    )
  );

-- Managers view assigned seller transactions
CREATE POLICY "Managers view assigned seller transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = transactions.user_id
    )
  );

-- Insert default fee limits
INSERT INTO public.manager_fee_limits (min_transaction_percentage, min_transaction_fixed, min_withdrawal_fee)
VALUES (2.00, 1.00, 3.00);
