-- Verificação de identidade (KYC): envio de documentos e análise.
--
-- O que muda:
-- 1. Histórico de envios (`kyc_submissions`): cada "Enviar para análise" vira uma linha com os arquivos daquele
--    momento; a decisão (aprovada/recusada, quem, quando, motivo) é gravada por gatilho em `profiles`.
-- 2. `mark_kyc_submitted` passa a exigir TODOS os documentos obrigatórios (frente, verso, selfie e, para CNPJ,
--    o cartão CNPJ). Antes bastava um arquivo qualquer na pasta.
-- 3. Os documentos só podem ser enviados/apagados enquanto a conta pode editar (pendente ou reprovada). Antes o
--    seller trocava as fotos durante a análise e até depois de aprovado, apagando a prova usada na aprovação.
-- 4. A equipe com permissão de KYC e o seller atribuído passa a VER os documentos (antes aprovava às cegas: o
--    storage só liberava o admin) e a aprovação/recusa da equipe passa a valer: os gatilhos de `profiles`
--    desfaziam em silêncio a mudança de status feita por quem não é admin, mas a notificação "KYC aprovado"
--    era enviada mesmo assim. A equipe só decide conta em análise (com envio); antes aprovava conta sem documento.
-- 5. PDF aceito (CNH digital e cartão CNPJ saem em PDF); HEIC sai da lista (o navegador do admin não abre).
-- 6. Fila de análise do admin (`get_admin_kyc_queue`) e ficha de análise (`get_kyc_review`).
-- 7. `admin_reject_kyc` exige motivo de verdade (≥ 5 caracteres), como a tela.
-- 8. Conta reprovada precisa trocar pelo menos um arquivo antes de reenviar (`kyc_unchanged`).

-- ───────────────────────── histórico de envios ─────────────────────────

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  document_type text NOT NULL DEFAULT 'cpf',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_reason text,
  CONSTRAINT kyc_submissions_status_ok CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  CONSTRAINT kyc_submissions_doc_type_ok CHECK (document_type IN ('cpf', 'cnpj')),
  CONSTRAINT kyc_submissions_docs_array CHECK (jsonb_typeof(documents) = 'array'),
  CONSTRAINT kyc_submissions_reason_len CHECK (review_reason IS NULL OR char_length(review_reason) <= 500)
);

CREATE INDEX IF NOT EXISTS kyc_submissions_user_idx ON public.kyc_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS kyc_submissions_pending_idx ON public.kyc_submissions (submitted_at) WHERE status = 'pending';

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kyc_submissions FROM anon, authenticated;
GRANT SELECT ON public.kyc_submissions TO authenticated;

-- ───────────────────────── funções de apoio ─────────────────────────

-- Quem pode analisar a verificação de um seller: o admin, ou alguém da equipe com permissão de KYC e com o seller atribuído.
CREATE OR REPLACE FUNCTION app_private.can_review_kyc(_reviewer uuid, _seller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
  SELECT _reviewer IS NOT NULL AND _seller IS NOT NULL AND (
    app_private.has_role(_reviewer, 'admin'::app_role)
    OR (
      (app_private.has_staff_permission(_reviewer, 'kyc.approve') OR app_private.has_staff_permission(_reviewer, 'kyc.reject'))
      AND app_private.has_active_seller_assignment(_reviewer, _seller)
    )
  );
$function$;

-- O dono só mexe nos documentos enquanto a conta está pendente ou reprovada.
CREATE OR REPLACE FUNCTION app_private.kyc_docs_editable(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _uid AND account_status IN ('pending', 'rejected')
  );
$function$;

-- Dono da pasta no bucket (`<uuid>/arquivo`); caminho fora do formato não tem dono.
CREATE OR REPLACE FUNCTION app_private.kyc_folder_owner(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN split_part(_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(_name, '/', 1)::uuid END;
$function$;

-- Documentos obrigatórios por tipo de conta.
CREATE OR REPLACE FUNCTION app_private.kyc_required_types(_document_type text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN _document_type = 'cnpj'
              THEN ARRAY['front', 'back', 'selfie', 'cnpj_card']
              ELSE ARRAY['front', 'back', 'selfie'] END;
$function$;

-- Arquivo mais recente de cada tipo na pasta do seller (o mesmo critério da tela).
CREATE OR REPLACE FUNCTION app_private.kyc_current_documents(_uid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', d.doc_type,
           'name', d.file_name,
           'path', d.name,
           'size', d.size,
           'mime', d.mime,
           'etag', d.etag,
           'uploaded_at', d.created_at
         ) ORDER BY array_position(ARRAY['front', 'back', 'selfie', 'cnpj_card'], d.doc_type)), '[]'::jsonb)
    FROM (
      SELECT DISTINCT ON (t.doc_type) t.doc_type, o.name, split_part(o.name, '/', 2) AS file_name,
             NULLIF(o.metadata->>'size', '')::bigint AS size, o.metadata->>'mimetype' AS mime,
             btrim(o.metadata->>'eTag', '"') AS etag, o.created_at
        FROM storage.objects o
        CROSS JOIN LATERAL (SELECT substring(split_part(o.name, '/', 2) FROM '^(front|back|selfie|cnpj_card)[._]') AS doc_type) t
       WHERE o.bucket_id = 'kyc-documents'
         AND split_part(o.name, '/', 1) = _uid::text
         AND t.doc_type IS NOT NULL
       ORDER BY t.doc_type, o.created_at DESC
    ) d;
$function$;

REVOKE ALL ON FUNCTION app_private.can_review_kyc(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.kyc_docs_editable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.kyc_folder_owner(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.kyc_required_types(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.kyc_current_documents(uuid) FROM PUBLIC, anon, authenticated;
-- As políticas de RLS e de storage chamam estas com o papel de quem está logado.
GRANT EXECUTE ON FUNCTION app_private.can_review_kyc(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.kyc_docs_editable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.kyc_folder_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.kyc_required_types(text) TO authenticated;

DROP POLICY IF EXISTS "Owner reads own kyc submissions" ON public.kyc_submissions;
CREATE POLICY "Owner reads own kyc submissions" ON public.kyc_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Reviewers read kyc submissions" ON public.kyc_submissions;
CREATE POLICY "Reviewers read kyc submissions" ON public.kyc_submissions
  FOR SELECT TO authenticated USING (app_private.can_review_kyc(auth.uid(), user_id));

-- ───────────────────────── storage: bucket e políticas ─────────────────────────

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
       file_size_limit = 10485760
 WHERE id = 'kyc-documents';

DROP POLICY IF EXISTS "Users can upload own KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "KYC: dono envia enquanto pode editar" ON storage.objects;
DROP POLICY IF EXISTS "KYC: dono apaga enquanto pode editar" ON storage.objects;
DROP POLICY IF EXISTS "KYC: dono e quem analisa leem" ON storage.objects;

-- Envio: só na própria pasta, só com nome no formato do painel (`front_ab12cd34.jpg`) e só enquanto a conta pode editar.
-- Não há política de UPDATE: um arquivo enviado não é sobrescrito, o painel sobe um novo e apaga o antigo.
CREATE POLICY "KYC: dono envia enquanto pode editar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND app_private.kyc_folder_owner(name) = auth.uid()
    AND split_part(name, '/', 2) ~ '^(front|back|selfie|cnpj_card)_[A-Za-z0-9]{4,32}\.(jpg|png|webp|pdf)$'
    AND split_part(name, '/', 3) = ''
    AND app_private.kyc_docs_editable(auth.uid())
  );

CREATE POLICY "KYC: dono apaga enquanto pode editar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND app_private.kyc_folder_owner(name) = auth.uid()
    AND app_private.kyc_docs_editable(auth.uid())
  );

CREATE POLICY "KYC: dono e quem analisa leem" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      app_private.kyc_folder_owner(name) = auth.uid()
      OR app_private.can_review_kyc(auth.uid(), app_private.kyc_folder_owner(name))
    )
  );

-- ───────────────────────── gatilhos de profiles ─────────────────────────
-- Mesmos corpos de antes; a única novidade é a bandeira `app.kyc_review`, ligada só por `staff_review_kyc`
-- (SECURITY DEFINER, que já confere permissão e atribuição), para a decisão da equipe valer.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _staff_review boolean := current_setting('app.kyc_review', true) = 'on'
    AND OLD.account_status = 'pending_review' AND NEW.account_status IN ('approved', 'rejected');
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF NOT (current_setting('app.kyc_submit', true) = 'on'
            AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review')
       AND NOT _staff_review THEN
      NEW.account_status := OLD.account_status;
    END IF;
    NEW.seller_type := OLD.seller_type;
    NEW.admin_notes := OLD.admin_notes;
    NEW.acquirer_id := OLD.acquirer_id;
    NEW.last_ip := OLD.last_ip;
    NEW.balance_frozen := OLD.balance_frozen;
    IF NOT _staff_review THEN
      NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
    END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _staff_review boolean := current_setting('app.kyc_review', true) = 'on'
    AND OLD.account_status = 'pending_review' AND NEW.account_status IN ('approved', 'rejected');
BEGIN
  IF _caller IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_caller, 'admin'::app_role) OR public.has_role(_caller, 'manager'::app_role) THEN RETURN NEW; END IF;
  NEW.id := OLD.id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
  IF current_setting('app.kyc_submit', true) = 'on'
     AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review' THEN
    NULL;
  ELSIF _staff_review THEN
    NULL;
  ELSIF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida' USING ERRCODE='insufficient_privilege', HINT='profile_restricted_field';
  END IF;
  IF NEW.frozen IS DISTINCT FROM OLD.frozen
     OR NEW.balance_frozen IS DISTINCT FROM OLD.balance_frozen
     OR (NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason AND NOT _staff_review)
     OR (NEW.address_locked IS DISTINCT FROM OLD.address_locked
         AND NOT (COALESCE(OLD.address_locked, false) = false AND NEW.address_locked = true))
     OR NEW.boleto_enabled IS DISTINCT FROM OLD.boleto_enabled
     OR NEW.credit_card_enabled IS DISTINCT FROM OLD.credit_card_enabled
     OR NEW.acquirer_id IS DISTINCT FROM OLD.acquirer_id
     OR NEW.seller_type IS DISTINCT FROM OLD.seller_type
     OR NEW.staff_role_type IS DISTINCT FROM OLD.staff_role_type
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.created_by_admin IS DISTINCT FROM OLD.created_by_admin
     OR (NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NOT _staff_review) THEN
    RAISE EXCEPTION 'Alteração de campo administrativo não permitida' USING ERRCODE='insufficient_privilege', HINT='profile_restricted_field';
  END IF;
  NEW.email := OLD.email; NEW.last_ip := OLD.last_ip; NEW.last_login_at := OLD.last_login_at;
  IF COALESCE(OLD.address_locked, false) = true THEN
    IF NEW.street IS DISTINCT FROM OLD.street OR NEW.street_number IS DISTINCT FROM OLD.street_number
       OR NEW.complement IS DISTINCT FROM OLD.complement OR NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
       OR NEW.city IS DISTINCT FROM OLD.city OR NEW.state IS DISTINCT FROM OLD.state OR NEW.zip_code IS DISTINCT FROM OLD.zip_code THEN
      RAISE EXCEPTION 'Endereço travado: contate o suporte para alterar' USING ERRCODE='insufficient_privilege', HINT='address_locked';
    END IF;
  END IF;
  IF OLD.document_number_enc IS NOT NULL THEN
    IF NEW.document_number IS NOT NULL AND btrim(NEW.document_number) <> '' THEN
      RAISE EXCEPTION 'Documento já cadastrado não pode ser alterado' USING ERRCODE='insufficient_privilege', HINT='document_locked';
    END IF;
    NEW.document_type := OLD.document_type;
  END IF;
  NEW.document_number_enc := OLD.document_number_enc;
  NEW.document_number_masked := OLD.document_number_masked;
  NEW.document_number_fingerprint := OLD.document_number_fingerprint;
  NEW.pix_key_enc := OLD.pix_key_enc;
  NEW.pix_key_masked := OLD.pix_key_masked;
  RETURN NEW;
END $function$;

-- Terceiro guarda de `profiles` (roda depois dos dois acima): também desfazia a decisão da equipe.
CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _staff_review boolean := current_setting('app.kyc_review', true) = 'on'
    AND OLD.account_status = 'pending_review' AND NEW.account_status IN ('approved', 'rejected');
BEGIN
 -- Internal/service updates (no end-user session) and admins pass through.
 IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin'::app_role) THEN RETURN NEW; END IF;
 -- Trusted server routines: mark_kyc_submitted (pending/rejected -> pending_review) and staff_review_kyc
 -- (pending_review -> approved/rejected, with reason and approver).
 IF current_setting('app.kyc_submit', true) = 'on'
    AND OLD.account_status IN ('pending','rejected') AND NEW.account_status = 'pending_review' THEN
   NULL;
 ELSIF _staff_review THEN
   NULL;
 ELSE
   NEW.account_status:=OLD.account_status;
 END IF;
 NEW.staff_role_type:=OLD.staff_role_type;
 NEW.balance_frozen:=OLD.balance_frozen;
 NEW.frozen:=OLD.frozen;
 IF NOT _staff_review THEN
   NEW.approved_by:=OLD.approved_by;
   NEW.kyc_rejection_reason:=OLD.kyc_rejection_reason;
 END IF;
 NEW.credit_card_enabled:=OLD.credit_card_enabled;
 NEW.boleto_enabled:=OLD.boleto_enabled;
 NEW.admin_notes:=OLD.admin_notes;
 NEW.user_id:=OLD.user_id;
 RETURN NEW;
END $function$;

-- Gatilhos repetidos em profiles (a mesma função rodava duas vezes a cada UPDATE).
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

-- ───────────────────────── envio para análise ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.mark_kyc_submitted()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
  _doc_type text;
  _docs jsonb;
  _sub jsonb;
  _missing text[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT account_status, CASE WHEN document_type = 'cnpj' THEN 'cnpj' ELSE 'cpf' END
    INTO _status, _doc_type
    FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  -- Já está em análise: segundo clique (ou outra aba) não faz nada.
  IF _status = 'pending_review' THEN RETURN; END IF;
  IF _status IS DISTINCT FROM 'pending' AND _status IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'kyc_not_editable';
  END IF;

  _docs := app_private.kyc_current_documents(_uid);
  SELECT array_agg(t ORDER BY ord) INTO _missing
    FROM unnest(app_private.kyc_required_types(_doc_type)) WITH ORDINALITY AS r(t, ord)
   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_docs) d WHERE d->>'type' = r.t);
  IF _missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing_documents:%', array_to_string(_missing, ',');
  END IF;

  _sub := (SELECT jsonb_agg(d) FROM jsonb_array_elements(_docs) d
             WHERE d->>'type' = ANY (app_private.kyc_required_types(_doc_type)));

  -- Reprovada: reenviar exatamente os mesmos arquivos só voltaria para a fila com o mesmo problema.
  IF _status = 'rejected' AND EXISTS (
       SELECT 1 FROM (SELECT k.documents FROM public.kyc_submissions k
                       WHERE k.user_id = _uid ORDER BY k.submitted_at DESC LIMIT 1) last
        WHERE (SELECT array_agg(x->>'path' ORDER BY x->>'path') FROM jsonb_array_elements(last.documents) x)
            = (SELECT array_agg(x->>'path' ORDER BY x->>'path') FROM jsonb_array_elements(_sub) x)
     ) THEN
    RAISE EXCEPTION 'kyc_unchanged';
  END IF;

  UPDATE public.kyc_submissions SET status = 'superseded' WHERE user_id = _uid AND status = 'pending';
  INSERT INTO public.kyc_submissions (user_id, document_type, documents) VALUES (_uid, _doc_type, _sub);

  PERFORM set_config('app.kyc_submit', 'on', true);
  UPDATE public.profiles SET account_status = 'pending_review' WHERE user_id = _uid;
  PERFORM set_config('app.kyc_submit', 'off', true);
END $function$;

-- A decisão (de qualquer caminho: admin, equipe, ajuste manual) fecha o envio que estava esperando.
CREATE OR REPLACE FUNCTION app_private.record_kyc_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status AND NEW.account_status IN ('approved', 'rejected') THEN
    UPDATE public.kyc_submissions
       SET status = NEW.account_status,
           reviewed_at = now(),
           reviewed_by = auth.uid(),
           review_reason = CASE WHEN NEW.account_status = 'rejected' THEN left(NEW.kyc_rejection_reason, 500) END
     WHERE id = (SELECT id FROM public.kyc_submissions
                  WHERE user_id = NEW.user_id AND status = 'pending'
                  ORDER BY submitted_at DESC LIMIT 1);
  END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_zz_record_kyc_decision ON public.profiles;
CREATE TRIGGER trg_zz_record_kyc_decision
  AFTER UPDATE OF account_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.record_kyc_decision();

-- Contas que já estão em análise ganham uma linha de envio com o que está na pasta (data = última mudança do perfil).
INSERT INTO public.kyc_submissions (user_id, submitted_at, document_type, documents)
SELECT p.user_id, COALESCE(p.updated_at, now()), CASE WHEN p.document_type = 'cnpj' THEN 'cnpj' ELSE 'cpf' END,
       app_private.kyc_current_documents(p.user_id)
  FROM public.profiles p
 WHERE p.account_status = 'pending_review'
   AND NOT EXISTS (SELECT 1 FROM public.kyc_submissions s WHERE s.user_id = p.user_id AND s.status = 'pending');

-- ───────────────────────── decisões ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.staff_review_kyc(_seller uuid, _approve boolean, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _uid uuid := auth.uid(); _status text; _r text := left(NULLIF(btrim(regexp_replace(COALESCE(_reason,''), '[[:cntrl:]]+', ' ', 'g')),''),500);
BEGIN
  IF _uid IS NULL OR _seller IS NULL OR _approve IS NULL THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT public.has_staff_permission(_uid, CASE WHEN _approve THEN 'kyc.approve' ELSE 'kyc.reject' END)
     OR (NOT public.has_role(_uid,'admin') AND NOT app_private.has_active_seller_assignment(_uid,_seller))
  THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT _approve AND (_r IS NULL OR length(_r) < 5) THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT account_status INTO _status FROM public.profiles WHERE user_id=_seller FOR UPDATE;
  -- Só decide o que o seller enviou para análise: sem envio não há documento para conferir.
  IF NOT FOUND OR _status <> 'pending_review' THEN RAISE EXCEPTION 'Seller not pending review'; END IF;

  PERFORM set_config('app.kyc_review', 'on', true);
  UPDATE public.profiles SET account_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         kyc_rejection_reason = CASE WHEN _approve THEN NULL ELSE _r END,
         approved_by = CASE WHEN _approve THEN COALESCE(approved_by, _uid) ELSE approved_by END
   WHERE user_id=_seller;
  PERFORM set_config('app.kyc_review', 'off', true);

  -- Confere que a mudança valeu antes de avisar o seller (antes a notificação saía mesmo quando nada mudava).
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _seller
                  AND account_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END) THEN
    RAISE EXCEPTION 'KYC decision not applied';
  END IF;

  INSERT INTO public.staff_audit_log(staff_user_id,action,entity_type,entity_id,before,after)
  VALUES(_uid, CASE WHEN _approve THEN 'approve_kyc' ELSE 'reject_kyc' END,'seller',_seller::text,
         jsonb_build_object('status',_status), jsonb_build_object('status',CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,'reason',_r));
  INSERT INTO public.notifications(user_id,title,message,type,created_by)
  VALUES(_seller, CASE WHEN _approve THEN 'KYC aprovado' ELSE 'KYC recusado' END,
         CASE WHEN _approve THEN 'Seu cadastro foi aprovado. Você já pode operar normalmente na plataforma.'
              ELSE 'Seu cadastro foi recusado. Motivo: '||rtrim(_r,'.!? ')||'. Ajuste e reenvie a documentação.' END,
         CASE WHEN _approve THEN 'success' ELSE 'warning' END, _uid);
END $function$;

CREATE OR REPLACE FUNCTION app_private.admin_reject_kyc(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _r text := left(NULLIF(btrim(regexp_replace(COALESCE(_reason, ''), '[[:cntrl:]]+', ' ', 'g')), ''), 500);
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF _r IS NULL OR char_length(_r) < 5 THEN
    RAISE EXCEPTION 'Reason required';
  END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'seller not found'; END IF;

  UPDATE public.profiles
     SET account_status = 'rejected',
         kyc_rejection_reason = _r
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (_caller, 'reject_kyc', 'profile', _user_id::text,
          jsonb_build_object('reason', _r));

  INSERT INTO public.notifications (user_id, title, message, type, created_by)
  VALUES (_user_id, 'KYC recusado',
          'Seu cadastro foi recusado. Motivo: ' || rtrim(_r, '.!? ') || '. Ajuste e reenvie a documentação.',
          'warning', _caller);
END;
$function$;

-- ───────────────────────── fila e ficha de análise ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_kyc_queue(
  _status text DEFAULT 'pending_review',
  _search text DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _st text := COALESCE(NULLIF(_status, ''), 'pending_review');
  _q text := NULLIF(btrim(COALESCE(_search, '')), '');
  _size int := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  _offset int := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  _items jsonb;
  _total int;
  _summary jsonb;
  _like text;
  _digits text;
BEGIN
  IF _st NOT IN ('pending_review', 'pending', 'rejected', 'approved', 'all') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF _q IS NOT NULL AND char_length(_q) > 120 THEN _q := left(_q, 120); END IF;
  -- % e _ digitados são texto, não curinga.
  _like := '%' || replace(replace(replace(COALESCE(_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  _digits := NULLIF(regexp_replace(COALESCE(_q, ''), '\D', '', 'g'), '');
  IF _digits IS NOT NULL AND char_length(_digits) < 3 THEN _digits := NULL; END IF;

  WITH sellers AS (
    SELECT p.user_id, p.full_name, p.nickname, p.email, p.document_type, p.document_number_masked, p.account_status,
           p.created_at, p.updated_at, p.kyc_rejection_reason,
           s.submitted_at, s.status AS submission_status,
           (SELECT count(*) FROM public.kyc_submissions k WHERE k.user_id = p.user_id AND k.status <> 'superseded') AS attempts
      FROM public.profiles p
      LEFT JOIN LATERAL (
        SELECT k.submitted_at, k.status FROM public.kyc_submissions k
         WHERE k.user_id = p.user_id ORDER BY k.submitted_at DESC LIMIT 1
      ) s ON true
     WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'employee', 'manager', 'partner'))
       AND (_st = 'all' OR p.account_status = _st)
       AND (_q IS NULL OR p.full_name ILIKE _like OR p.email ILIKE _like OR p.nickname ILIKE _like
            OR (_digits IS NOT NULL AND regexp_replace(COALESCE(p.document_number_masked, ''), '\D', '', 'g') LIKE '%' || _digits || '%'))
  )
  SELECT
    (SELECT count(*) FROM sellers),
    COALESCE((SELECT jsonb_agg(row_to_json(x)::jsonb) FROM (
      SELECT s.*,
             (SELECT count(*) FROM jsonb_array_elements(app_private.kyc_current_documents(s.user_id))) AS documents_uploaded,
             cardinality(app_private.kyc_required_types(CASE WHEN s.document_type = 'cnpj' THEN 'cnpj' ELSE 'cpf' END)) AS documents_required
        FROM sellers s
       ORDER BY
         CASE WHEN s.account_status = 'pending_review' THEN 0 ELSE 1 END,
         CASE WHEN s.account_status = 'pending_review' THEN COALESCE(s.submitted_at, s.updated_at) END ASC NULLS LAST,
         COALESCE(s.submitted_at, s.updated_at, s.created_at) DESC,
         s.user_id
       LIMIT _size OFFSET _offset
    ) x), '[]'::jsonb)
  INTO _total, _items;

  SELECT jsonb_build_object(
    'pending_review', count(*) FILTER (WHERE p.account_status = 'pending_review'),
    'pending', count(*) FILTER (WHERE p.account_status = 'pending'),
    'rejected', count(*) FILTER (WHERE p.account_status = 'rejected'),
    'approved', count(*) FILTER (WHERE p.account_status = 'approved'),
    'oldest_waiting_at', (SELECT min(k.submitted_at) FROM public.kyc_submissions k
                           JOIN public.profiles pp ON pp.user_id = k.user_id AND pp.account_status = 'pending_review'
                          WHERE k.status = 'pending'),
    'decided_7d', (SELECT count(*) FROM public.kyc_submissions k WHERE k.reviewed_at >= now() - interval '7 days'),
    'approved_7d', (SELECT count(*) FROM public.kyc_submissions k WHERE k.reviewed_at >= now() - interval '7 days' AND k.status = 'approved')
  ) INTO _summary
    FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'employee', 'manager', 'partner'));

  RETURN jsonb_build_object('items', _items, 'total', _total, 'summary', _summary);
END $function$;

-- Ficha para quem analisa (admin ou equipe atribuída com permissão de KYC). Traz o documento completo para
-- comparar com a foto; por isso cada abertura fica registrada e há limite de aberturas.
CREATE OR REPLACE FUNCTION app_private.get_kyc_review(_seller uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private', 'extensions'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean := app_private.has_role(auth.uid(), 'admin'::app_role);
  _allowed boolean;
  _p public.profiles%ROWTYPE;
  _doc text;
BEGIN
  IF NOT app_private.can_review_kyc(_uid, _seller) THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT rl.allowed INTO _allowed FROM public.bump_rate_limit('kyc_review_open:' || _uid::text, 600, 120) rl LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN RAISE EXCEPTION 'rate limit exceeded'; END IF;

  SELECT * INTO _p FROM public.profiles WHERE user_id = _seller;
  IF NOT FOUND THEN RAISE EXCEPTION 'seller not found'; END IF;
  _doc := COALESCE(extensions.pgp_sym_decrypt(_p.document_number_enc, encode(app_private.get_key('field_v1'), 'hex')), _p.document_number);

  IF _is_admin THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, details)
    VALUES (_uid, 'kyc_review_open', 'profile', _seller::text, jsonb_build_object('fields', jsonb_build_array('document_number', 'kyc_documents')));
  ELSE
    INSERT INTO public.staff_audit_log (staff_user_id, action, entity_type, entity_id, before, after)
    VALUES (_uid, 'kyc_review_open', 'seller', _seller::text, NULL, jsonb_build_object('fields', jsonb_build_array('document_number', 'kyc_documents')));
  END IF;

  RETURN jsonb_build_object(
    'seller', jsonb_build_object(
      'user_id', _p.user_id, 'full_name', _p.full_name, 'nickname', _p.nickname, 'email', _p.email, 'phone', _p.phone,
      'document_type', CASE WHEN _p.document_type = 'cnpj' THEN 'cnpj' ELSE 'cpf' END, 'document_number', _doc,
      'account_status', _p.account_status, 'kyc_rejection_reason', _p.kyc_rejection_reason,
      'created_at', _p.created_at, 'last_login_at', _p.last_login_at,
      'street', _p.street, 'street_number', _p.street_number, 'complement', _p.complement, 'neighborhood', _p.neighborhood,
      'city', _p.city, 'state', _p.state, 'zip_code', _p.zip_code,
      'company_name', (SELECT i.company_name FROM public.seller_signup_info i WHERE i.user_id = _p.user_id)
    ),
    'documents', app_private.kyc_current_documents(_seller),
    'required', to_jsonb(app_private.kyc_required_types(CASE WHEN _p.document_type = 'cnpj' THEN 'cnpj' ELSE 'cpf' END)),
    'submissions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', k.id, 'submitted_at', k.submitted_at, 'status', k.status, 'documents', k.documents,
               'reviewed_at', k.reviewed_at, 'review_reason', k.review_reason,
               'reviewer', CASE WHEN k.reviewed_by IS NULL THEN NULL
                                ELSE COALESCE((SELECT NULLIF(btrim(rp.full_name), '') FROM public.profiles rp WHERE rp.user_id = k.reviewed_by), 'Equipe') END
             ) ORDER BY k.submitted_at DESC)
        FROM (SELECT * FROM public.kyc_submissions WHERE user_id = _seller ORDER BY submitted_at DESC LIMIT 10) k
    ), '[]'::jsonb),
    'can_approve', _is_admin OR app_private.has_staff_permission(_uid, 'kyc.approve'),
    'can_reject', _is_admin OR app_private.has_staff_permission(_uid, 'kyc.reject'),
    'is_admin', _is_admin
  );
END $function$;

REVOKE ALL ON FUNCTION app_private.mark_kyc_submitted() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_kyc_submitted() FROM PUBLIC, anon;
-- O wrapper público é SECURITY INVOKER: quem chama precisa de EXECUTE nas duas pontas.
GRANT EXECUTE ON FUNCTION app_private.mark_kyc_submitted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_kyc_submitted() TO authenticated;
REVOKE ALL ON FUNCTION app_private.staff_review_kyc(uuid, boolean, text), app_private.admin_reject_kyc(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.staff_review_kyc(uuid, boolean, text), app_private.admin_reject_kyc(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION app_private.get_admin_kyc_queue(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.get_kyc_review(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.record_kyc_decision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_admin_kyc_queue(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_kyc_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_kyc_queue(
  _status text DEFAULT 'pending_review',
  _search text DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_admin_kyc_queue($1, $2, $3, $4) $function$;

CREATE OR REPLACE FUNCTION public.get_kyc_review(_seller uuid)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.get_kyc_review($1) $function$;

REVOKE ALL ON FUNCTION public.get_admin_kyc_queue(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_kyc_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_kyc_queue(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kyc_review(uuid) TO authenticated;

-- A fila do admin atualiza sozinha quando chega um envio novo ou sai uma decisão.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kyc_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_submissions;
  END IF;
END $$;

-- ───────────────────────── centro de comando ─────────────────────────
-- 1. "Contas aguardando aprovação" contava também quem nunca enviou documento (status `pending`); agora conta só
--    quem está em análise, que é o que a equipe tem para decidir (o atalho leva à aba Verificações).
-- 2. Entregas de webhook e de apps: os workers gravam `success`/`delivered` e `exhausted`, mas a conta procurava
--    `delivered`/`failed` (webhook) e `failed` (apps), então "entregues" e "falharam" davam sempre zero.
CREATE OR REPLACE FUNCTION app_private.get_admin_command_center(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _from>_to OR _to-_from>interval '367 days' THEN RAISE EXCEPTION 'Invalid period' USING ERRCODE='22023'; END IF;
 WITH risky AS (
 SELECT t.user_id, count(*) FILTER(WHERE t.status IN ('approved','paid','completed')) approved,
 count(*) FILTER(WHERE t.status IN ('refunded','chargeback','chargedback','charged_back')) bad,
 coalesce(sum(t.amount) FILTER(WHERE t.status IN ('approved','paid','completed')),0) volume
 FROM public.transactions t WHERE coalesce(t.is_simulated,false)=false AND t.created_at BETWEEN _from AND _to GROUP BY t.user_id
 ), ranked AS (
 SELECT r.user_id,coalesce(p.full_name,left(r.user_id::text,8)) name,r.approved,r.bad,r.volume,
 round(100.0*r.bad/nullif(r.approved+r.bad,0),2) rate
 FROM risky r LEFT JOIN public.profiles p ON p.user_id=r.user_id WHERE r.approved+r.bad>=5 AND r.bad>0
 ORDER BY rate DESC,r.user_id LIMIT 5
 )
 SELECT jsonb_build_object(
 'withdrawals',(SELECT jsonb_build_object('count',count(*),'amount',coalesce(sum(amount),0),'oldest',min(created_at)) FROM public.withdrawals WHERE status='pending'),
 'kyc',(SELECT count(*) FROM public.profiles p WHERE p.account_status = 'pending_review' AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','employee','manager','partner'))),
 'med',(SELECT count(*) FROM public.disputes WHERE status IN ('open','in_review') AND type IN ('medpix','pre_med_pix')),
 'chargebacks',(SELECT count(*) FROM public.disputes WHERE status IN ('open','in_review') AND type='chargeback'),
 'refunds',(SELECT count(*) FROM public.refund_requests WHERE status='pending_confirmation'),
 'support',(SELECT count(*) FROM public.support_tickets WHERE status<>'closed'),
 'error_count',(SELECT count(*) FROM public.error_logs WHERE resolved=false),
 'errors',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT id,error_type,message,created_at FROM public.error_logs WHERE resolved=false ORDER BY created_at DESC,id LIMIT 6)e),'[]'::jsonb),
 'fraud',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM (SELECT id,block_type,block_reason,matched_value,created_at FROM public.fraud_logs ORDER BY created_at DESC,id LIMIT 6)f),'[]'::jsonb),
 'webhooks',(SELECT jsonb_build_object('delivered',count(*) FILTER(WHERE status IN ('success','delivered')),'failed',count(*) FILTER(WHERE status IN ('exhausted','failed')),'pending',count(*) FILTER(WHERE status IN ('pending','retrying','processing'))) FROM public.webhook_deliveries WHERE created_at>=now()-interval '24 hours'),
 'apps',(SELECT jsonb_build_object('delivered',count(*) FILTER(WHERE status IN ('delivered','success')),'failed',count(*) FILTER(WHERE status IN ('exhausted','failed')),'pending',count(*) FILTER(WHERE status IN ('pending','retrying','processing'))) FROM public.app_deliveries WHERE created_at>=now()-interval '24 hours'),
 'risky_sellers',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM ranked r),'[]'::jsonb),
 'checked_at',now()
 ) INTO result;
 RETURN result;
END $function$;
