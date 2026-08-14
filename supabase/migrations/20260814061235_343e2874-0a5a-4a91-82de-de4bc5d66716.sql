CREATE OR REPLACE FUNCTION public.enforce_withdrawal_kill_switch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paused boolean;
BEGIN
  SELECT COALESCE((value ->> 'withdrawals')::boolean, false)
    INTO v_paused
  FROM public.platform_settings
  WHERE key = 'kill_switches';

  IF COALESCE(v_paused, false) THEN
    RAISE EXCEPTION 'Solicitações de saque estão temporariamente pausadas. Tente novamente mais tarde.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_withdrawal_kill_switch ON public.withdrawals;
CREATE TRIGGER trg_enforce_withdrawal_kill_switch
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_kill_switch();

REVOKE ALL ON FUNCTION public.enforce_withdrawal_kill_switch() FROM PUBLIC, anon, authenticated;