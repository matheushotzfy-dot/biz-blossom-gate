
-- Referrals table for the referral program
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid DEFAULT NULL,
  referred_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_amount numeric NOT NULL DEFAULT 50.00,
  paid_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view own referrals
CREATE POLICY "Users view own referrals"
ON public.referrals FOR SELECT
TO authenticated
USING (referrer_user_id = auth.uid());

-- Users can create referrals
CREATE POLICY "Users create own referrals"
ON public.referrals FOR INSERT
TO authenticated
WITH CHECK (referrer_user_id = auth.uid());

-- Admins manage all referrals
CREATE POLICY "Admins manage referrals"
ON public.referrals FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Block anonymous access
CREATE POLICY "deny_anon_all_referrals"
ON public.referrals FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Trigger for updated_at
CREATE TRIGGER update_referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
