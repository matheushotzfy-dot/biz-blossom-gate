-- 1) Restaura acesso público necessário ao checkout/cadastro (funções sem dados sensíveis)
GRANT EXECUTE ON FUNCTION public.is_product_active(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_signup_conflicts(text, text, text) TO anon, authenticated;

-- 2) Saldo do ledger: apenas o próprio usuário ou admin
CREATE OR REPLACE FUNCTION public.get_ledger_balance(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN COALESCE(
    (SELECT balance_after FROM public.financial_ledger
      WHERE user_id = _user_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1),
    0
  );
END;
$function$;

-- 3) Limite de ticket: apenas o próprio usuário ou admin
CREATE OR REPLACE FUNCTION public.get_user_max_ticket(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN COALESCE(
    (SELECT max_ticket FROM public.custom_user_fees WHERE user_id = _user_id LIMIT 1),
    NULLIF((SELECT (value->>'value')::numeric FROM public.platform_settings WHERE key = 'max_ticket_default' LIMIT 1), 0),
    10000
  );
END;
$function$;

-- 4) Progresso de metas: somente admin (expunha faturamento e nome de todos os vendedores)
CREATE OR REPLACE FUNCTION public.get_goal_progress(_goal_id uuid)
RETURNS TABLE(seller_id uuid, seller_name text, revenue numeric, achieved boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO g FROM public.revenue_goals WHERE id = _goal_id;
  IF g IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.user_id AS seller_id,
    COALESCE(p.full_name, p.nickname, split_part(p.email,'@',1), 'Vendedor') AS seller_name,
    COALESCE(SUM(t.amount), 0)::NUMERIC AS revenue,
    COALESCE(SUM(t.amount), 0) >= g.target_amount AS achieved
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.status IN ('approved','completed','paid')
    AND t.created_at >= g.starts_at
    AND t.created_at <= g.ends_at
  GROUP BY t.user_id, p.full_name, p.nickname, p.email
  ORDER BY revenue DESC
  LIMIT 200;
END $function$;

REVOKE EXECUTE ON FUNCTION public.get_ledger_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_max_ticket(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_goal_progress(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_ledger_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_max_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_goal_progress(uuid) TO authenticated;