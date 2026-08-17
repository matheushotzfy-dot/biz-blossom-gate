CREATE OR REPLACE FUNCTION public.mask_acquirer_on_public_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.visibility, 'public') = 'public' THEN
    NEW.acquirer_slug := NULL;
    IF NEW.description IS NOT NULL THEN
      NEW.description := regexp_replace(NEW.description, '(veopag|podpay(_app)?)', 'HOTZFY', 'gi');
    END IF;
    IF NEW.metadata IS NOT NULL THEN
      NEW.metadata := NEW.metadata - 'acquirer' - 'from' - 'to' - 'gateway' - 'acquirer_slug';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mask_acquirer_on_public_events ON public.transaction_events;
CREATE TRIGGER trg_mask_acquirer_on_public_events
BEFORE INSERT OR UPDATE ON public.transaction_events
FOR EACH ROW EXECUTE FUNCTION public.mask_acquirer_on_public_events();

UPDATE public.transaction_events
SET acquirer_slug = NULL,
    description = regexp_replace(COALESCE(description,''), '(veopag|podpay(_app)?)', 'HOTZFY', 'gi'),
    metadata = COALESCE(metadata, '{}'::jsonb) - 'acquirer' - 'from' - 'to' - 'gateway' - 'acquirer_slug'
WHERE visibility = 'public';