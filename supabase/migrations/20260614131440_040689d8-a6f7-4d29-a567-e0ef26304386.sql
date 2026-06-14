
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_processed_by ON public.withdrawals(processed_by);

CREATE OR REPLACE FUNCTION public.protect_withdrawal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status != 'pending' AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'Cannot change withdrawal status from % to %', OLD.status, NEW.status;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal status: %', NEW.status;
  END IF;
  IF NEW.status = 'rejected' AND (NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) < 3) THEN
    RAISE EXCEPTION 'Motivo da rejeição é obrigatório (mín. 3 caracteres)';
  END IF;
  IF NEW.status IN ('approved','rejected') AND OLD.processed_at IS NULL THEN
    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS won_by_seller boolean;

CREATE INDEX IF NOT EXISTS idx_disputes_type_status ON public.disputes(type, status);
