
-- Add crypto withdrawal columns
ALTER TABLE public.withdrawals 
  ADD COLUMN IF NOT EXISTS withdrawal_type text NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS crypto_currency text,
  ADD COLUMN IF NOT EXISTS crypto_network text,
  ADD COLUMN IF NOT EXISTS crypto_address text;

-- Update fee trigger to handle crypto fees (7% + R$5)
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
    -- Crypto: 7% + R$5
    _pct_fee := NEW.amount * 0.07;
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

-- Validate crypto withdrawal daily limits
CREATE OR REPLACE FUNCTION public.validate_crypto_daily_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _total_withdrawals_ever integer;
  _daily_total numeric;
  _daily_limit numeric;
BEGIN
  IF COALESCE(NEW.withdrawal_type, 'pix') != 'crypto' THEN
    RETURN NEW;
  END IF;

  -- Count total completed/approved crypto withdrawals for this user
  SELECT COUNT(*) INTO _total_withdrawals_ever
  FROM public.withdrawals
  WHERE user_id = NEW.user_id
    AND withdrawal_type = 'crypto'
    AND status IN ('approved', 'pending');

  -- First crypto withdrawal: limit R$500
  IF _total_withdrawals_ever = 0 AND NEW.amount > 500 THEN
    RAISE EXCEPTION 'Primeiro saque crypto limitado a R$ 500,00. Após o primeiro saque, limite diário de R$ 6.000,00.';
  END IF;

  -- After first: daily limit R$6000
  IF _total_withdrawals_ever > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO _daily_total
    FROM public.withdrawals
    WHERE user_id = NEW.user_id
      AND withdrawal_type = 'crypto'
      AND status IN ('approved', 'pending')
      AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    
    IF (_daily_total + NEW.amount) > 6000 THEN
      RAISE EXCEPTION 'Limite diário de saque crypto: R$ 6.000,00. Já solicitado hoje: R$ %', ROUND(_daily_total, 2);
    END IF;
  END IF;

  -- Validate required crypto fields
  IF NEW.crypto_currency IS NULL OR NEW.crypto_network IS NULL OR NEW.crypto_address IS NULL THEN
    RAISE EXCEPTION 'Campos crypto_currency, crypto_network e crypto_address são obrigatórios para saques crypto';
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for crypto daily limit validation
DROP TRIGGER IF EXISTS trg_validate_crypto_daily_limit ON public.withdrawals;
CREATE TRIGGER trg_validate_crypto_daily_limit
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_crypto_daily_limit();
