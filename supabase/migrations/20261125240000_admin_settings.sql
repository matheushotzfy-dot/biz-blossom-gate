-- Configurações do admin: tudo o que a aba mexia direto do navegador passa a ser feito por função
-- (senha confirmada nos últimos 10 min + auditoria gravada no servidor), com limites no banco.
--
-- O que muda:
--  * `fees` ganha validação (percentual 0–50, fixa 0–100, saque até 500): antes qualquer valor entrava;
--  * "Aplicar taxa global a todos" apagava a linha inteira de `custom_user_fees`, levando junto o limite de
--    ticket individual (inclusive o que o "só para novos usuários" acabou de gravar para todo mundo).
--    Agora só as taxas voltam ao padrão e o limite individual fica;
--  * ticket máximo (`set_max_ticket_*`) sem senha recente e sem auditoria no servidor: substituído por
--    `admin_set_max_ticket`;
--  * prazo de liberação do cartão (global e por seller) e verificação de e-mail no cadastro passam a ter função;
--  * `get_admin_settings` entrega tudo de uma vez, com o histórico das últimas mudanças.

-- ───────────────────────── validação das taxas ─────────────────────────

CREATE OR REPLACE FUNCTION public.validate_fee_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fee_type NOT IN ('percentage', 'fixed') THEN RAISE EXCEPTION 'tipo de taxa inválido'; END IF;
  IF NEW.value IS NULL OR NEW.value < 0 THEN RAISE EXCEPTION 'a taxa não pode ser negativa'; END IF;
  IF NEW.fee_type = 'percentage' AND NEW.value > 50 THEN RAISE EXCEPTION 'a taxa percentual deve ficar entre 0%% e 50%%'; END IF;
  IF NEW.fee_type = 'fixed' AND NEW.value > (CASE WHEN NEW.name = 'Taxa de Saque' THEN 500 ELSE 100 END) THEN
    RAISE EXCEPTION 'a taxa fixa deve ficar entre R$ 0 e R$ %', (CASE WHEN NEW.name = 'Taxa de Saque' THEN 500 ELSE 100 END);
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_validate_fee_value ON public.fees;
CREATE TRIGGER trg_validate_fee_value BEFORE INSERT OR UPDATE ON public.fees
  FOR EACH ROW EXECUTE FUNCTION public.validate_fee_value();

-- ───────────────────────── leitura única ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _fees jsonb;
  _ind_fees integer;
  _ticket numeric;
  _ticket_at timestamptz;
  _ticket_by text;
  _ticket_ind integer;
  _rel_global integer;
  _rel_at timestamptz;
  _rel_by text;
  _rel_over jsonb;
  _rel_total integer;
  _signup jsonb;
  _signup_at timestamptz;
  _signup_by text;
  _hist jsonb;
BEGIN
  PERFORM app_private.assert_admin();

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'fee_type', f.fee_type, 'value', f.value) ORDER BY f.name), '[]'::jsonb)
    INTO _fees FROM public.fees f;

  SELECT count(*)::int INTO _ind_fees FROM public.custom_user_fees c
   WHERE COALESCE(c.transaction_percentage, c.transaction_fixed, c.withdrawal_fee, c.pix_percentage, c.pix_fixed,
                  c.card_percentage, c.card_fixed, c.boleto_percentage, c.boleto_fixed) IS NOT NULL;

  SELECT NULLIF((s.value ->> 'value')::numeric, 0), s.updated_at,
         (SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email) FROM public.profiles p WHERE p.user_id = s.updated_by)
    INTO _ticket, _ticket_at, _ticket_by
    FROM public.platform_settings s WHERE s.key = 'max_ticket_default';
  SELECT count(*)::int INTO _ticket_ind FROM public.custom_user_fees WHERE max_ticket IS NOT NULL;

  SELECT r.card_release_days, r.updated_at,
         (SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email) FROM public.profiles p WHERE p.user_id = r.updated_by)
    INTO _rel_global, _rel_at, _rel_by
    FROM public.retention_settings r WHERE r.user_id IS NULL LIMIT 1;

  SELECT count(*)::int INTO _rel_total FROM public.retention_settings WHERE user_id IS NOT NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', x.name, 'email', x.email, 'days', x.card_release_days, 'updated_at', x.updated_at) ORDER BY x.updated_at DESC), '[]'::jsonb)
    INTO _rel_over
    FROM (SELECT r.user_id, r.card_release_days, r.updated_at, p.email,
                 COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email, 'Seller sem nome') AS name
            FROM public.retention_settings r LEFT JOIN public.profiles p ON p.user_id = r.user_id
           WHERE r.user_id IS NOT NULL ORDER BY r.updated_at DESC LIMIT 50) x;

  SELECT s.value, s.updated_at,
         (SELECT COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email) FROM public.profiles p WHERE p.user_id = s.updated_by)
    INTO _signup, _signup_at, _signup_by
    FROM public.platform_settings s WHERE s.key = 'require_email_verification';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', h.id, 'action', h.action, 'created_at', h.created_at, 'admin_name', h.admin_name, 'details', h.details) ORDER BY h.created_at DESC), '[]'::jsonb)
    INTO _hist
    FROM (SELECT a.id, a.action, a.created_at, a.details,
                 COALESCE(NULLIF(btrim(COALESCE(p.full_name, '')), ''), p.email) AS admin_name
            FROM public.audit_logs a LEFT JOIN public.profiles p ON p.user_id = a.admin_user_id
           WHERE a.action IN ('platform_fee_update', 'custom_fees_reset', 'max_ticket_set', 'card_release_set', 'card_release_clear', 'email_verification_set')
           ORDER BY a.created_at DESC LIMIT 20) h;

  RETURN jsonb_build_object(
    'fees', _fees,
    'individual_fee_sellers', _ind_fees,
    'max_ticket', jsonb_build_object('value', COALESCE(_ticket, 10000), 'configured', _ticket IS NOT NULL, 'updated_at', _ticket_at, 'updated_by', _ticket_by, 'individual', _ticket_ind),
    'release', jsonb_build_object('global_days', COALESCE(_rel_global, 7), 'updated_at', _rel_at, 'updated_by', _rel_by, 'overrides', _rel_over, 'overrides_total', _rel_total),
    'signup', jsonb_build_object('require_email_verification', COALESCE((_signup ->> 'enabled')::boolean, true), 'configured', _signup IS NOT NULL, 'updated_at', _signup_at, 'updated_by', _signup_by),
    'history', _hist,
    'generated_at', now()
  );
END
$function$;

-- ───────────────────────── taxas da plataforma ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_platform_fee(_id uuid, _value numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _v numeric;
  f public.fees%ROWTYPE;
BEGIN
  IF _id IS NULL OR _value IS NULL THEN RAISE EXCEPTION 'informe o valor da taxa'; END IF;
  _v := round(_value, 2);
  SELECT * INTO f FROM public.fees WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'taxa não encontrada'; END IF;
  IF f.value = _v THEN RAISE EXCEPTION 'a taxa já está com esse valor'; END IF;
  UPDATE public.fees SET value = _v WHERE id = _id;
  PERFORM app_private.admin_audit(_admin, 'platform_fee_update', 'fee', _id::text,
    jsonb_build_object('name', f.name, 'fee_type', f.fee_type, 'from', f.value, 'to', _v));
  RETURN jsonb_build_object('id', _id, 'name', f.name, 'value', _v);
END
$function$;

-- Volta as taxas individuais ao padrão da plataforma. O limite de ticket individual NÃO é tocado.
CREATE OR REPLACE FUNCTION app_private.admin_reset_custom_fees(_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _users uuid[];
  _n integer;
  _gone integer := 0;
BEGIN
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT array_agg(c.user_id) INTO _users FROM public.custom_user_fees c
   WHERE COALESCE(c.transaction_percentage, c.transaction_fixed, c.withdrawal_fee, c.pix_percentage, c.pix_fixed,
                  c.card_percentage, c.card_fixed, c.boleto_percentage, c.boleto_fixed) IS NOT NULL;
  _n := COALESCE(cardinality(_users), 0);
  IF _n = 0 THEN RAISE EXCEPTION 'nenhum seller tem taxa individual'; END IF;

  UPDATE public.custom_user_fees
     SET transaction_percentage = NULL, transaction_fixed = NULL, withdrawal_fee = NULL,
         pix_percentage = NULL, pix_fixed = NULL, card_percentage = NULL, card_fixed = NULL,
         boleto_percentage = NULL, boleto_fixed = NULL, updated_at = now()
   WHERE user_id = ANY (_users);
  DELETE FROM public.custom_user_fees WHERE user_id = ANY (_users) AND max_ticket IS NULL;
  GET DIAGNOSTICS _gone = ROW_COUNT;

  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT u, 'Suas taxas voltaram ao padrão', 'A equipe aplicou as taxas padrão da plataforma à sua conta. Veja os valores em Taxas e prazos.', 'info'
    FROM unnest(_users) AS u;

  PERFORM app_private.admin_audit(_admin, 'custom_fees_reset', 'custom_user_fees', 'bulk',
    jsonb_build_object('reason', _r, 'sellers', _n, 'rows_removed', _gone));
  RETURN jsonb_build_object('sellers', _n);
END
$function$;

-- ───────────────────────── ticket máximo ─────────────────────────

DROP FUNCTION IF EXISTS public.set_max_ticket_for_all(numeric);
DROP FUNCTION IF EXISTS public.set_max_ticket_new_users_only(numeric);
DROP FUNCTION IF EXISTS app_private.set_max_ticket_for_all(numeric);
DROP FUNCTION IF EXISTS app_private.set_max_ticket_new_users_only(numeric);

-- _scope 'new': o limite novo vale só para quem se cadastrar daqui para frente (cada conta de hoje que ainda não
-- tem limite individual passa a ter o limite atual gravado). _scope 'all': vale para todos e apaga os limites individuais.
CREATE OR REPLACE FUNCTION app_private.admin_set_max_ticket(_value numeric, _scope text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _v numeric := round(_value, 2);
  _s text := btrim(COALESCE(_scope, ''));
  _current numeric;
  _cleared integer := 0;
  _kept integer := 0;
BEGIN
  IF _v IS NULL OR _v < 1 OR _v > 1000000 THEN RAISE EXCEPTION 'o limite deve ficar entre R$ 1 e R$ 1.000.000'; END IF;
  IF _s NOT IN ('new', 'all') THEN RAISE EXCEPTION 'escolha a quem o limite vale'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;

  SELECT COALESCE(NULLIF((value ->> 'value')::numeric, 0), 10000) INTO _current FROM public.platform_settings WHERE key = 'max_ticket_default';
  _current := COALESCE(_current, 10000);

  IF _s = 'new' THEN
    IF _v = _current THEN RAISE EXCEPTION 'esse já é o limite atual'; END IF;
    INSERT INTO public.custom_user_fees (user_id, max_ticket, admin_user_id)
    SELECT p.user_id, _current, _admin FROM public.profiles p
    ON CONFLICT (user_id) DO UPDATE SET max_ticket = COALESCE(public.custom_user_fees.max_ticket, EXCLUDED.max_ticket), updated_at = now();
    GET DIAGNOSTICS _kept = ROW_COUNT;
  ELSE
    SELECT count(*)::int INTO _cleared FROM public.custom_user_fees WHERE max_ticket IS NOT NULL;
    IF _v = _current AND _cleared = 0 THEN RAISE EXCEPTION 'nada a mudar: o limite já é esse e ninguém tem limite individual'; END IF;
    UPDATE public.custom_user_fees SET max_ticket = NULL, updated_at = now() WHERE max_ticket IS NOT NULL;
    DELETE FROM public.custom_user_fees c WHERE c.max_ticket IS NULL
      AND COALESCE(c.transaction_percentage, c.transaction_fixed, c.withdrawal_fee, c.pix_percentage, c.pix_fixed,
                   c.card_percentage, c.card_fixed, c.boleto_percentage, c.boleto_fixed) IS NULL;
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES ('max_ticket_default', jsonb_build_object('value', _v), now(), _admin)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = _admin;

  PERFORM app_private.admin_audit(_admin, 'max_ticket_set', 'platform_settings', 'max_ticket_default',
    jsonb_build_object('reason', _r, 'scope', _s, 'from', _current, 'to', _v, 'sellers_kept', _kept, 'overrides_cleared', _cleared));
  RETURN jsonb_build_object('scope', _s, 'from', _current, 'to', _v, 'sellers_kept', _kept, 'overrides_cleared', _cleared);
END
$function$;

-- ───────────────────────── liberação do cartão (D+N) ─────────────────────────

-- _user_id nulo = prazo padrão da plataforma. Só vale para as vendas feitas depois da mudança
-- (a data de liberação de cada venda é gravada quando ela nasce).
CREATE OR REPLACE FUNCTION app_private.admin_set_card_release(_user_id uuid, _days integer, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _old integer;
  _found boolean;
BEGIN
  IF _days IS NULL OR _days NOT IN (1, 7, 15, 30) THEN RAISE EXCEPTION 'o prazo deve ser D+1, D+7, D+15 ou D+30'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;

  IF _user_id IS NULL THEN
    SELECT card_release_days INTO _old FROM public.retention_settings WHERE user_id IS NULL LIMIT 1;
    _found := FOUND;
    IF _found AND _old = _days THEN RAISE EXCEPTION 'esse já é o prazo atual'; END IF;
    IF _found THEN
      UPDATE public.retention_settings SET card_release_days = _days, updated_by = _admin, updated_at = now() WHERE user_id IS NULL;
    ELSE
      _old := 7;
      IF _days = _old THEN RAISE EXCEPTION 'esse já é o prazo atual'; END IF;
      INSERT INTO public.retention_settings (user_id, pix_retention_pct, card_retention_pct, retention_days, card_release_days, updated_by)
      VALUES (NULL, 0, 0, 14, _days, _admin);
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN RAISE EXCEPTION 'seller não encontrado'; END IF;
    SELECT card_release_days INTO _old FROM public.retention_settings WHERE user_id = _user_id FOR UPDATE;
    _found := FOUND;
    IF _found THEN
      IF _old = _days THEN RAISE EXCEPTION 'esse já é o prazo deste seller'; END IF;
      UPDATE public.retention_settings SET card_release_days = _days, updated_by = _admin, updated_at = now() WHERE user_id = _user_id;
    ELSE
      _old := public.get_card_release_days(_user_id);
      INSERT INTO public.retention_settings (user_id, pix_retention_pct, card_retention_pct, retention_days, card_release_days, updated_by)
      VALUES (_user_id, 0, 0, 14, _days, _admin);
    END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_user_id, 'Prazo de liberação do cartão alterado',
            format('A liberação das suas vendas no cartão passou a ser D+%s. Vale para as vendas feitas daqui para frente; as anteriores mantêm a data que já tinham.', _days), 'info');
  END IF;

  PERFORM app_private.admin_audit(_admin, 'card_release_set', 'retention_settings', COALESCE(_user_id::text, 'global'),
    jsonb_build_object('reason', _r, 'from', _old, 'to', _days, 'scope', CASE WHEN _user_id IS NULL THEN 'global' ELSE 'seller' END));
  RETURN jsonb_build_object('user_id', _user_id, 'from', _old, 'to', _days);
END
$function$;

CREATE OR REPLACE FUNCTION app_private.admin_clear_card_release(_user_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _old integer;
  _new integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'escolha o seller'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  DELETE FROM public.retention_settings WHERE user_id = _user_id RETURNING card_release_days INTO _old;
  IF NOT FOUND THEN RAISE EXCEPTION 'este seller não tem prazo individual'; END IF;
  _new := public.get_card_release_days(_user_id);
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, 'Prazo de liberação do cartão alterado',
          format('A liberação das suas vendas no cartão voltou ao prazo padrão da plataforma, D+%s. Vale para as vendas feitas daqui para frente.', _new), 'info');
  PERFORM app_private.admin_audit(_admin, 'card_release_clear', 'retention_settings', _user_id::text,
    jsonb_build_object('reason', _r, 'from', _old, 'to', _new));
  RETURN jsonb_build_object('user_id', _user_id, 'from', _old, 'to', _new);
END
$function$;

-- ───────────────────────── verificação de e-mail no cadastro ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_email_verification(_enabled boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
  _cur boolean;
BEGIN
  IF _enabled IS NULL THEN RAISE EXCEPTION 'escolha ligar ou desligar'; END IF;
  -- desligar tira uma proteção: exige explicação; ligar de volta não.
  IF NOT _enabled AND length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT COALESCE((value ->> 'enabled')::boolean, true) INTO _cur FROM public.platform_settings WHERE key = 'require_email_verification';
  _cur := COALESCE(_cur, true);
  IF _cur = _enabled THEN RAISE EXCEPTION 'a verificação de e-mail já está assim'; END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES ('require_email_verification', jsonb_build_object('enabled', _enabled), now(), _admin)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = _admin;
  PERFORM app_private.admin_audit(_admin, 'email_verification_set', 'platform_settings', 'require_email_verification',
    jsonb_build_object('reason', NULLIF(_r, ''), 'enabled', _enabled, 'previous', _cur));
  RETURN jsonb_build_object('enabled', _enabled);
END
$function$;

-- ───────────────────────── wrappers públicos e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_settings()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_settings(); $$;

CREATE OR REPLACE FUNCTION public.admin_set_platform_fee(_id uuid, _value numeric)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_platform_fee(_id, _value); END $function$;

CREATE OR REPLACE FUNCTION public.admin_reset_custom_fees(_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_reset_custom_fees(_reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_max_ticket(_value numeric, _scope text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_max_ticket(_value, _scope, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_card_release(_user_id uuid, _days integer, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_card_release(_user_id, _days, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_clear_card_release(_user_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_clear_card_release(_user_id, _reason); END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_email_verification(_enabled boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_email_verification(_enabled, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_platform_fee(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_reset_custom_fees(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_max_ticket(numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_card_release(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_clear_card_release(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_email_verification(boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_platform_fee(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_custom_fees(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_max_ticket(numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_card_release(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_card_release(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_email_verification(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_settings(), app_private.admin_set_platform_fee(uuid, numeric), app_private.admin_reset_custom_fees(text),
  app_private.admin_set_max_ticket(numeric, text, text), app_private.admin_set_card_release(uuid, integer, text),
  app_private.admin_clear_card_release(uuid, text), app_private.admin_set_email_verification(boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_settings(), public.admin_set_platform_fee(uuid, numeric), public.admin_reset_custom_fees(text),
  public.admin_set_max_ticket(numeric, text, text), public.admin_set_card_release(uuid, integer, text),
  public.admin_clear_card_release(uuid, text), public.admin_set_email_verification(boolean, text) TO authenticated, service_role;

-- ───────────────────────── prazo do cartão na tela do seller ─────────────────────────

-- `get_card_release_days(uuid)` perdeu o EXECUTE de `authenticated` numa revisão de permissões antiga, então "Taxas e
-- prazos" e "Minha conta" mostravam "Não foi possível carregar o prazo". A função com id continua só interna (o gatilho
-- que grava a data de liberação da venda a usa); o seller lê o próprio prazo por esta, sem argumento.
CREATE OR REPLACE FUNCTION app_private.get_my_card_release_days()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.get_card_release_days(auth.uid()) END; $$;

CREATE OR REPLACE FUNCTION public.get_my_card_release_days()
RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_my_card_release_days(); $$;

REVOKE ALL ON FUNCTION app_private.get_my_card_release_days() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_card_release_days() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_my_card_release_days(), public.get_my_card_release_days() TO authenticated, service_role;
