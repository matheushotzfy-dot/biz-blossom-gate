-- Reuse the existing prevent_audit_mutation() function (já criado para security_audit_log)
DROP TRIGGER IF EXISTS trg_audit_logs_no_mutation ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- Defense in depth: revoke UPDATE/DELETE even from service_role at the SQL grant level.
-- (Trigger ainda barra qualquer caso onde o grant escape, ex: superuser de manutenção.)
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon, service_role;
REVOKE UPDATE, DELETE ON public.security_audit_log FROM authenticated, anon, service_role;

-- Garantir INSERT permanece (service_role grava via RPC):
GRANT INSERT, SELECT ON public.audit_logs TO service_role;
GRANT INSERT, SELECT ON public.security_audit_log TO service_role;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.security_audit_log TO authenticated;