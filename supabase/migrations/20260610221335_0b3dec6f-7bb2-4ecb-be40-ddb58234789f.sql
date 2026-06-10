CREATE INDEX IF NOT EXISTS idx_transactions_completed_product_customer_email_lower
ON public.transactions (product_id, lower(customer_email))
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_products_created_at
ON public.products (created_at DESC);

ANALYZE public.transactions;
ANALYZE public.products;