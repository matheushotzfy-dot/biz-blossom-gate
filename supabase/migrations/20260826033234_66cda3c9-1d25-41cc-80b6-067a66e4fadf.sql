
ALTER TABLE public.staff_audit_log ALTER COLUMN staff_user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _before jsonb;
  _after jsonb;
  _redact text[] := ARRAY['key_value','key_value_enc','account_number','account_number_enc',
                          'holder_document','holder_document_enc','pix_key','pix_key_enc',
                          'document_number','document_number_enc'];
  _entity_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    _before := to_jsonb(OLD) - _redact;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    _after := to_jsonb(NEW) - _redact;
  END IF;

  _entity_id := COALESCE((_after ->> 'id'), (_before ->> 'id'));

  BEGIN
    INSERT INTO public.staff_audit_log (staff_user_id, action, entity_type, entity_id, before, after, metadata)
    VALUES (
      auth.uid(),
      lower(TG_OP),
      TG_TABLE_NAME,
      _entity_id,
      _before,
      _after,
      jsonb_build_object(
        'at', now(),
        'actor', COALESCE(auth.uid()::text, 'system'),
        'target_user_id', COALESCE(_after ->> 'user_id', _before ->> 'user_id')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- auditoria nunca deve derrubar a operação de negócio
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_sensitive_change() FROM PUBLIC, anon, authenticated;
