CREATE OR REPLACE FUNCTION public.request_my_anticipation(_max_days integer, _idempotency_key text)
RETURNS public.anticipations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _p record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _max_days IS NULL OR _max_days < 1 OR _max_days > 30 THEN RAISE EXCEPTION 'Janela inválida'; END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 16 OR length(_idempotency_key) > 80 THEN RAISE EXCEPTION 'Chave inválida'; END IF;
  SELECT account_status, coalesce(frozen,false) AS frozen, coalesce(balance_frozen,false) AS bf INTO _p FROM public.profiles WHERE user_id = _uid;
  IF NOT FOUND OR _p.account_status <> 'approved' THEN RAISE EXCEPTION 'Conta não aprovada'; END IF;
  IF _p.frozen OR _p.bf THEN RAISE EXCEPTION 'Conta ou saldo congelado'; END IF;
  RETURN public.request_anticipation(_uid, _max_days, _uid::text || ':' || _idempotency_key);
END $$;
REVOKE ALL ON FUNCTION public.request_my_anticipation(integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_my_anticipation(integer, text) TO authenticated;