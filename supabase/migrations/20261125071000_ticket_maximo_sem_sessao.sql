-- Limite de ticket máximo também para inserts feitos pelo servidor.
--
-- O trigger enforce_max_ticket_limit chamava get_user_max_ticket, que exige auth.uid() (sessão de usuário).
-- Uma cobrança criada por uma função de servidor (service_role, sem sessão) falhava com "authentication required"
-- antes mesmo de gravar a venda. A conta do limite é a mesma, só que sem depender da sessão:
-- limite individual (custom_user_fees.max_ticket), senão o padrão da plataforma (max_ticket_default), senão R$ 10.000.
CREATE OR REPLACE FUNCTION public.enforce_max_ticket_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _limit numeric;
BEGIN
  -- Pular simuladas e estornos (UPDATEs não passam aqui pois é BEFORE INSERT)
  IF NEW.is_simulated = true OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  _limit := COALESCE(
    (SELECT max_ticket FROM public.custom_user_fees WHERE user_id = NEW.user_id LIMIT 1),
    NULLIF((SELECT (value->>'value')::numeric FROM public.platform_settings WHERE key = 'max_ticket_default' LIMIT 1), 0),
    10000
  );

  IF _limit IS NOT NULL AND _limit > 0 AND NEW.amount > _limit THEN
    RAISE EXCEPTION 'Valor da transação (R$ %) excede o limite máximo permitido (R$ %). Entre em contato com o suporte para aumentar seu limite.',
      to_char(NEW.amount, 'FM999G999G990D00'),
      to_char(_limit, 'FM999G999G990D00')
      USING ERRCODE = 'check_violation',
            HINT = 'max_ticket_exceeded';
  END IF;

  RETURN NEW;
END;
$function$;
