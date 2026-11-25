-- APLICADA em 2026-11-25 (aprovada por Lucker, via Lovable query_database): trava de resgate de peças + faturamento total em uma chamada só.
--
-- Hoje: o trigger guard_reward_claims_write só impede um segundo resgate da mesma peça e zera os campos
-- de admin. Ele NÃO confere se o vendedor tem faturamento para a peça: quem chamar a API direto (fora da
-- tela) consegue pedir qualquer peça, mesmo com R$ 0 faturados, e ainda escolhe o tier_label/tier_value
-- que quiser (esses campos vêm do cliente).
--
-- O que muda:
--  1) o servidor passa a exigir faturamento líquido >= valor da peça (regra igual à da tela:
--     soma de net_amount de transactions com status 'completed' e is_simulated = false);
--  2) a peça precisa existir e estar ativa em award_tiers;
--  3) tier_label e tier_value são gravados pelo servidor (a partir de award_tiers), não pelo cliente;
--  4) nova RPC get_my_lifetime_revenue() devolve o faturamento total em reais numa chamada só
--     (a tela hoje pagina `transactions` de 1.000 em 1.000).
--
-- Admin e service_role continuam passando direto, como hoje. Erros novos: reward_tier_unavailable e
-- reward_not_reached (a tela já traduz os dois).
-- Dúvida para você decidir: contar faturamento LÍQUIDO (como está hoje na tela e aqui) ou BRUTO?

CREATE OR REPLACE FUNCTION public.guard_reward_claims_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_value numeric;
  v_revenue numeric;
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

    SELECT t.title, t.value INTO v_title, v_value
    FROM public.award_tiers t
    WHERE t.id = NEW.tier_id AND t.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reward_tier_unavailable';
    END IF;

    SELECT COALESCE(SUM(tx.net_amount), 0) INTO v_revenue
    FROM public.transactions tx
    WHERE tx.user_id = NEW.user_id
      AND tx.status = 'completed'
      AND tx.is_simulated = false;
    IF v_revenue < v_value THEN
      RAISE EXCEPTION 'reward_not_reached';
    END IF;

    -- o servidor decide o rótulo e o valor da peça
    NEW.tier_label := v_title;
    NEW.tier_value := v_value;
  END IF;
  RETURN NEW;
END $function$;

-- Faturamento total do próprio vendedor, em reais (mesma regra da tela e do trigger acima).
-- Segue o padrão do projeto: rotina privilegiada em app_private + wrapper SECURITY INVOKER em public.
CREATE OR REPLACE FUNCTION app_private.get_my_lifetime_revenue()
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(tx.net_amount), 0)
  FROM public.transactions tx
  WHERE tx.user_id = auth.uid()
    AND tx.status = 'completed'
    AND tx.is_simulated = false;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_lifetime_revenue()
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.get_my_lifetime_revenue()$function$;

REVOKE ALL ON FUNCTION app_private.get_my_lifetime_revenue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_lifetime_revenue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_my_lifetime_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_lifetime_revenue() TO authenticated;
