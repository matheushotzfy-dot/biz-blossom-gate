-- Prevent duplicate registrations with same document
CREATE UNIQUE INDEX idx_profiles_unique_document 
ON public.profiles (document_number) 
WHERE document_number IS NOT NULL AND document_number != '';

-- Prevent duplicate registrations with same email
CREATE UNIQUE INDEX idx_profiles_unique_email 
ON public.profiles (email) 
WHERE email IS NOT NULL AND email != '';

-- Prevent duplicate registrations with same phone
CREATE UNIQUE INDEX idx_profiles_unique_phone 
ON public.profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';