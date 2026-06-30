CREATE OR REPLACE FUNCTION public.notify_transaction_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND COALESCE(OLD.status, '') <> 'approved'
     AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'sale_paid',
      'Nova venda aprovada',
      'Você recebeu R$ ' || to_char(COALESCE(NEW.net_amount, 0), 'FM999999990.00') || ' líquidos.',
      jsonb_build_object(
        'transaction_id', NEW.id,
        'amount', NEW.amount,
        'net_amount', NEW.net_amount,
        'payment_method', NEW.payment_method
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_transaction_paid ON public.transactions;
CREATE TRIGGER trg_notify_transaction_paid
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_paid();