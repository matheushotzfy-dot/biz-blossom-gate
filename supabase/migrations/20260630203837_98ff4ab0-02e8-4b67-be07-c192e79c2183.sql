CREATE OR REPLACE FUNCTION public.security_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'security_audit_log is immutable (op=%)', TG_OP;
END;
$function$;