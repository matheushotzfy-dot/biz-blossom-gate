CREATE OR REPLACE FUNCTION public.admin_get_seller_balances()
RETURNS TABLE(user_id uuid, balance numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH net_in AS (
    SELECT t.user_id AS uid, COALESCE(SUM(t.net_amount), 0) AS v
      FROM public.transactions t
     WHERE t.status IN ('approved','completed')
     GROUP BY t.user_id
  ),
  approved_out AS (
    SELECT w.user_id AS uid, COALESCE(SUM(w.amount), 0) AS v
      FROM public.withdrawals w
     WHERE w.status = 'approved'
     GROUP BY w.user_id
  ),
  pending_out AS (
    SELECT w.user_id AS uid, COALESCE(SUM(w.amount), 0) AS v
      FROM public.withdrawals w
     WHERE w.status = 'pending'
     GROUP BY w.user_id
  ),
  adj AS (
    SELECT a.user_id AS uid,
           COALESCE(SUM(CASE WHEN a.type='credit' THEN a.amount ELSE -a.amount END), 0) AS v
      FROM public.balance_adjustments a
     GROUP BY a.user_id
  ),
  ids AS (
    SELECT n.uid FROM net_in n
    UNION SELECT ao.uid FROM approved_out ao
    UNION SELECT po.uid FROM pending_out po
    UNION SELECT aj.uid FROM adj aj
  )
  SELECT i.uid,
         COALESCE(n.v,0) - COALESCE(ao.v,0) - COALESCE(po.v,0) + COALESCE(aj.v,0)
    FROM ids i
    LEFT JOIN net_in       n  ON n.uid  = i.uid
    LEFT JOIN approved_out ao ON ao.uid = i.uid
    LEFT JOIN pending_out  po ON po.uid = i.uid
    LEFT JOIN adj          aj ON aj.uid = i.uid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_seller_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances() TO authenticated;

REVOKE ALL ON FUNCTION public.list_visible_acquirers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_acquirers() TO authenticated;

DROP POLICY IF EXISTS "Admins can view all order bumps" ON public.order_bumps;
CREATE POLICY "Admins can view all order bumps"
ON public.order_bumps
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_data(
  _from timestamp with time zone,
  _to timestamp with time zone,
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
               kyc_rejection_reason, admin_notes, last_login_at,
               last_ip, pix_key, pix_key_type,
               street, street_number, complement, neighborhood, city, state, zip_code, address_locked
        FROM public.profiles
        ORDER BY created_at DESC NULLS LAST
        LIMIT _profile_limit_safe
      ) p
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(pr))
      FROM (
        SELECT id, user_id, name, price, status, created_at, updated_at, image_url, checkout_url,
               affiliate_enabled, affiliate_commission, deleted_at, description
        FROM public.products
        ORDER BY created_at DESC NULLS LAST
        LIMIT _product_limit_safe
      ) pr
    ), '[]'::jsonb),
    'withdrawals', COALESCE((
      SELECT jsonb_agg(to_jsonb(w))
      FROM (
        SELECT *
        FROM public.withdrawals
        WHERE (created_at >= _from AND created_at <= _to)
           OR status IN ('pending','processing')
        ORDER BY created_at DESC NULLS LAST
        LIMIT _withdrawal_limit_safe
      ) w
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_data(timestamptz, timestamptz, integer, integer, integer, integer) TO authenticated;