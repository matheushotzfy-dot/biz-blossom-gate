-- Contas novas começam como 'pending' (faltam etapas), não 'pending_review'.
-- 'pending_review' passa a significar exclusivamente: documentos enviados, aguardando análise.
ALTER TABLE public.profiles ALTER COLUMN account_status SET DEFAULT 'pending';

-- Backfill: contas marcadas como 'em análise' sem nenhum documento enviado
-- voltam para 'pending' (o storage guarda os arquivos em pastas por user_id).
UPDATE public.profiles p
SET account_status = 'pending'
WHERE p.account_status = 'pending_review'
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'kyc-documents'
      AND (storage.foldername(o.name))[1] = p.user_id::text
  );

COMMENT ON COLUMN public.profiles.account_status IS 'pending = onboarding incompleto; pending_review = documentos enviados, aguardando análise; approved/rejected/blocked = decisão da equipe';