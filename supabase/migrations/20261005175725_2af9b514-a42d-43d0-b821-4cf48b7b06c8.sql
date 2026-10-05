ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'light';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('light', 'dark'));

CREATE OR REPLACE FUNCTION app_private.set_my_theme_preference(_theme text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _theme NOT IN ('light', 'dark') THEN
    RAISE EXCEPTION 'Invalid theme preference';
  END IF;

  UPDATE public.profiles
  SET theme_preference = _theme,
      updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN _theme;
END;
$$;

REVOKE ALL ON FUNCTION app_private.set_my_theme_preference(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.set_my_theme_preference(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_my_theme_preference(_theme text)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT app_private.set_my_theme_preference(_theme);
$$;

REVOKE ALL ON FUNCTION public.set_my_theme_preference(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_theme_preference(text) TO authenticated, service_role;