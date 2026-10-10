CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 -- Internal/service updates (no end-user session) and admins pass through.
 IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin'::app_role) THEN RETURN NEW; END IF;
 -- Trusted server routine (mark_kyc_submitted) may move pending/rejected -> pending_review only.
 IF current_setting('app.kyc_submit', true) = 'on'
    AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review' THEN
   NULL;
 ELSE
   NEW.account_status:=OLD.account_status;
 END IF;
 NEW.staff_role_type:=OLD.staff_role_type;
 NEW.balance_frozen:=OLD.balance_frozen;
 NEW.frozen:=OLD.frozen;
 NEW.approved_by:=OLD.approved_by;
 NEW.credit_card_enabled:=OLD.credit_card_enabled;
 NEW.boleto_enabled:=OLD.boleto_enabled;
 NEW.kyc_rejection_reason:=OLD.kyc_rejection_reason;
 NEW.admin_notes:=OLD.admin_notes;
 NEW.user_id:=OLD.user_id;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF NOT (current_setting('app.kyc_submit', true) = 'on'
            AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review') THEN
      NEW.account_status := OLD.account_status;
    END IF;
    NEW.seller_type := OLD.seller_type;
    NEW.admin_notes := OLD.admin_notes;
    NEW.acquirer_id := OLD.acquirer_id;
    NEW.last_ip := OLD.last_ip;
    NEW.balance_frozen := OLD.balance_frozen;
    NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
    NEW.frozen := OLD.frozen;
    NEW.staff_role_type := OLD.staff_role_type;
    NEW.created_by_admin := OLD.created_by_admin;
  END IF;
  IF OLD.document_number IS NOT NULL AND OLD.document_number != '' THEN
    NEW.document_number := OLD.document_number;
    NEW.document_type := OLD.document_type;
  END IF;
  IF OLD.full_name IS NOT NULL AND OLD.full_name != '' THEN NEW.full_name := OLD.full_name; END IF;
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN NEW.email := OLD.email; END IF;
  IF OLD.phone IS NOT NULL AND OLD.phone != '' THEN NEW.phone := OLD.phone; END IF;
  IF OLD.approved_by IS NOT NULL THEN NEW.approved_by := OLD.approved_by; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_caller, 'admin'::app_role) OR public.has_role(_caller, 'manager'::app_role) THEN RETURN NEW; END IF;
  NEW.id := OLD.id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
  IF current_setting('app.kyc_submit', true) = 'on'
     AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review' THEN
    NULL;
  ELSIF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida' USING ERRCODE='insufficient_privilege', HINT='profile_restricted_field';
  END IF;
  IF NEW.frozen IS DISTINCT FROM OLD.frozen
     OR NEW.balance_frozen IS DISTINCT FROM OLD.balance_frozen
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason
     OR NEW.address_locked IS DISTINCT FROM OLD.address_locked
     OR NEW.boleto_enabled IS DISTINCT FROM OLD.boleto_enabled
     OR NEW.credit_card_enabled IS DISTINCT FROM OLD.credit_card_enabled
     OR NEW.acquirer_id IS DISTINCT FROM OLD.acquirer_id
     OR NEW.seller_type IS DISTINCT FROM OLD.seller_type
     OR NEW.staff_role_type IS DISTINCT FROM OLD.staff_role_type
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.created_by_admin IS DISTINCT FROM OLD.created_by_admin
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida' USING ERRCODE='insufficient_privilege', HINT='profile_restricted_field';
  END IF;
  NEW.email := OLD.email; NEW.last_ip := OLD.last_ip; NEW.last_login_at := OLD.last_login_at;
  NEW.pix_key_masked := OLD.pix_key_masked; NEW.pix_key_enc := COALESCE(NEW.pix_key_enc, OLD.pix_key_enc);
  IF COALESCE(OLD.address_locked, false) = true THEN
    IF NEW.street IS DISTINCT FROM OLD.street OR NEW.street_number IS DISTINCT FROM OLD.street_number
       OR NEW.complement IS DISTINCT FROM OLD.complement OR NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
       OR NEW.city IS DISTINCT FROM OLD.city OR NEW.state IS DISTINCT FROM OLD.state OR NEW.zip_code IS DISTINCT FROM OLD.zip_code THEN
      RAISE EXCEPTION 'Endereço travado: contate o suporte para alterar' USING ERRCODE='insufficient_privilege', HINT='address_locked';
    END IF;
  END IF;
  IF OLD.document_number IS NOT NULL AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
    RAISE EXCEPTION 'Documento já cadastrado não pode ser alterado' USING ERRCODE='insufficient_privilege', HINT='document_locked';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app_private.mark_kyc_submitted()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _docs int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT count(*) INTO _docs FROM storage.objects o
   WHERE o.bucket_id = 'kyc-documents' AND (storage.foldername(o.name))[1] = _uid::text;
  IF _docs = 0 THEN RAISE EXCEPTION 'no_documents_uploaded'; END IF;
  PERFORM set_config('app.kyc_submit', 'on', true);
  UPDATE public.profiles SET account_status = 'pending_review'
   WHERE user_id = _uid AND account_status IN ('pending', 'rejected');
  PERFORM set_config('app.kyc_submit', 'off', true);
END $$;

UPDATE public.profiles p SET account_status='pending'
 WHERE account_status='pending_review'
   AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='kyc-documents' AND (storage.foldername(o.name))[1]=p.user_id::text);