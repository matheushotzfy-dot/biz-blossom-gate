
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  document_type TEXT DEFAULT 'cpf',
  document_number TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  checkout_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'pix',
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Bank accounts
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  agency TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'corrente',
  holder_name TEXT NOT NULL,
  holder_document TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Withdrawals
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Fees
CREATE TABLE public.fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  fee_type TEXT NOT NULL DEFAULT 'percentage',
  value NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- products
CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all products" ON public.products FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bank_accounts
CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all bank accounts" ON public.bank_accounts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own bank accounts" ON public.bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts FOR DELETE USING (auth.uid() = user_id);

-- withdrawals
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all withdrawals" ON public.withdrawals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- fees
CREATE POLICY "Anyone can view fees" ON public.fees FOR SELECT USING (true);
CREATE POLICY "Admins can manage fees" ON public.fees FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default fees
INSERT INTO public.fees (name, description, fee_type, value) VALUES
  ('Taxa PIX', 'Taxa por transação PIX', 'percentage', 1.99),
  ('Taxa Cartão', 'Taxa por transação com cartão', 'percentage', 4.99),
  ('Taxa Boleto', 'Taxa por boleto gerado', 'fixed', 3.49),
  ('Taxa de Saque', 'Taxa por saque realizado', 'fixed', 2.00);
