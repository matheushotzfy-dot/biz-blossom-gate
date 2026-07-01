
ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_seller_user_id_fkey
  FOREIGN KEY (seller_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.pix_keys
  ADD CONSTRAINT pix_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
