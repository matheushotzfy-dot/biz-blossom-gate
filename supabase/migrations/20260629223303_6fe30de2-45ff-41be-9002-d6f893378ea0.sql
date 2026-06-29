CREATE UNIQUE INDEX IF NOT EXISTS transactions_checkout_session_pending_unique
  ON public.transactions (checkout_session_id)
  WHERE status = 'pending' AND checkout_session_id IS NOT NULL;