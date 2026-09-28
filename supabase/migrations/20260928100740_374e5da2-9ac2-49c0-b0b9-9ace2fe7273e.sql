
-- 1) API keys: credentials are immutable from the browser; revocation is permanent; expiry cannot be extended
CREATE OR REPLACE FUNCTION public.guard_api_keys_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.public_key IS DISTINCT FROM OLD.public_key
     OR NEW.secret_key_hash IS DISTINCT FROM OLD.secret_key_hash
     OR NEW.secret_key_prefix IS DISTINCT FROM OLD.secret_key_prefix
     OR NEW.hash_version IS DISTINCT FROM OLD.hash_version
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.last_used_at IS DISTINCT FROM OLD.last_used_at THEN
    RAISE EXCEPTION 'api_key_immutable_fields';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS NULL OR NEW.is_active) THEN
    RAISE EXCEPTION 'api_key_revoked_permanently';
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at
     AND (NEW.expires_at IS NULL OR (OLD.expires_at IS NOT NULL AND NEW.expires_at > OLD.expires_at)) THEN
    RAISE EXCEPTION 'api_key_expiry_cannot_extend';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_api_keys_update ON public.api_keys;
CREATE TRIGGER trg_guard_api_keys_update BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.guard_api_keys_update();

CREATE OR REPLACE FUNCTION public.guard_api_keys_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  NEW.last_used_at := NULL;
  NEW.revoked_at := NULL;
  IF NEW.expires_at IS NULL OR NEW.expires_at > now() + interval '365 days' THEN
    NEW.expires_at := now() + interval '90 days';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_api_keys_insert ON public.api_keys;
CREATE TRIGGER trg_guard_api_keys_insert BEFORE INSERT ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.guard_api_keys_insert();

-- 2) Reward claims: sellers can only open a pending request; status/tracking/admin fields are admin-only
CREATE OR REPLACE FUNCTION public.guard_reward_claims_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.tracking_carrier := NULL; NEW.tracking_code := NULL; NEW.tracking_url := NULL;
    NEW.admin_notes := NULL; NEW.delivered_at := NULL;
    IF EXISTS (SELECT 1 FROM public.reward_claims WHERE user_id = NEW.user_id AND tier_id = NEW.tier_id) THEN
      RAISE EXCEPTION 'reward_already_claimed';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_reward_claims_write ON public.reward_claims;
CREATE TRIGGER trg_guard_reward_claims_write BEFORE INSERT ON public.reward_claims
FOR EACH ROW EXECUTE FUNCTION public.guard_reward_claims_write();

-- 3) Staff commission payout requests: always pending, positive, never above available balance
CREATE OR REPLACE FUNCTION public.guard_commission_payout_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending';
  NEW.processed_by := NULL;
  NEW.processed_at := NULL;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'invalid_payout_amount';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.staff_user_id::text));
  IF NEW.amount + COALESCE((SELECT sum(amount) FROM public.staff_commission_payouts
        WHERE staff_user_id = NEW.staff_user_id AND status = 'pending'), 0)
     > public.get_staff_commission_balance(NEW.staff_user_id) THEN
    RAISE EXCEPTION 'insufficient_commission_balance';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_commission_payout_insert ON public.staff_commission_payouts;
CREATE TRIGGER trg_guard_commission_payout_insert BEFORE INSERT ON public.staff_commission_payouts
FOR EACH ROW EXECUTE FUNCTION public.guard_commission_payout_insert();

REVOKE EXECUTE ON FUNCTION public.guard_api_keys_update(), public.guard_api_keys_insert(),
  public.guard_reward_claims_write(), public.guard_commission_payout_insert() FROM PUBLIC, anon, authenticated;
