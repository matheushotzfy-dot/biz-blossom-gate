
-- =============================================
-- FIX #1: Isolate simulate-launch transactions
-- Add is_simulated flag so simulated data never affects real balances
-- =============================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;

-- Update balance calculation to exclude simulated transactions
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total_earned numeric;
  _total_withdrawn numeric;
  _adjustments numeric;
  _retained numeric;
  _available numeric;
  _frozen boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  SELECT COALESCE(balance_frozen, false) INTO _frozen
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  IF _frozen THEN
    RAISE EXCEPTION 'Saldo congelado. Saques bloqueados pelo administrador.';
  END IF;

  -- CRITICAL: Exclude simulated transactions from balance
  SELECT COALESCE(SUM(net_amount), 0) INTO _total_earned
  FROM public.transactions
  WHERE user_id = NEW.user_id AND status = 'completed' AND is_simulated = false;

  SELECT COALESCE(SUM(retained_amount), 0) INTO _retained
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND status = 'completed' 
    AND retention_released = false 
    AND retained_amount > 0
    AND is_simulated = false;

  SELECT COALESCE(SUM(amount), 0) INTO _total_withdrawn
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) INTO _adjustments
  FROM public.balance_adjustments
  WHERE user_id = NEW.user_id;

  _available := _total_earned - _retained + _adjustments - _total_withdrawn;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor de saque deve ser positivo';
  END IF;

  RETURN NEW;
END;
$function$;

-- Also update validate_withdrawal_balance to exclude simulated
CREATE OR REPLACE FUNCTION public.validate_withdrawal_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _available numeric;
  _completed_net numeric;
  _pending_withdrawals numeric;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0) INTO _completed_net 
  FROM public.transactions 
  WHERE user_id = NEW.user_id AND status = 'completed' AND is_simulated = false;
  
  SELECT COALESCE(SUM(amount), 0) INTO _pending_withdrawals 
  FROM public.withdrawals 
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved');
  
  _available := _completed_net - _pending_withdrawals;
  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(_available, 2);
  END IF;
  RETURN NEW;
END;
$function$;

-- =============================================
-- FIX #2: Strengthen role hierarchy
-- Prevent employee from escalating to manager/admin
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_is_admin boolean;
  _caller_is_manager boolean;
  _role_hierarchy jsonb := '{"user": 1, "employee": 2, "manager": 3, "admin": 4}'::jsonb;
  _target_level int;
  _caller_max_level int;
BEGIN
  -- Service role (system) can do anything
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _caller_is_admin := has_role(auth.uid(), 'admin'::app_role);
  _caller_is_manager := has_role(auth.uid(), 'manager'::app_role);

  -- Only admins and managers can manage roles
  IF NOT _caller_is_admin AND NOT _caller_is_manager THEN
    RAISE EXCEPTION 'Only admins and managers can manage roles';
  END IF;

  _target_level := COALESCE((_role_hierarchy ->> NEW.role::text)::int, 0);

  -- Managers can only assign user/employee (level <= 2)
  IF _caller_is_manager AND NOT _caller_is_admin THEN
    IF _target_level > 2 THEN
      RAISE EXCEPTION 'Managers cannot assign manager or admin roles';
    END IF;
  END IF;

  -- Even admins cannot self-assign admin role via UI
  -- Admin role assignment should only happen via service_role / migration
  IF NEW.role = 'admin'::app_role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Admin role can only be assigned by system administrator';
  END IF;

  -- Prevent anyone from modifying their own role
  IF NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify your own role';
  END IF;

  RETURN NEW;
END;
$function$;
