CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title text;
  _message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Saque Solicitado',
      format('Sua solicitação de saque de R$ %s foi registrada e está pendente de aprovação.', to_char(ROUND(NEW.amount, 2), 'FM999G999G990D00')),
      'withdrawal'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('approved','paid','completed') THEN
      _title := 'Saque Concluído ✅';
      _message := format('Seu saque de R$ %s foi pago e enviado para sua conta.', to_char(ROUND(NEW.amount, 2), 'FM999G999G990D00'));
    ELSIF NEW.status = 'processing' THEN
      _title := 'Saque em Processamento';
      _message := format('Seu saque de R$ %s está sendo processado.', to_char(ROUND(NEW.amount, 2), 'FM999G999G990D00'));
    ELSIF NEW.status IN ('rejected','failed','cancelled') THEN
      _title := 'Saque Recusado ❌';
      _message := format('Seu saque de R$ %s foi recusado. O valor foi devolvido ao seu saldo. Entre em contato com o suporte se precisar de ajuda.', to_char(ROUND(NEW.amount, 2), 'FM999G999G990D00'));
    END IF;
    IF _title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, _title, _message, 'withdrawal');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;