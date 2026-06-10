CREATE OR REPLACE FUNCTION public.get_admin_dashboard_data(
  _from timestamptz,
  _to timestamptz,
  _tx_limit integer DEFAULT 2000,
  _profile_limit integer DEFAULT 1000,
  _product_limit integer DEFAULT 1000,
  _withdrawal_limit integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx_limit_safe integer := LEAST(GREATEST(COALESCE(_tx_limit, 2000), 1), 5000);
  _profile_limit_safe integer := LEAST(GREATEST(COALESCE(_profile_limit, 1000), 1), 3000);
  _product_limit_safe integer := LEAST(GREATEST(COALESCE(_product_limit, 1000), 1), 3000);
  _withdrawal_limit_safe integer := LEAST(GREATEST(COALESCE(_withdrawal_limit, 2000), 1), 5000);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN jsonb_build_object(
    'transactions', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM (
        SELECT id, user_id, product_id, amount, fee_amount, net_amount, status, payment_method,
               customer_name, customer_email, created_at, updated_at, retained_amount, retention_released
        FROM public.transactions
        WHERE created_at >= _from AND created_at <= _to
        ORDER BY created_at DESC NULLS LAST
        LIMIT _tx_limit_safe
      ) t
    ), '[]'::jsonb),
    'profiles', COALESCE((
      SELECT jsonb_agg(to_jsonb(p))
      FROM (
        SELECT id, user_id, full_name, email, account_status, document_number, document_type, phone,
               nickname, seller_type, acquirer_id, balance_frozen, created_at, updated_at, avatar_url,
               kyc_rejection_reason, admin_notes, last_login_at
        FROM public.profiles
        ORDER BY created_at DESC NULLS LAST
        LIMIT _profile_limit_safe
      ) p
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(pr))
      FROM (
        SELECT id, user_id, name, price, status, created_at, updated_at, image_url, checkout_url,
               affiliate_enabled, affiliate_commission
        FROM public.products
        ORDER BY created_at DESC NULLS LAST
        LIMIT _product_limit_safe
      ) pr
    ), '[]'::jsonb),
    'withdrawals', COALESCE((
      SELECT jsonb_agg(to_jsonb(w))
      FROM (
        SELECT id, user_id, amount, fee_amount, net_amount, status, created_at, processed_at,
               bank_account_id, withdrawal_type, crypto_currency, crypto_network, crypto_address
        FROM public.withdrawals
        WHERE created_at >= _from AND created_at <= _to
        ORDER BY created_at DESC NULLS LAST
        LIMIT _withdrawal_limit_safe
      ) w
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) TO service_role;

ANALYZE public.products;
ANALYZE public.transactions;
ANALYZE public.profiles;
ANALYZE public.withdrawals;