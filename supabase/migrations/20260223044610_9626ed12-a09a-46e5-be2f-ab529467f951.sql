
-- Add PodPay tracking columns for idempotency
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS podpay_payment_id text UNIQUE,
ADD COLUMN IF NOT EXISTS podpay_event_id text UNIQUE,
ADD COLUMN IF NOT EXISTS checkout_session_id text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_podpay_payment_id ON public.transactions(podpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_session ON public.transactions(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- Add trigger for updated_at
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow service role to insert/update transactions (for edge functions)
-- Edge functions use service_role key so they bypass RLS, but let's ensure
-- regular users can also view their pending transactions for checkout resume
