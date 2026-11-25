-- Auditoria de segurança (#63): validate_webhook_url só barrava alguns prefixos de texto
-- (https://127., https://10. …). Passavam https://169.254.169.254 (metadados de nuvem), https://[::1],
-- https://0.0.0.0, https://usuario@127.0.0.1 e hosts sem ponto. A barreira de verdade continua sendo o
-- guard de SSRF da função webhook-dispatcher (resolve o DNS e confere cada IP na hora do envio); esta
-- é a primeira linha, para o vendedor ver o erro na hora de salvar.
CREATE OR REPLACE FUNCTION public.validate_webhook_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _url text := btrim(coalesce(NEW.url, ''));
  _rest text;
  _authority text;
  _host text;
BEGIN
  IF _url !~* '^https://' THEN
    RAISE EXCEPTION 'Webhook URL deve usar HTTPS';
  END IF;
  IF length(_url) > 2048 OR _url ~ '[[:space:][:cntrl:]]' OR position(chr(92) IN _url) > 0 THEN
    RAISE EXCEPTION 'Webhook URL inválida';
  END IF;
  _rest := substr(_url, 9);
  _authority := split_part(split_part(split_part(_rest, '/', 1), '?', 1), '#', 1);
  IF position('@' IN _authority) > 0 THEN
    RAISE EXCEPTION 'Webhook URL não pode ter usuário e senha no endereço';
  END IF;
  IF left(_authority, 1) = '[' THEN
    RAISE EXCEPTION 'Webhook URL não pode apontar para um endereço IP';
  END IF;
  _host := lower(regexp_replace(_authority, ':[0-9]*$', ''));
  IF _host = '' OR _host !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' OR position('.' IN _host) = 0 THEN
    RAISE EXCEPTION 'Webhook URL precisa de um domínio válido';
  END IF;
  IF _host ~ '^[0-9]+(\.[0-9]+)*$' OR _host ~ '^0x' THEN
    RAISE EXCEPTION 'Webhook URL não pode apontar para um endereço IP';
  END IF;
  IF _host = 'localhost' OR _host ~ '\.(localhost|local|internal|lan|home|corp|intranet|test|invalid|example)$' THEN
    RAISE EXCEPTION 'Webhook URL não pode apontar para endereços internos';
  END IF;
  RETURN NEW;
END;
$function$;
