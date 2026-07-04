
-- ============================================================
-- 1) affiliate_links: prevent affiliate self-raising commission
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_affiliate_links_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT p.user_id INTO v_owner FROM public.products p WHERE p.id = NEW.product_id;

  -- If caller is not the product owner and not admin, lock down financial/config fields
  IF auth.uid() IS DISTINCT FROM v_owner AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.commission_pct := OLD.commission_pct;
    NEW.product_id := OLD.product_id;
    NEW.affiliate_user_id := OLD.affiliate_user_id;
    NEW.slug := OLD.slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_affiliate_links_update ON public.affiliate_links;
CREATE TRIGGER trg_protect_affiliate_links_update
  BEFORE UPDATE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.protect_affiliate_links_update();

DROP POLICY IF EXISTS "Affiliates update own links" ON public.affiliate_links;
CREATE POLICY "Affiliates update own links"
  ON public.affiliate_links
  FOR UPDATE
  USING (affiliate_user_id = auth.uid())
  WITH CHECK (affiliate_user_id = auth.uid());

-- ============================================================
-- 2) co_productions: co-producer can only change status
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_co_productions_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT p.user_id INTO v_owner FROM public.products p WHERE p.id = NEW.product_id;

  IF auth.uid() IS DISTINCT FROM v_owner AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    -- Preserve every field except status
    NEW.split_percentage := OLD.split_percentage;
    NEW.product_id := OLD.product_id;
    NEW.co_producer_user_id := OLD.co_producer_user_id;
    NEW.co_producer_email := OLD.co_producer_email;
    -- keep NEW.status as-is (co-producer allowed to accept/decline)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_co_productions_update ON public.co_productions;
CREATE TRIGGER trg_protect_co_productions_update
  BEFORE UPDATE ON public.co_productions
  FOR EACH ROW EXECUTE FUNCTION public.protect_co_productions_update();

DROP POLICY IF EXISTS "Co-producers update own status" ON public.co_productions;
CREATE POLICY "Co-producers update own status"
  ON public.co_productions
  FOR UPDATE
  USING (
    (co_producer_user_id = auth.uid())
    OR (co_producer_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  )
  WITH CHECK (
    (co_producer_user_id = auth.uid())
    OR (co_producer_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  );

-- ============================================================
-- 3) profiles: lock privileged columns from self/manager updates
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admins: preserve all privileged/admin-controlled fields
  NEW.account_status := OLD.account_status;
  NEW.staff_role_type := OLD.staff_role_type;
  NEW.balance_frozen := OLD.balance_frozen;
  NEW.frozen := OLD.frozen;
  NEW.approved_by := OLD.approved_by;
  NEW.credit_card_enabled := OLD.credit_card_enabled;
  NEW.boleto_enabled := OLD.boleto_enabled;
  NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  NEW.admin_notes := CASE
    WHEN public.has_role(auth.uid(), 'manager'::app_role) THEN NEW.admin_notes
    ELSE OLD.admin_notes
  END;
  NEW.user_id := OLD.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profiles_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_privileged_columns();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers update assigned seller profiles" ON public.profiles;
CREATE POLICY "Managers update assigned seller profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = profiles.user_id
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.manager_seller_assignments
      WHERE manager_user_id = auth.uid() AND seller_user_id = profiles.user_id
    )
  );

-- ============================================================
-- 4) quiz_questions: hide correct answers from students
--    Students already fetch through get_quiz_questions_for_student RPC.
-- ============================================================
DROP POLICY IF EXISTS "Enrolled students view quiz_questions" ON public.quiz_questions;
