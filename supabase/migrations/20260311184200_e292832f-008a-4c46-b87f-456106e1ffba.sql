
-- Auto-create notifications when withdrawal status changes
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _title text;
  _message text;
  _type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _title := 'Saque Solicitado';
    _message := format('Sua solicitação de saque de R$ %s foi registrada e está pendente de aprovação.', ROUND(NEW.amount, 2));
    _type := 'withdrawal';
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, _title, _message, _type);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'approved' THEN
      _title := 'Saque Aprovado ✅';
      _message := format('Seu saque de R$ %s foi aprovado e será processado em breve.', ROUND(NEW.amount, 2));
      _type := 'withdrawal';
    ELSIF NEW.status = 'rejected' THEN
      _title := 'Saque Recusado ❌';
      _message := format('Seu saque de R$ %s foi recusado. Entre em contato com o suporte.', ROUND(NEW.amount, 2));
      _type := 'withdrawal';
    END IF;
    IF _title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, _title, _message, _type);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_withdrawal_status
  AFTER INSERT OR UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_withdrawal_status();
