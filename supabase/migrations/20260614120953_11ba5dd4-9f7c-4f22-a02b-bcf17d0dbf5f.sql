
-- ============================================
-- 1) TABLE: reward_claims
-- ============================================
CREATE TABLE IF NOT EXISTS public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id text NOT NULL,
  tier_label text NOT NULL,
  tier_value numeric NOT NULL,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  document text,
  shipping_street text NOT NULL,
  shipping_number text NOT NULL,
  shipping_complement text,
  shipping_neighborhood text NOT NULL,
  shipping_city text NOT NULL,
  shipping_state text NOT NULL,
  shipping_zip text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tracking_carrier text,
  tracking_code text,
  tracking_url text,
  admin_notes text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reward_claims_status_check CHECK (status IN ('pending','preparing','shipped','delivered','cancelled'))
);

GRANT SELECT, INSERT ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;

ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view own reward claims"
  ON public.reward_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Sellers create own reward claims"
  ON public.reward_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all reward claims"
  ON public.reward_claims FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update reward claims"
  ON public.reward_claims FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete reward claims"
  ON public.reward_claims FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny_anon_reward_claims" ON public.reward_claims AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_reward_claims_user_id ON public.reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_status ON public.reward_claims(status);
CREATE INDEX IF NOT EXISTS idx_reward_claims_created ON public.reward_claims(created_at DESC);

CREATE TRIGGER trg_reward_claims_updated_at
  BEFORE UPDATE ON public.reward_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2) NOTIFICATION TRIGGER: withdrawals
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_type text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' OR NEW.status = 'paid' OR NEW.status = 'processed' THEN
      v_title := 'Saque concluído';
      v_message := 'Seu saque de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || ' foi pago com sucesso.';
      v_type := 'success';
    ELSIF NEW.status = 'approved' THEN
      v_title := 'Saque aprovado';
      v_message := 'Seu saque de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || ' foi aprovado e está sendo processado.';
      v_type := 'info';
    ELSIF NEW.status = 'rejected' OR NEW.status = 'failed' THEN
      v_title := 'Saque recusado';
      v_message := 'Seu saque de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || ' foi recusado. Entre em contato com o suporte se tiver dúvidas.';
      v_type := 'error';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, v_title, v_message, v_type);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_withdrawal_status ON public.withdrawals;
CREATE TRIGGER trg_notify_withdrawal_status
  AFTER UPDATE OF status ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_status_change();

-- ============================================
-- 3) NOTIFICATION TRIGGER: reward_claims
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_reward_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id,
            'Premiação solicitada',
            'Sua premiação "' || NEW.tier_label || '" foi registrada e está em análise.',
            'info');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'preparing' THEN
      v_title := 'Premiação em preparação';
      v_message := 'Sua premiação "' || NEW.tier_label || '" está sendo preparada para envio.';
      v_type := 'info';
    ELSIF NEW.status = 'shipped' THEN
      v_title := 'Premiação enviada';
      v_message := 'Sua premiação "' || NEW.tier_label || '" foi postada.'
        || CASE WHEN NEW.tracking_code IS NOT NULL
                THEN ' Código de rastreio: ' || NEW.tracking_code
                ELSE '' END;
      v_type := 'success';
    ELSIF NEW.status = 'delivered' THEN
      v_title := 'Premiação entregue';
      v_message := 'Sua premiação "' || NEW.tier_label || '" foi entregue. Aproveite!';
      v_type := 'success';
    ELSIF NEW.status = 'cancelled' THEN
      v_title := 'Premiação cancelada';
      v_message := 'A solicitação da premiação "' || NEW.tier_label || '" foi cancelada.';
      v_type := 'error';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, v_title, v_message, v_type);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reward_claim_insert ON public.reward_claims;
CREATE TRIGGER trg_notify_reward_claim_insert
  AFTER INSERT ON public.reward_claims
  FOR EACH ROW EXECUTE FUNCTION public.notify_reward_claim_status_change();

DROP TRIGGER IF EXISTS trg_notify_reward_claim_status ON public.reward_claims;
CREATE TRIGGER trg_notify_reward_claim_status
  AFTER UPDATE OF status ON public.reward_claims
  FOR EACH ROW EXECUTE FUNCTION public.notify_reward_claim_status_change();

-- ============================================
-- 4) NOTIFICATION TRIGGER: support_tickets reply
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_support_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.admin_reply IS NOT NULL
     AND (OLD.admin_reply IS NULL OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply) THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id,
            'Resposta do suporte',
            'Sua dúvida "' || left(NEW.subject, 60) || '" recebeu uma resposta.',
            'info');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_support_reply ON public.support_tickets;
CREATE TRIGGER trg_notify_support_reply
  AFTER UPDATE OF admin_reply ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket_reply();
