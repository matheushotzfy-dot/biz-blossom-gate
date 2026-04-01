-- Create API keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Chave API',
  public_key TEXT NOT NULL UNIQUE,
  secret_key_hash TEXT NOT NULL,
  secret_key_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own keys
CREATE POLICY "Users can view own api_keys"
ON public.api_keys FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own keys
CREATE POLICY "Users can create own api_keys"
ON public.api_keys FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own keys (deactivate, rename)
CREATE POLICY "Users can update own api_keys"
ON public.api_keys FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own keys
CREATE POLICY "Users can delete own api_keys"
ON public.api_keys FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Limit max keys per user
CREATE OR REPLACE FUNCTION public.enforce_max_api_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.api_keys WHERE user_id = NEW.user_id;
  IF _count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 chaves API atingido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_api_keys_trigger
BEFORE INSERT ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_api_keys();