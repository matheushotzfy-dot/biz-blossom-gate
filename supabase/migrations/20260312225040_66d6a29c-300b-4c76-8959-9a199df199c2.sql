
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fee numeric;
  _pct_fee numeric;
BEGIN
  IF COALESCE(NEW.withdrawal_type, 'pix') = 'crypto' THEN
    -- Crypto: 5% + R$5
    _pct_fee := NEW.amount * 0.05;
    _fee := _pct_fee + 5.00;
  ELSE
    -- PIX: flat fee from fees table
    SELECT COALESCE(value, 5.00) INTO _fee
    FROM public.fees
    WHERE name = 'Taxa de Saque' AND fee_type = 'fixed'
    LIMIT 1;
    IF _fee IS NULL THEN _fee := 5.00; END IF;
  END IF;

  NEW.fee_amount := _fee;
  NEW.net_amount := NEW.amount - _fee;

  IF NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'Valor de saque deve ser maior que a taxa de R$ %', ROUND(_fee, 2);
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$function$;
