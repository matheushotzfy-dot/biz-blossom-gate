
-- Remove sensitive tables from Realtime
-- Use DO block to handle tables that may not be in the publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.transactions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.withdrawals;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.affiliate_sales;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
