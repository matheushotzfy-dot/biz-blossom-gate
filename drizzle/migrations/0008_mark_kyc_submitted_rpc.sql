-- Marca a conta como 'em análise' somente quando o próprio usuário confirma
-- o envio de documentos. Só transiciona a partir de 'pending'/'rejected' —
-- nunca reabre contas aprovadas/bloqueadas nem pisa em decisão da equipe.
CREATE OR REPLACE FUNCTION app_private.mark_kyc_submitted()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _docs int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Prova real: exige ao menos 1 arquivo no bucket kyc-documents do usuário.
  SELECT count(*) INTO _docs
  FROM storage.objects o
  WHERE o.bucket_id = 'kyc-documents'
    AND (storage.foldername(o.name))[1] = _uid::text;

  IF _docs = 0 THEN
    RAISE EXCEPTION 'no_documents_uploaded';
  END IF;

  UPDATE public.profiles
  SET account_status = 'pending_review'
  WHERE user_id = _uid
    AND account_status IN ('pending', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION app_private.mark_kyc_submitted() FROM PUBLIC, anon, authenticated;

-- Wrapper público SECURITY INVOKER (padrão do projeto): mesma assinatura,
-- EXECUTE para authenticated; a implementação privilegiada fica em app_private.
CREATE OR REPLACE FUNCTION public.mark_kyc_submitted()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM app_private.mark_kyc_submitted();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_kyc_submitted() TO authenticated;