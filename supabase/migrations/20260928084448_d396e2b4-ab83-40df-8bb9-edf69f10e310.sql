ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS min_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS max_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS suggested_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS allow_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_quantity integer,
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS redirect_url text,
  ADD COLUMN IF NOT EXISTS pix_expiration_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS recurrence_interval text,
  ADD COLUMN IF NOT EXISTS recurrence_interval_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_cycles integer,
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT 'anytime',
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS admin_block_reason text,
  ADD COLUMN IF NOT EXISTS admin_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_blocked_by uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checkout_starts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_billing_type_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_billing_type_check CHECK (billing_type IN ('single','recurring_card','recurring_pix'));
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_pricing_type_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_pricing_type_check CHECK (pricing_type IN ('fixed','customer_choice','fixed_options'));
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_amount_rules_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_amount_rules_check CHECK (
  amount > 0 AND
  (min_amount IS NULL OR min_amount > 0) AND
  (max_amount IS NULL OR max_amount > 0) AND
  (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount) AND
  (suggested_amount IS NULL OR suggested_amount > 0)
);
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_quantity_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_quantity_check CHECK (max_quantity IS NULL OR max_quantity BETWEEN 1 AND 1000);
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_recurrence_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_recurrence_check CHECK (
  (billing_type = 'single' AND recurrence_interval IS NULL) OR
  (billing_type <> 'single' AND recurrence_interval IN ('weekly','monthly','quarterly','semiannual','yearly'))
);
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_cycles_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_cycles_check CHECK (recurrence_cycles IS NULL OR recurrence_cycles BETWEEN 1 AND 120);
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_trial_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_trial_check CHECK (trial_days BETWEEN 0 AND 365);
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_admin_status_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_admin_status_check CHECK (admin_status IN ('clear','blocked','review'));
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_pix_expiration_check;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_pix_expiration_check CHECK (pix_expiration_minutes BETWEEN 5 AND 1440);

CREATE UNIQUE INDEX IF NOT EXISTS payment_links_slug_lower_key ON public.payment_links (lower(slug)) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_links_owner_status ON public.payment_links(user_id, archived_at, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_links_admin_status ON public.payment_links(admin_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_links_plan ON public.payment_links(subscription_plan_id) WHERE subscription_plan_id IS NOT NULL;

CREATE TABLE public.payment_link_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 240),
  amount_delta numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_delta >= 0),
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_options TO authenticated;
GRANT ALL ON public.payment_link_options TO service_role;
ALTER TABLE public.payment_link_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_link_options_owner_select ON public.payment_link_options FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY payment_link_options_owner_insert ON public.payment_link_options FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.payment_links p WHERE p.id = payment_link_id AND p.user_id = auth.uid()));
CREATE POLICY payment_link_options_owner_update ON public.payment_link_options FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.payment_links p WHERE p.id = payment_link_id AND p.user_id = auth.uid()));
CREATE POLICY payment_link_options_owner_delete ON public.payment_link_options FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_payment_link_options_link ON public.payment_link_options(payment_link_id, position) WHERE is_active;
CREATE TRIGGER payment_link_options_updated_at BEFORE UPDATE ON public.payment_link_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_link_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL,
  public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  idempotency_key uuid NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_document_hash text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 1000),
  selected_option_ids uuid[] NOT NULL DEFAULT '{}',
  payment_method text NOT NULL CHECK (payment_method IN ('pix','credit_card','boleto')),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','processing','pending','paid','failed','expired','canceled')),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_link_id, idempotency_key)
);
GRANT SELECT ON public.payment_link_intents TO authenticated;
GRANT ALL ON public.payment_link_intents TO service_role;
ALTER TABLE public.payment_link_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_link_intents_owner_select ON public.payment_link_intents FOR SELECT TO authenticated USING (seller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_payment_link_intents_seller ON public.payment_link_intents(seller_user_id, created_at DESC);
CREATE INDEX idx_payment_link_intents_link ON public.payment_link_intents(payment_link_id, created_at DESC);
CREATE INDEX idx_payment_link_intents_status ON public.payment_link_intents(status, expires_at);
CREATE TRIGGER payment_link_intents_updated_at BEFORE UPDATE ON public.payment_link_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL,
  intent_id uuid REFERENCES public.payment_link_intents(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 2 AND 64),
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('seller','admin','buyer','system','webhook')),
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_link_events TO authenticated;
GRANT ALL ON public.payment_link_events TO service_role;
ALTER TABLE public.payment_link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_link_events_owner_select ON public.payment_link_events FOR SELECT TO authenticated USING (seller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_payment_link_events_link ON public.payment_link_events(payment_link_id, created_at DESC);
CREATE INDEX idx_payment_link_events_tx ON public.payment_link_events(transaction_id) WHERE transaction_id IS NOT NULL;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS subscriber_document_hash text,
  ADD COLUMN IF NOT EXISTS billing_method text NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_token text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_cycles integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_cycles integer,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_charge_at timestamptz;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_method_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_billing_method_check CHECK (billing_method IN ('pix','credit_card'));
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_link ON public.subscriptions(payment_link_id, status, next_charge_at);

CREATE TABLE public.subscription_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL,
  cycle_number integer NOT NULL CHECK (cycle_number > 0),
  due_at timestamptz NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','pending','paid','failed','overdue','canceled')),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  last_attempt_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, cycle_number)
);
GRANT SELECT ON public.subscription_cycles TO authenticated;
GRANT ALL ON public.subscription_cycles TO service_role;
ALTER TABLE public.subscription_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_cycles_owner_select ON public.subscription_cycles FOR SELECT TO authenticated USING (seller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_subscription_cycles_due ON public.subscription_cycles(status, due_at);
CREATE INDEX idx_subscription_cycles_seller ON public.subscription_cycles(seller_user_id, created_at DESC);
CREATE TRIGGER subscription_cycles_updated_at BEFORE UPDATE ON public.subscription_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_link_intent_id uuid REFERENCES public.payment_link_intents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_cycle_id uuid REFERENCES public.subscription_cycles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment_link_intent_unique ON public.transactions(payment_link_intent_id) WHERE payment_link_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_subscription ON public.transactions(subscription_id, created_at DESC) WHERE subscription_id IS NOT NULL;

DROP POLICY IF EXISTS owner_manages_payment_links ON public.payment_links;
DROP POLICY IF EXISTS owner_reads_payment_links ON public.payment_links;
CREATE POLICY payment_links_owner_select ON public.payment_links FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY payment_links_owner_insert ON public.payment_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY payment_links_owner_update ON public.payment_links FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY payment_links_owner_delete_empty ON public.payment_links FOR DELETE TO authenticated USING (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.payment_link_id = payment_links.id));

CREATE OR REPLACE FUNCTION public.guard_payment_link_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.clicks IS DISTINCT FROM OLD.clicks
      OR NEW.checkout_starts IS DISTINCT FROM OLD.checkout_starts
      OR NEW.payment_attempts IS DISTINCT FROM OLD.payment_attempts
      OR NEW.failed_attempts IS DISTINCT FROM OLD.failed_attempts
      OR NEW.current_uses IS DISTINCT FROM OLD.current_uses
      OR NEW.total_revenue IS DISTINCT FROM OLD.total_revenue
      OR NEW.admin_status IS DISTINCT FROM OLD.admin_status
      OR NEW.admin_block_reason IS DISTINCT FROM OLD.admin_block_reason
      OR NEW.admin_blocked_at IS DISTINCT FROM OLD.admin_blocked_at
      OR NEW.admin_blocked_by IS DISTINCT FROM OLD.admin_blocked_by THEN
      RAISE EXCEPTION 'protected payment link fields cannot be changed';
    END IF;
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_payment_link_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_payment_link_update() TO service_role;
DROP TRIGGER IF EXISTS trg_payment_links_updated ON public.payment_links;
DROP TRIGGER IF EXISTS guard_payment_link_update_tg ON public.payment_links;
CREATE TRIGGER guard_payment_link_update_tg BEFORE UPDATE ON public.payment_links FOR EACH ROW EXECUTE FUNCTION public.guard_payment_link_update();

CREATE OR REPLACE FUNCTION public.audit_payment_link_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.payment_links;
  v_event text;
  v_actor text;
BEGIN
  v_link := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_event := CASE
    WHEN TG_OP = 'INSERT' THEN 'created'
    WHEN TG_OP = 'DELETE' THEN 'deleted'
    WHEN NEW.admin_status IS DISTINCT FROM OLD.admin_status THEN 'admin_status_changed'
    WHEN NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN CASE WHEN NEW.archived_at IS NULL THEN 'restored' ELSE 'archived' END
    WHEN NEW.is_active IS DISTINCT FROM OLD.is_active THEN CASE WHEN NEW.is_active THEN 'activated' ELSE 'paused' END
    ELSE 'updated'
  END;
  v_actor := CASE WHEN auth.uid() IS NULL THEN 'system' WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN 'admin' ELSE 'seller' END;
  INSERT INTO public.payment_link_events(payment_link_id, seller_user_id, event_type, actor_type, actor_id, metadata)
  VALUES (v_link.id, v_link.user_id, v_event, v_actor, auth.uid(), jsonb_build_object('operation', TG_OP, 'version', v_link.version));
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_payment_link_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_payment_link_change() TO service_role;
DROP TRIGGER IF EXISTS audit_payment_link_change_tg ON public.payment_links;
CREATE TRIGGER audit_payment_link_change_tg AFTER INSERT OR UPDATE OR DELETE ON public.payment_links FOR EACH ROW EXECUTE FUNCTION public.audit_payment_link_change();

DROP FUNCTION IF EXISTS public.get_public_payment_link(text);
CREATE FUNCTION public.get_public_payment_link(_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, description text, cover_url text, amount numeric,
  is_active boolean, accept_pix boolean, accept_card boolean, accept_boleto boolean,
  max_uses integer, current_uses integer, expires_at timestamptz,
  billing_type text, pricing_type text, min_amount numeric, max_amount numeric,
  suggested_amount numeric, allow_quantity boolean, max_quantity integer,
  reference_code text, instructions text, pix_expiration_minutes integer,
  recurrence_interval text, recurrence_interval_count integer, recurrence_cycles integer,
  trial_days integer, cancellation_policy text, admin_status text, redirect_url text,
  options jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.slug, p.title, p.description, p.cover_url, p.amount,
         p.is_active, p.accept_pix, p.accept_card, p.accept_boleto,
         p.max_uses, p.current_uses, p.expires_at,
         p.billing_type, p.pricing_type, p.min_amount, p.max_amount,
         p.suggested_amount, p.allow_quantity, p.max_quantity,
         p.reference_code, p.instructions, p.pix_expiration_minutes,
         p.recurrence_interval, p.recurrence_interval_count, p.recurrence_cycles,
         p.trial_days, p.cancellation_policy, p.admin_status, p.redirect_url,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'description', o.description, 'amount_delta', o.amount_delta, 'is_required', o.is_required) ORDER BY o.position)
                   FROM public.payment_link_options o WHERE o.payment_link_id = p.id AND o.is_active), '[]'::jsonb)
  FROM public.payment_links p
  WHERE lower(p.slug) = lower(trim(_slug)) AND p.archived_at IS NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_payment_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_link(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_payment_link_intent_status(_public_token uuid)
RETURNS TABLE(status text, transaction_id uuid, expires_at timestamptz, redirect_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.status, i.transaction_id, i.expires_at,
         CASE WHEN i.status = 'paid' THEN p.redirect_url ELSE NULL END
  FROM public.payment_link_intents i
  JOIN public.payment_links p ON p.id = i.payment_link_id
  WHERE i.public_token = _public_token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_payment_link_intent_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_link_intent_status(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_payment_link_dashboard(_search text DEFAULT NULL, _status text DEFAULT 'all', _billing_type text DEFAULT 'all', _page integer DEFAULT 1, _page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT p.* FROM public.payment_links p
    WHERE p.user_id = auth.uid()
      AND (_search IS NULL OR p.title ILIKE '%' || _search || '%' OR p.slug ILIKE '%' || _search || '%' OR COALESCE(p.reference_code,'') ILIKE '%' || _search || '%')
      AND (_billing_type = 'all' OR p.billing_type = _billing_type)
      AND ((_status = 'all' AND p.archived_at IS NULL)
        OR (_status = 'archived' AND p.archived_at IS NOT NULL)
        OR (_status = 'active' AND p.archived_at IS NULL AND p.is_active AND p.admin_status = 'clear' AND (p.expires_at IS NULL OR p.expires_at > now()) AND (p.max_uses IS NULL OR p.current_uses < p.max_uses))
        OR (_status = 'paused' AND p.archived_at IS NULL AND NOT p.is_active)
        OR (_status = 'blocked' AND p.admin_status = 'blocked')
        OR (_status = 'expired' AND p.expires_at <= now()))
  ), paged AS (
    SELECT f.*, (SELECT count(*) FROM public.transactions t WHERE t.payment_link_id=f.id AND t.status='pending') AS pending_count,
      (SELECT COALESCE(sum(t.net_amount),0) FROM public.transactions t WHERE t.payment_link_id=f.id AND t.status IN ('approved','completed','paid')) AS net_revenue,
      (SELECT max(t.created_at) FROM public.transactions t WHERE t.payment_link_id=f.id AND t.status IN ('approved','completed','paid')) AS last_payment_at
    FROM filtered f ORDER BY f.created_at DESC
    LIMIT LEAST(GREATEST(_page_size,1),100) OFFSET (GREATEST(_page,1)-1)*LEAST(GREATEST(_page_size,1),100)
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged)) FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'summary', jsonb_build_object(
      'gross_revenue', COALESCE((SELECT sum(t.amount) FROM public.transactions t WHERE t.user_id=auth.uid() AND t.payment_link_id IS NOT NULL AND t.status IN ('approved','completed','paid')),0),
      'net_revenue', COALESCE((SELECT sum(t.net_amount) FROM public.transactions t WHERE t.user_id=auth.uid() AND t.payment_link_id IS NOT NULL AND t.status IN ('approved','completed','paid')),0),
      'paid', (SELECT count(*) FROM public.transactions t WHERE t.user_id=auth.uid() AND t.payment_link_id IS NOT NULL AND t.status IN ('approved','completed','paid')),
      'pending', (SELECT count(*) FROM public.transactions t WHERE t.user_id=auth.uid() AND t.payment_link_id IS NOT NULL AND t.status='pending'),
      'active_subscriptions', (SELECT count(*) FROM public.subscriptions s WHERE s.seller_user_id=auth.uid() AND s.payment_link_id IS NOT NULL AND s.status IN ('active','trialing')),
      'clicks', COALESCE((SELECT sum(p.clicks) FROM public.payment_links p WHERE p.user_id=auth.uid()),0)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.get_my_payment_link_dashboard(text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payment_link_dashboard(text,text,text,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_payment_links_page(_search text DEFAULT NULL, _status text DEFAULT 'all', _billing_type text DEFAULT 'all', _page integer DEFAULT 1, _page_size integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH filtered AS (
    SELECT p.*, pr.full_name AS seller_name, pr.email AS seller_email
    FROM public.payment_links p LEFT JOIN public.profiles pr ON pr.user_id=p.user_id
    WHERE (_search IS NULL OR p.title ILIKE '%'||_search||'%' OR p.slug ILIKE '%'||_search||'%' OR COALESCE(pr.full_name,'') ILIKE '%'||_search||'%' OR COALESCE(pr.email,'') ILIKE '%'||_search||'%')
      AND (_billing_type='all' OR p.billing_type=_billing_type)
      AND (_status='all' OR (_status='blocked' AND p.admin_status='blocked') OR (_status='archived' AND p.archived_at IS NOT NULL) OR (_status='active' AND p.is_active AND p.archived_at IS NULL AND p.admin_status='clear') OR (_status='paused' AND NOT p.is_active))
  ), paged AS (
    SELECT f.*, (SELECT count(*) FROM public.transactions t WHERE t.payment_link_id=f.id AND t.status='pending') pending_count,
      (SELECT COALESCE(sum(t.net_amount),0) FROM public.transactions t WHERE t.payment_link_id=f.id AND t.status IN ('approved','completed','paid')) net_revenue,
      (SELECT max(t.created_at) FROM public.transactions t WHERE t.payment_link_id=f.id) last_payment_at
    FROM filtered f ORDER BY f.created_at DESC
    LIMIT LEAST(GREATEST(_page_size,1),100) OFFSET (GREATEST(_page,1)-1)*LEAST(GREATEST(_page_size,1),100)
  )
  SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(to_jsonb(paged)) FROM paged),'[]'::jsonb),'total',(SELECT count(*) FROM filtered)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_payment_links_page(text,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payment_links_page(text,text,text,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_payment_link_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE delta_amount numeric := 0; delta_uses integer := 0;
BEGIN
  IF NEW.payment_link_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IN ('approved','completed','paid') AND OLD.status NOT IN ('approved','completed','paid') THEN delta_amount := NEW.amount; delta_uses := 1;
  ELSIF OLD.status IN ('approved','completed','paid') AND NEW.status IN ('refunded','chargeback') THEN delta_amount := -OLD.amount; delta_uses := -1;
  ELSE RETURN NEW;
  END IF;
  UPDATE public.payment_links SET current_uses=GREATEST(0,current_uses+delta_uses), total_revenue=GREATEST(0,total_revenue+delta_amount), updated_at=now() WHERE id=NEW.payment_link_id;
  IF NEW.payment_link_intent_id IS NOT NULL THEN UPDATE public.payment_link_intents SET status=CASE WHEN delta_uses=1 THEN 'paid' ELSE 'canceled' END, updated_at=now() WHERE id=NEW.payment_link_intent_id; END IF;
  INSERT INTO public.payment_link_events(payment_link_id,seller_user_id,transaction_id,event_type,actor_type,metadata) VALUES(NEW.payment_link_id,NEW.user_id,NEW.id,CASE WHEN delta_uses=1 THEN 'payment_approved' ELSE NEW.status END,'webhook',jsonb_build_object('amount',NEW.amount));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.update_payment_link_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_link_stats() TO service_role;

NOTIFY pgrst, 'reload schema';