CREATE TABLE public.checkout_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  seller_user_id uuid NOT NULL,
  buyer_user_id uuid,
  customer_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','revoked')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  delivered_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, product_id)
);

GRANT SELECT, UPDATE ON public.checkout_delivery_attempts TO authenticated;
GRANT ALL ON public.checkout_delivery_attempts TO service_role;

ALTER TABLE public.checkout_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view checkout deliveries"
ON public.checkout_delivery_attempts FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins retry checkout deliveries"
ON public.checkout_delivery_attempts FOR UPDATE TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_checkout_delivery_attempts_status_created
ON public.checkout_delivery_attempts(status, created_at DESC);
CREATE INDEX idx_checkout_delivery_attempts_seller_created
ON public.checkout_delivery_attempts(seller_user_id, created_at DESC);
CREATE INDEX idx_checkout_delivery_attempts_email_pending
ON public.checkout_delivery_attempts(lower(customer_email))
WHERE status = 'pending';

CREATE OR REPLACE FUNCTION app_private.process_checkout_delivery(_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _buyer_id uuid;
  _course_id uuid;
  _delivery_id uuid;
  _email text;
  _alert_key text;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed') THEN
    RAISE EXCEPTION 'payment is not confirmed';
  END IF;
  IF _tx.product_id IS NULL OR _tx.user_id IS NULL THEN
    RAISE EXCEPTION 'transaction product or seller is missing';
  END IF;

  _email := lower(btrim(COALESCE(_tx.customer_email, '')));
  IF _email = '' OR length(_email) > 255 THEN
    RAISE EXCEPTION 'customer email is invalid';
  END IF;

  INSERT INTO public.checkout_delivery_attempts(
    transaction_id, product_id, seller_user_id, customer_email, status, attempt_count, last_attempt_at
  ) VALUES (
    _tx.id, _tx.product_id, _tx.user_id, _email, 'pending', 1, now()
  )
  ON CONFLICT (transaction_id, product_id) DO UPDATE SET
    attempt_count = public.checkout_delivery_attempts.attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  RETURNING id INTO _delivery_id;

  SELECT id INTO _buyer_id
  FROM auth.users
  WHERE lower(email) = _email
  ORDER BY created_at ASC
  LIMIT 1;

  IF _buyer_id IS NULL THEN
    UPDATE public.checkout_delivery_attempts
    SET status='pending', last_error='Aguardando criação da conta do comprador', updated_at=now()
    WHERE id=_delivery_id;

    _alert_key := 'delivery_pending:' || _tx.id::text;
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind='checkout_delivery_pending'
        AND metadata->>'dedupe_key'=_alert_key
    ) THEN
      INSERT INTO public.admin_alerts(kind,severity,message,metadata)
      VALUES ('checkout_delivery_pending','warning','Pagamento confirmado aguardando conta do comprador',
        jsonb_build_object('dedupe_key',_alert_key,'transaction_id',_tx.id,'product_id',_tx.product_id,'seller_user_id',_tx.user_id));
    END IF;
    RETURN jsonb_build_object('status','pending','delivery_id',_delivery_id);
  END IF;

  SELECT id INTO _course_id FROM public.courses WHERE product_id=_tx.product_id LIMIT 1;
  IF _course_id IS NULL THEN
    UPDATE public.checkout_delivery_attempts
    SET buyer_user_id=_buyer_id, status='failed', last_error='Produto sem curso vinculado', updated_at=now()
    WHERE id=_delivery_id;
    RETURN jsonb_build_object('status','failed','delivery_id',_delivery_id,'reason','course_not_linked');
  END IF;

  INSERT INTO public.user_access(user_id,course_id,transaction_id,status,granted_at)
  VALUES (_buyer_id,_course_id,_tx.id,'active',now())
  ON CONFLICT (user_id,course_id) DO UPDATE SET
    transaction_id=EXCLUDED.transaction_id,status='active',granted_at=now(),revoked_at=NULL;

  UPDATE public.checkout_delivery_attempts
  SET buyer_user_id=_buyer_id,status='delivered',last_error=NULL,delivered_at=now(),updated_at=now()
  WHERE id=_delivery_id;

  RETURN jsonb_build_object('status','delivered','delivery_id',_delivery_id,'buyer_user_id',_buyer_id);
END;
$$;

REVOKE ALL ON FUNCTION app_private.process_checkout_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.process_checkout_delivery(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_access_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('approved','paid','completed')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status NOT IN ('approved','paid','completed') THEN
    PERFORM app_private.process_checkout_delivery(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_access_on_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_access_on_payment() TO service_role;

CREATE OR REPLACE FUNCTION public.protect_transaction_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND _jwt_role <> 'service_role'
     AND NOT app_private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'transaction status is server-controlled';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_transaction_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_transaction_status() TO service_role;

CREATE OR REPLACE FUNCTION app_private.admin_retry_checkout_delivery(_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin uuid;
  _transaction_id uuid;
  _result jsonb;
BEGIN
  _admin := app_private.assert_admin();
  PERFORM app_private.assert_recent_auth();
  SELECT transaction_id INTO _transaction_id
  FROM public.checkout_delivery_attempts
  WHERE id=_delivery_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  _result := app_private.process_checkout_delivery(_transaction_id);
  PERFORM app_private.admin_audit(_admin,'checkout_delivery_retry','transaction',_transaction_id::text,
    jsonb_build_object('delivery_id',_delivery_id,'result',_result));
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION app_private.admin_retry_checkout_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.admin_retry_checkout_delivery(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_retry_checkout_delivery(_delivery_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$ SELECT app_private.admin_retry_checkout_delivery(_delivery_id) $$;

REVOKE ALL ON FUNCTION public.admin_retry_checkout_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_checkout_delivery(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.checkout_delivery_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;

CREATE TRIGGER checkout_delivery_touch_updated_at_tg
BEFORE UPDATE ON public.checkout_delivery_attempts
FOR EACH ROW EXECUTE FUNCTION public.checkout_delivery_touch_updated_at();