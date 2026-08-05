-- 1) financial_ledger: writes are service-role/edge-function only, made explicit
REVOKE INSERT, UPDATE, DELETE ON public.financial_ledger FROM authenticated;
REVOKE ALL ON public.financial_ledger FROM anon;
GRANT SELECT ON public.financial_ledger TO authenticated;
GRANT ALL ON public.financial_ledger TO service_role;

DROP POLICY IF EXISTS "service_insert_ledger" ON public.financial_ledger;
CREATE POLICY "deny_insert_ledger_non_service"
  ON public.financial_ledger AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_update_ledger" ON public.financial_ledger;
CREATE POLICY "deny_update_ledger_non_service"
  ON public.financial_ledger AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_delete_ledger" ON public.financial_ledger;
CREATE POLICY "deny_delete_ledger_non_service"
  ON public.financial_ledger AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

CREATE POLICY "service_role_manages_ledger"
  ON public.financial_ledger FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) manager_fee_limits: managers get read-only on this global config table
REVOKE INSERT, UPDATE, DELETE ON public.manager_fee_limits FROM authenticated;
REVOKE ALL ON public.manager_fee_limits FROM anon;
GRANT SELECT ON public.manager_fee_limits TO authenticated;
GRANT ALL ON public.manager_fee_limits TO service_role;

DROP POLICY IF EXISTS "Managers read fee limits" ON public.manager_fee_limits;
CREATE POLICY "Managers read global fee limits"
  ON public.manager_fee_limits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "deny_manager_writes_fee_limits"
  ON public.manager_fee_limits AS RESTRICTIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));