
-- 1. Add per-seller override column
ALTER TABLE public.custom_user_fees
  ADD COLUMN IF NOT EXISTS max_ticket NUMERIC;

-- 2. Seed global default (R$ 10.000 por padrão se ainda não existir)
INSERT INTO public.platform_settings (key, value)
VALUES ('max_ticket_default', jsonb_build_object('value', 10000))
ON CONFLICT (key) DO NOTHING;

-- 3. Resolver limite efetivo do usuário (custom > global)
CREATE OR REPLACE FUNCTION public.get_user_max_ticket(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT max_ticket FROM public.custom_user_fees WHERE user_id = _user_id LIMIT 1),
    NULLIF((SELECT (value->>'value')::numeric FROM public.platform_settings WHERE key = 'max_ticket_default' LIMIT 1), 0),
    10000
  );
$$;

-- 4. RPC pública: o seller vê o próprio limite
CREATE OR REPLACE FUNCTION public.get_my_max_ticket()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_max_ticket(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.get_my_max_ticket() TO authenticated;

-- 5. Trigger BEFORE INSERT em transactions: bloqueia se amount > limite
CREATE OR REPLACE FUNCTION public.enforce_max_ticket_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit numeric;
BEGIN
  -- Pular simuladas e estornos (UPDATEs não passam aqui pois é BEFORE INSERT)
  IF NEW.is_simulated = true OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  _limit := public.get_user_max_ticket(NEW.user_id);

  IF _limit IS NOT NULL AND _limit > 0 AND NEW.amount > _limit THEN
    RAISE EXCEPTION 'Valor da transação (R$ %) excede o limite máximo permitido (R$ %). Entre em contato com o suporte para aumentar seu limite.',
      to_char(NEW.amount, 'FM999G999G990D00'),
      to_char(_limit, 'FM999G999G990D00')
      USING ERRCODE = 'check_violation',
            HINT = 'max_ticket_exceeded';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_ticket_limit_trg ON public.transactions;
CREATE TRIGGER enforce_max_ticket_limit_trg
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_ticket_limit();

-- 6. RPC admin: aplicar novo limite SOMENTE para novos usuários
-- (snapshot do valor atual em cada seller existente como override, depois muda o global)
CREATE OR REPLACE FUNCTION public.set_max_ticket_new_users_only(_new_value numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current numeric;
  _snapshot_count int := 0;
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem alterar limites globais';
  END IF;
  IF _new_value IS NULL OR _new_value <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  -- Valor global atual
  SELECT (value->>'value')::numeric INTO _current
  FROM public.platform_settings WHERE key = 'max_ticket_default';
  IF _current IS NULL THEN _current := 10000; END IF;

  -- Snapshot: cria/atualiza override = valor antigo para TODOS sellers existentes
  -- que ainda não têm override de max_ticket (assim eles preservam o limite anterior).
  INSERT INTO public.custom_user_fees (user_id, max_ticket, admin_user_id)
  SELECT p.user_id, _current, _caller_id
  FROM public.profiles p
  ON CONFLICT (user_id) DO UPDATE
    SET max_ticket = COALESCE(custom_user_fees.max_ticket, EXCLUDED.max_ticket),
        updated_at = now();
  GET DIAGNOSTICS _snapshot_count = ROW_COUNT;

  -- Atualiza global
  UPDATE public.platform_settings
    SET value = jsonb_build_object('value', _new_value), updated_at = now(), updated_by = _caller_id
    WHERE key = 'max_ticket_default';

  RETURN jsonb_build_object(
    'previous_value', _current,
    'new_value', _new_value,
    'snapshotted_users', _snapshot_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_max_ticket_new_users_only(numeric) TO authenticated;

-- 7. RPC admin: aplicar novo limite a TODOS (limpa overrides + atualiza global)
CREATE OR REPLACE FUNCTION public.set_max_ticket_for_all(_new_value numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cleared int := 0;
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem alterar limites globais';
  END IF;
  IF _new_value IS NULL OR _new_value <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  -- Remove overrides individuais de max_ticket
  UPDATE public.custom_user_fees SET max_ticket = NULL, updated_at = now()
    WHERE max_ticket IS NOT NULL;
  GET DIAGNOSTICS _cleared = ROW_COUNT;

  -- Atualiza global
  UPDATE public.platform_settings
    SET value = jsonb_build_object('value', _new_value), updated_at = now(), updated_by = _caller_id
    WHERE key = 'max_ticket_default';

  RETURN jsonb_build_object(
    'new_value', _new_value,
    'cleared_overrides', _cleared
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_max_ticket_for_all(numeric) TO authenticated;
