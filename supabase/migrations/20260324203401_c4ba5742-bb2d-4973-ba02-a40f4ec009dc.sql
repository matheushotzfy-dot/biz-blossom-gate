
-- C-03 FIX: Validate custom_user_fees ranges
CREATE OR REPLACE FUNCTION public.validate_custom_fees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transaction_percentage IS NOT NULL AND (NEW.transaction_percentage < 0 OR NEW.transaction_percentage > 50) THEN
    RAISE EXCEPTION 'Taxa percentual deve ser entre 0%% e 50%%';
  END IF;
  IF NEW.transaction_fixed IS NOT NULL AND (NEW.transaction_fixed < 0 OR NEW.transaction_fixed > 100) THEN
    RAISE EXCEPTION 'Taxa fixa deve ser entre R$ 0 e R$ 100';
  END IF;
  IF NEW.withdrawal_fee IS NOT NULL AND (NEW.withdrawal_fee < 0 OR NEW.withdrawal_fee > 500) THEN
    RAISE EXCEPTION 'Taxa de saque deve ser entre R$ 0 e R$ 500';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_custom_fees
  BEFORE INSERT OR UPDATE ON public.custom_user_fees
  FOR EACH ROW EXECUTE FUNCTION public.validate_custom_fees();

-- C-05 FIX: Prevent non-admin from inserting admin role via user_roles
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only service_role (auth.uid() IS NULL) can assign 'admin' role
  -- For authenticated users, only existing admins can assign roles
  IF auth.uid() IS NOT NULL THEN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can manage roles';
    END IF;
    -- Even admins cannot self-assign or create new admins via UI
    -- Admin role assignment should only happen via service_role / migration
    IF NEW.role = 'admin'::app_role THEN
      RAISE EXCEPTION 'Admin role can only be assigned by system administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_role_assignment
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.validate_role_assignment();

-- C-04 PARTIAL FIX: Add constraint to prevent extreme debit values
-- (Full fix would require checking balance, but that's complex in a trigger)
-- At minimum, ensure type is valid and reason is meaningful
CREATE OR REPLACE FUNCTION public.validate_balance_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF NEW.amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum'; END IF;
  IF NEW.type NOT IN ('credit', 'debit') THEN RAISE EXCEPTION 'Invalid type'; END IF;
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 3 THEN RAISE EXCEPTION 'Reason required (min 3 chars)'; END IF;
  IF length(NEW.reason) > 1000 THEN RAISE EXCEPTION 'Reason too long (max 1000 chars)'; END IF;
  RETURN NEW;
END;
$$;

-- Sanitize notification content server-side (C-01)
CREATE OR REPLACE FUNCTION public.sanitize_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Strip HTML tags and dangerous patterns
  NEW.title := regexp_replace(NEW.title, '<[^>]*>', '', 'g');
  NEW.title := regexp_replace(NEW.title, 'javascript:', '', 'gi');
  NEW.title := left(trim(NEW.title), 200);
  
  NEW.message := regexp_replace(NEW.message, '<[^>]*>', '', 'g');
  NEW.message := regexp_replace(NEW.message, 'javascript:', '', 'gi');
  NEW.message := left(trim(NEW.message), 2000);
  
  IF length(trim(NEW.title)) < 1 THEN RAISE EXCEPTION 'Title cannot be empty'; END IF;
  IF length(trim(NEW.message)) < 1 THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sanitize_notification
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_notification();

-- Sanitize dispute inputs server-side (C-02)
CREATE OR REPLACE FUNCTION public.sanitize_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.buyer_name IS NOT NULL THEN
    NEW.buyer_name := regexp_replace(NEW.buyer_name, '<[^>]*>', '', 'g');
    NEW.buyer_name := left(trim(NEW.buyer_name), 200);
  END IF;
  IF NEW.buyer_email IS NOT NULL THEN
    NEW.buyer_email := lower(trim(NEW.buyer_email));
    IF NEW.buyer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Invalid buyer email format';
    END IF;
  END IF;
  IF NEW.buyer_phone IS NOT NULL THEN
    NEW.buyer_phone := regexp_replace(NEW.buyer_phone, '[^0-9+() -]', '', 'g');
    NEW.buyer_phone := left(trim(NEW.buyer_phone), 20);
  END IF;
  IF NEW.reason IS NOT NULL THEN
    NEW.reason := regexp_replace(NEW.reason, '<[^>]*>', '', 'g');
    NEW.reason := left(trim(NEW.reason), 1000);
  END IF;
  IF NEW.admin_notes IS NOT NULL THEN
    NEW.admin_notes := regexp_replace(NEW.admin_notes, '<[^>]*>', '', 'g');
    NEW.admin_notes := left(trim(NEW.admin_notes), 5000);
  END IF;
  IF NEW.amount < 0 THEN RAISE EXCEPTION 'Dispute amount cannot be negative'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sanitize_dispute
  BEFORE INSERT OR UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_dispute();

-- Sanitize seller_notes content server-side (A-02)
CREATE OR REPLACE FUNCTION public.sanitize_seller_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.content := regexp_replace(NEW.content, '<[^>]*>', '', 'g');
  NEW.content := regexp_replace(NEW.content, 'javascript:', '', 'gi');
  NEW.content := left(trim(NEW.content), 5000);
  IF length(trim(NEW.content)) < 1 THEN RAISE EXCEPTION 'Note content cannot be empty'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sanitize_seller_note
  BEFORE INSERT OR UPDATE ON public.seller_notes
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_seller_note();
