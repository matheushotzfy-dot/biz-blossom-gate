
CREATE OR REPLACE FUNCTION public.update_payment_link_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_link_id IS NOT NULL
     AND NEW.status IN ('approved','completed','paid')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.payment_links
      SET current_uses = current_uses + 1,
          total_revenue = total_revenue + NEW.amount,
          updated_at = now()
      WHERE id = NEW.payment_link_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_payment_link_stats ON public.transactions;
CREATE TRIGGER trg_update_payment_link_stats
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_link_stats();
