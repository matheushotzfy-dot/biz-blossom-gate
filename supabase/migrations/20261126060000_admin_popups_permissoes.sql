-- Popups do admin que falhavam em produção por falta de permissão (achados na revisão de 2026-11-26).
--
-- 1) Aprovar seller com gerente, trocar/remover gerente e gerente padrão: os wrappers `public.*` são
--    SECURITY INVOKER e chamam `app_private.*`, mas a migration de 2026-10-06 só deu EXECUTE no wrapper.
--    Resultado: "permission denied for function" ao aprovar a verificação pelo admin e nos diálogos de gerente.
--    As funções de `app_private` conferem `assert_admin()` e `assert_recent_auth()` por dentro.
GRANT EXECUTE ON FUNCTION app_private.admin_approve_seller_with_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.remove_seller_manager(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.set_default_manager(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.transfer_seller_manager(uuid, uuid, text, timestamp with time zone) TO authenticated;

-- 2) Trocar a adquirente de um seller (aba Adquirentes): a migration de 2026-09-29 tirou o EXECUTE de
--    `authenticated`, mas a tela chama a função direto. Ela confere o papel de admin por dentro.
GRANT EXECUTE ON FUNCTION public.admin_set_seller_acquirer(uuid, uuid, text) TO authenticated;

-- 3) "Auto-aprovação de saques" no admin: a tela gravava `enabled`/`max_amount` em `seller_auto_withdraw`,
--    mas essa tabela é o SAQUE AUTOMÁTICO do próprio seller (`check_auto_withdrawal` cria um pedido quando o
--    saldo chega em `target_amount`, na chave `pix_key_id`); `max_amount` não é lido por nada e nada aprova
--    saque sozinho. Ligar pela tela do admin falhava no gatilho de validação (sem valor e chave do seller) e,
--    desde 2026-08-26, também por falta de permissão. A tela passa a mostrar o saque automático do seller
--    como ele é e o admin só pode DESLIGAR (motivo obrigatório; o seller é avisado e liga de novo no painel dele).
CREATE OR REPLACE FUNCTION app_private.admin_disable_seller_auto_withdraw(_seller uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _r text := left(NULLIF(btrim(regexp_replace(COALESCE(_reason, ''), '[[:cntrl:]]+', ' ', 'g')), ''), 300);
  _id uuid;
BEGIN
  IF _seller IS NULL THEN RAISE EXCEPTION 'escolha o seller'; END IF;
  IF _r IS NULL OR char_length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  UPDATE public.seller_auto_withdraw SET enabled = false, updated_at = now()
   WHERE user_id = _seller AND enabled = true
  RETURNING id INTO _id;
  IF _id IS NULL THEN RAISE EXCEPTION 'o saque automático deste seller já está desligado'; END IF;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_seller, 'Saque automático desligado',
          'A equipe desligou o seu saque automático. Motivo: ' || rtrim(_r, '.!? ') || '. Você pode ligar de novo em Saques.', 'warning');
  PERFORM app_private.admin_audit(_admin, 'auto_withdraw_disable', 'seller_auto_withdraw', _seller::text, jsonb_build_object('reason', _r));
  RETURN jsonb_build_object('user_id', _seller, 'enabled', false);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_disable_seller_auto_withdraw(_seller uuid, _reason text)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $function$ SELECT app_private.admin_disable_seller_auto_withdraw($1, $2) $function$;

REVOKE ALL ON FUNCTION app_private.admin_disable_seller_auto_withdraw(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_disable_seller_auto_withdraw(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.admin_disable_seller_auto_withdraw(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_seller_auto_withdraw(uuid, text) TO authenticated;
