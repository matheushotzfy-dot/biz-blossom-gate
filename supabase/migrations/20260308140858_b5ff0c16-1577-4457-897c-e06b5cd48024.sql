CREATE INDEX IF NOT EXISTS idx_products_checkout_url ON public.products(checkout_url) WHERE checkout_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_session ON public.transactions(checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_podpay_payment ON public.transactions(podpay_payment_id) WHERE podpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_podpay_event ON public.transactions(podpay_event_id) WHERE podpay_event_id IS NOT NULL;