
CREATE OR REPLACE FUNCTION public.grant_access_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _course_id uuid;
  _buyer_id uuid;
  _bump_product_id uuid;
  _bump_course_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT au.id INTO _buyer_id FROM auth.users au WHERE au.email = NEW.customer_email LIMIT 1;

    IF _buyer_id IS NOT NULL THEN
      -- Produto principal
      SELECT id INTO _course_id FROM public.courses WHERE product_id = NEW.product_id LIMIT 1;
      IF _course_id IS NOT NULL THEN
        INSERT INTO public.user_access (user_id, course_id, transaction_id, status)
        VALUES (_buyer_id, _course_id, NEW.id, 'active')
        ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', revoked_at = NULL;
      END IF;

      -- Order bumps (metadata.bump_product_ids = uuid[])
      IF NEW.metadata ? 'bump_product_ids' THEN
        FOR _bump_product_id IN
          SELECT (jsonb_array_elements_text(NEW.metadata->'bump_product_ids'))::uuid
        LOOP
          SELECT id INTO _bump_course_id FROM public.courses WHERE product_id = _bump_product_id LIMIT 1;
          IF _bump_course_id IS NOT NULL THEN
            INSERT INTO public.user_access (user_id, course_id, transaction_id, status)
            VALUES (_buyer_id, _bump_course_id, NEW.id, 'active')
            ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', revoked_at = NULL;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;

  IF NEW.status IN ('chargeback', 'refunded') AND OLD.status = 'completed' THEN
    UPDATE public.user_access SET status = 'revoked', revoked_at = now()
    WHERE transaction_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
