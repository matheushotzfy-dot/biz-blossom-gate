
-- Add unique constraints to prevent duplicate accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_document_unique 
ON public.profiles (document_number) 
WHERE document_number IS NOT NULL AND document_number != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
ON public.profiles (email) 
WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
ON public.profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';
