DROP POLICY IF EXISTS "Managers manage fees for assigned sellers" ON public.custom_user_fees;
CREATE POLICY "Assigned staff read fees" ON public.custom_user_fees FOR SELECT TO authenticated USING(public.has_staff_permission(auth.uid(),'fees.edit') AND EXISTS(SELECT 1 FROM manager_seller_assignments WHERE manager_user_id=auth.uid() AND seller_user_id=custom_user_fees.user_id));
CREATE POLICY "Assigned staff insert fees" ON public.custom_user_fees FOR INSERT TO authenticated WITH CHECK(public.has_staff_permission(auth.uid(),'fees.edit') AND EXISTS(SELECT 1 FROM manager_seller_assignments WHERE manager_user_id=auth.uid() AND seller_user_id=custom_user_fees.user_id));
CREATE POLICY "Assigned staff update fees" ON public.custom_user_fees FOR UPDATE TO authenticated USING(public.has_staff_permission(auth.uid(),'fees.edit') AND EXISTS(SELECT 1 FROM manager_seller_assignments WHERE manager_user_id=auth.uid() AND seller_user_id=custom_user_fees.user_id)) WITH CHECK(public.has_staff_permission(auth.uid(),'fees.edit') AND EXISTS(SELECT 1 FROM manager_seller_assignments WHERE manager_user_id=auth.uid() AND seller_user_id=custom_user_fees.user_id));
DROP TRIGGER IF EXISTS trg_enforce_manager_fee_limits ON public.custom_user_fees;
CREATE TRIGGER trg_enforce_manager_fee_limits BEFORE INSERT OR UPDATE ON public.custom_user_fees FOR EACH ROW EXECUTE FUNCTION public.enforce_manager_fee_limits();
CREATE OR REPLACE FUNCTION app_private.enforce_staff_withdrawal_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
PERFORM 1 FROM profiles WHERE user_id=NEW.user_id FOR UPDATE;
IF EXISTS(SELECT 1 FROM seller_withdrawal_blocks WHERE seller_user_id=NEW.user_id AND active) AND (TG_OP='INSERT' OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','processing','completed','paid'))) THEN RAISE EXCEPTION 'Saques bloqueados para análise'; END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION app_private.guard_staff_permission_key() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$ BEGIN IF NOT app_private.staff_permission_allowed(NEW.permission_key) THEN RAISE EXCEPTION 'Unsupported staff permission'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION app_private.guard_staff_permission_key() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.staff_permission_allowed(text) TO authenticated,service_role;
CREATE TRIGGER guard_staff_permission_key BEFORE INSERT OR UPDATE ON public.staff_permissions FOR EACH ROW EXECUTE FUNCTION app_private.guard_staff_permission_key();