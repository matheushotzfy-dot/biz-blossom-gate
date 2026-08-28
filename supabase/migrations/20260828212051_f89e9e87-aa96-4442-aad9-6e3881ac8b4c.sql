CREATE OR REPLACE FUNCTION public.simulate_demo_sales(_user_id uuid, _new_sales int DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted int := 0;
  _approved int := 0;
BEGIN
  -- 1) Novas vendas PIX chegando "agora"
  INSERT INTO public.transactions (
    user_id, amount, fee_amount, net_amount, status, payment_method,
    customer_name, customer_email, customer_document, created_at, updated_at,
    pix_expires_at, is_simulated, source, metadata
  )
  SELECT
    _user_id,
    amt,
    round(amt * 0.0499 + 1.00, 2),
    round(amt - (amt * 0.0499 + 1.00), 2),
    'pending',
    'pix',
    'Cliente Simulado ' || floor(random() * 999999)::int,
    'cliente' || floor(random() * 999999)::int || '@exemplo.com',
    lpad((floor(random() * 99999999999))::bigint::text, 11, '0'),
    now(), now(), now() + interval '30 minutes',
    true, 'web', '{"simulated":true,"batch":"demo_live"}'::jsonb
  FROM (
    SELECT round((15 + random() * 40)::numeric, 2) AS amt
    FROM generate_series(1, GREATEST(_new_sales, 0))
  ) s;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  -- 2) Aprova parte das pendentes simuladas recentes (fluxo realista de pagamento)
  WITH candidates AS (
    SELECT id FROM public.transactions
    WHERE user_id = _user_id
      AND is_simulated = true
      AND status = 'pending'
      AND created_at > now() - interval '2 hours'
    ORDER BY created_at
    LIMIT GREATEST((_new_sales * 0.85)::int, 1)
  )
  UPDATE public.transactions t
  SET status = 'approved', updated_at = now()
  FROM candidates c
  WHERE t.id = c.id;
  GET DIAGNOSTICS _approved = ROW_COUNT;

  RETURN jsonb_build_object('inserted', _inserted, 'approved', _approved);
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_demo_sales(uuid, int) FROM PUBLIC, anon, authenticated;