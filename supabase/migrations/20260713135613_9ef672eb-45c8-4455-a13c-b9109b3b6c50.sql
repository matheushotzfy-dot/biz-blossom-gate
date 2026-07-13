CREATE OR REPLACE FUNCTION public.validate_profile_acquirer_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acquirer_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.acquirer_id IS DISTINCT FROM OLD.acquirer_id)
     AND NOT EXISTS (
       SELECT 1
       FROM public.acquirers
       WHERE id = NEW.acquirer_id
         AND is_active = true
     )
  THEN
    RAISE EXCEPTION 'Adquirente inativa não pode ser atribuída a seller'
      USING ERRCODE = 'check_violation', HINT = 'inactive_acquirer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_acquirer_active ON public.profiles;
CREATE TRIGGER trg_validate_profile_acquirer_active
BEFORE INSERT OR UPDATE OF acquirer_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_acquirer_active();

CREATE OR REPLACE FUNCTION public.validate_seller_acquirer_config_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true
     AND NOT EXISTS (
       SELECT 1
       FROM public.acquirers
       WHERE id = NEW.acquirer_id
         AND is_active = true
     )
  THEN
    RAISE EXCEPTION 'Configuração aponta para adquirente inativa'
      USING ERRCODE = 'check_violation', HINT = 'inactive_acquirer_config';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_seller_acquirer_config_active ON public.seller_acquirer_config;
CREATE TRIGGER trg_validate_seller_acquirer_config_active
BEFORE INSERT OR UPDATE OF acquirer_id, is_active ON public.seller_acquirer_config
FOR EACH ROW
EXECUTE FUNCTION public.validate_seller_acquirer_config_active();

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY priority DESC, updated_at DESC, created_at DESC) AS rn
  FROM public.seller_acquirer_config
  WHERE is_active = true
)
UPDATE public.seller_acquirer_config sac
SET is_active = false,
    updated_at = now(),
    notes = COALESCE(sac.notes || ' | ', '') || 'Auto-desativada: havia mais de uma configuração ativa para o seller.'
FROM ranked r
WHERE sac.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_seller_acquirer_config_one_active
ON public.seller_acquirer_config(user_id)
WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.admin_set_seller_acquirer(
  _seller_id uuid,
  _new_acquirer_id uuid DEFAULT NULL,
  _reason text DEFAULT 'manual seller assignment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_acq uuid;
  _admin_id uuid := auth.uid();
  _new_name text;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _seller_id) THEN
    RAISE EXCEPTION 'Seller não encontrado';
  END IF;

  IF _new_acquirer_id IS NOT NULL THEN
    SELECT name INTO _new_name
    FROM public.acquirers
    WHERE id = _new_acquirer_id
      AND is_active = true;

    IF _new_name IS NULL THEN
      RAISE EXCEPTION 'Adquirente inválida ou inativa';
    END IF;
  ELSE
    _new_name := 'Padrão da plataforma';
  END IF;

  SELECT acquirer_id INTO _old_acq
  FROM public.profiles
  WHERE user_id = _seller_id;

  UPDATE public.seller_acquirer_config
  SET is_active = false,
      updated_at = now(),
      notes = COALESCE(notes || ' | ', '') || 'Desativada por nova atribuição manual.'
  WHERE user_id = _seller_id
    AND is_active = true
    AND (_new_acquirer_id IS NULL OR acquirer_id <> _new_acquirer_id);

  IF _new_acquirer_id IS NULL THEN
    UPDATE public.profiles
    SET acquirer_id = NULL,
        updated_at = now()
    WHERE user_id = _seller_id;
  ELSE
    UPDATE public.profiles
    SET acquirer_id = _new_acquirer_id,
        updated_at = now()
    WHERE user_id = _seller_id;

    INSERT INTO public.seller_acquirer_config (
      user_id, acquirer_id, is_active, priority, admin_user_id, notes, updated_at
    ) VALUES (
      _seller_id, _new_acquirer_id, true, 100, _admin_id, _reason, now()
    )
    ON CONFLICT (user_id, acquirer_id) DO UPDATE
    SET is_active = true,
        priority = GREATEST(public.seller_acquirer_config.priority, 100),
        admin_user_id = EXCLUDED.admin_user_id,
        notes = EXCLUDED.notes,
        updated_at = now();
  END IF;

  INSERT INTO public.acquirer_failover_events(from_acquirer_id, to_acquirer_id, seller_id, reason, trigger_type, success)
  VALUES (_old_acq, _new_acquirer_id, _seller_id, _reason, 'manual', true);

  RETURN jsonb_build_object(
    'success', true,
    'seller_id', _seller_id,
    'old_acquirer_id', _old_acq,
    'new_acquirer_id', _new_acquirer_id,
    'new_acquirer_name', _new_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_seller_acquirer(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_assign_acquirer(
  _seller_ids uuid[],
  _new_acquirer_id uuid,
  _reason text DEFAULT 'bulk admin assignment'
)
RETURNS TABLE(seller_id uuid, success boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _new_acquirer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.acquirers WHERE id = _new_acquirer_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Adquirente inválida ou inativa';
  END IF;

  FOREACH _sid IN ARRAY _seller_ids LOOP
    BEGIN
      PERFORM public.admin_set_seller_acquirer(_sid, _new_acquirer_id, _reason);
      seller_id := _sid; success := true; error := NULL; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      seller_id := _sid; success := false; error := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_assign_acquirer(uuid[], uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_acquirer_active(
  _acquirer_id uuid,
  _active boolean,
  _reason text DEFAULT 'manual acquirer status change'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _fallback_id uuid;
  _moved_count integer := 0;
  _cfg_disabled integer := 0;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.acquirers WHERE id = _acquirer_id) THEN
    RAISE EXCEPTION 'Adquirente inválida';
  END IF;

  IF _active = false THEN
    SELECT id INTO _fallback_id
    FROM public.acquirers
    WHERE id <> _acquirer_id
      AND is_active = true
      AND health_status IN ('online', 'degraded')
    ORDER BY priority DESC, conversion_rate DESC, created_at ASC
    LIMIT 1;

    UPDATE public.seller_acquirer_config
    SET is_active = false,
        updated_at = now(),
        notes = COALESCE(notes || ' | ', '') || 'Auto-desativada porque a adquirente foi desligada.'
    WHERE acquirer_id = _acquirer_id
      AND is_active = true;
    GET DIAGNOSTICS _cfg_disabled = ROW_COUNT;

    IF _fallback_id IS NOT NULL THEN
      INSERT INTO public.acquirer_failover_events(from_acquirer_id, to_acquirer_id, seller_id, reason, trigger_type, success)
      SELECT _acquirer_id, _fallback_id, p.user_id, _reason, 'manual', true
      FROM public.profiles p
      WHERE p.acquirer_id = _acquirer_id;

      UPDATE public.profiles
      SET acquirer_id = _fallback_id,
          updated_at = now()
      WHERE acquirer_id = _acquirer_id;
      GET DIAGNOSTICS _moved_count = ROW_COUNT;
    ELSE
      UPDATE public.profiles
      SET acquirer_id = NULL,
          updated_at = now()
      WHERE acquirer_id = _acquirer_id;
      GET DIAGNOSTICS _moved_count = ROW_COUNT;
    END IF;

    UPDATE public.acquirers
    SET is_active = false,
        seller_visible = false,
        allow_failover = false,
        updated_at = now()
    WHERE id = _acquirer_id;
  ELSE
    UPDATE public.acquirers
    SET is_active = true,
        updated_at = now()
    WHERE id = _acquirer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'acquirer_id', _acquirer_id,
    'active', _active,
    'fallback_acquirer_id', _fallback_id,
    'moved_sellers', _moved_count,
    'disabled_configs', _cfg_disabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_acquirer_active(uuid, boolean, text) TO authenticated;

-- Reconcile the current broken state: sellers still pointing to inactive acquirers are moved to the best active acquirer.
WITH fallback AS (
  SELECT id
  FROM public.acquirers
  WHERE is_active = true
  ORDER BY priority DESC, conversion_rate DESC, created_at ASC
  LIMIT 1
), moved AS (
  UPDATE public.profiles p
  SET acquirer_id = (SELECT id FROM fallback),
      updated_at = now()
  WHERE p.acquirer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.acquirers a
      WHERE a.id = p.acquirer_id
        AND a.is_active = false
    )
    AND EXISTS (SELECT 1 FROM fallback)
  RETURNING p.user_id
)
UPDATE public.seller_acquirer_config sac
SET is_active = false,
    updated_at = now(),
    notes = COALESCE(sac.notes || ' | ', '') || 'Auto-desativada: adquirente inativa.'
WHERE sac.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.acquirers a
    WHERE a.id = sac.acquirer_id
      AND a.is_active = false
  );