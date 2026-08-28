CREATE OR REPLACE FUNCTION public.notify_transaction_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.user_id,
    'sale_paid',
    'Nova venda aprovada',
    'Você recebeu R$ ' || to_char(COALESCE(NEW.net_amount, 0), 'FM999999990.00') || ' líquidos.'
  );
  RETURN NEW;
END;
$$;