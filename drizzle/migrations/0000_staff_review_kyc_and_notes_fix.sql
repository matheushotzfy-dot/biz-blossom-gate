CREATE OR REPLACE FUNCTION app_private.staff_review_kyc(_seller uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','app_private' AS $$
DECLARE _uid uuid := auth.uid(); _status text; _r text := left(NULLIF(btrim(COALESCE(_reason,'')),''),500);
BEGIN
  IF _uid IS NULL OR _seller IS NULL OR _approve IS NULL THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT public.has_staff_permission(_uid, CASE WHEN _approve THEN 'kyc.approve' ELSE 'kyc.reject' END)
     OR (NOT public.has_role(_uid,'admin') AND NOT app_private.has_active_seller_assignment(_uid,_seller))
  THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT _approve AND (_r IS NULL OR length(_r) < 5) THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT account_status INTO _status FROM public.profiles WHERE user_id=_seller FOR UPDATE;
  IF NOT FOUND OR _status NOT IN ('pending','pending_review') THEN RAISE EXCEPTION 'Seller not pending review'; END IF;
  UPDATE public.profiles SET account_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         kyc_rejection_reason = CASE WHEN _approve THEN NULL ELSE _r END
   WHERE user_id=_seller;
  INSERT INTO public.staff_audit_log(staff_user_id,action,entity_type,entity_id,before,after)
  VALUES(_uid, CASE WHEN _approve THEN 'approve_kyc' ELSE 'reject_kyc' END,'seller',_seller::text,
         jsonb_build_object('status',_status), jsonb_build_object('status',CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,'reason',_r));
  INSERT INTO public.notifications(user_id,title,message,type,created_by)
  VALUES(_seller, CASE WHEN _approve THEN 'KYC aprovado' ELSE 'KYC recusado' END,
         CASE WHEN _approve THEN 'Seu cadastro foi aprovado. Você já pode operar normalmente na plataforma.'
              ELSE 'Seu cadastro foi recusado. Motivo: '||_r||'. Ajuste e reenvie a documentação.' END,
         CASE WHEN _approve THEN 'success' ELSE 'warning' END, _uid);
END $$;
CREATE OR REPLACE FUNCTION public.staff_review_kyc(_seller uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO 'public','app_private' AS $$ SELECT app_private.staff_review_kyc($1,$2,$3) $$;
REVOKE ALL ON FUNCTION public.staff_review_kyc(uuid,boolean,text), app_private.staff_review_kyc(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_review_kyc(uuid,boolean,text), app_private.staff_review_kyc(uuid,boolean,text) TO authenticated;

DROP POLICY IF EXISTS "Assigned staff add scoped seller notes" ON public.seller_notes;
DROP POLICY IF EXISTS "Assigned staff read scoped seller notes" ON public.seller_notes;
CREATE POLICY "Assigned staff add scoped seller notes" ON public.seller_notes FOR INSERT TO authenticated
WITH CHECK (public.has_staff_permission(auth.uid(),'sellers.edit') AND author_user_id=auth.uid() AND app_private.has_active_seller_assignment(auth.uid(),seller_user_id));
CREATE POLICY "Assigned staff read scoped seller notes" ON public.seller_notes FOR SELECT TO authenticated
USING (public.has_staff_permission(auth.uid(),'sellers.edit') AND app_private.has_active_seller_assignment(auth.uid(),seller_user_id) AND created_at >= app_private.assignment_started_at(auth.uid(),seller_user_id));