CREATE OR REPLACE FUNCTION public.reveal_own_pix_keys()
RETURNS TABLE(
  id uuid,
  key_type text,
  key_value text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private', 'extensions'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.key_type,
    COALESCE(
      extensions.pgp_sym_decrypt(p.key_value_enc, encode(app_private.get_key('field_v1'), 'hex')),
      p.key_value,
      p.key_value_masked
    ) AS key_value,
    p.created_at
  FROM public.pix_keys p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_own_pix_keys() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reveal_own_pix_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_own_pix_keys() TO service_role;