
-- Fix remaining SECURITY DEFINER functions exposed to anon
-- enforce_max_pix_keys is a trigger function, anon shouldn't call it directly
REVOKE EXECUTE ON FUNCTION public.enforce_max_pix_keys() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon;

-- has_role and handle_new_user MUST stay accessible (used by RLS policies and auth trigger)
-- But we keep them as-is since they're read-only/safe
