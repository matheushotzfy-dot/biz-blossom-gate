-- Correções achadas no teste de ponta a ponta de 2026-11-28 (cadastro → documentos → análise → produto → venda →
-- entrega → saldo → saque → reembolso → disputa, rodado no banco de produção dentro de transações desfeitas).
-- Pode rodar de novo sem erro.

-- 1) GRAVE: o adquirente (chave de serviço) não conseguiria marcar uma venda como paga.
--    `protect_transaction_status` só olhava o ajuste antigo `request.jwt.claim.role`, que o PostgREST atual não
--    preenche mais (ele manda só `request.jwt.claims`). Com a chave de serviço, a troca de status caía em
--    "transaction status is server-controlled". `auth.role()` lê os dois formatos.
DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.protect_transaction_status()'::regprocedure);
  IF position('COALESCE(auth.role(), '''')' in d) > 0 THEN RETURN; END IF;
  IF position('COALESCE(current_setting(''request.jwt.claim.role'', true), '''')' in d) = 0 THEN
    RAISE EXCEPTION 'protect_transaction_status não está na versão esperada';
  END IF;
  d := replace(d, 'COALESCE(current_setting(''request.jwt.claim.role'', true), '''')', 'COALESCE(auth.role(), '''')');
  EXECUTE d;
END $migration$;

-- 2) Produto novo nascia "active" (padrão da coluna) e o seller podia criar já no ar, sem passar pela revisão.
--    Agora o seller só cria rascunho ou "em revisão"; quem põe no ar é a equipe (admin e chave de serviço passam).
--    A classificação interna (white/gray/black) também não é do seller.
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'draft';

CREATE OR REPLACE FUNCTION app_private.guard_product_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('draft', 'pending_review') THEN NEW.status := 'draft'; END IF;
  NEW.rejection_reason := NULL;
  NEW.classification := 'white';
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION app_private.guard_product_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_00_guard_product_insert ON public.products;
CREATE TRIGGER trg_00_guard_product_insert BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_product_insert();

-- 3) Aviso de produto: a primeira aprovação dizia "reaprovado … ativo novamente". Textos sem emoji.
CREATE OR REPLACE FUNCTION public.notify_product_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _title text;
  _message text;
  _reason text;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  -- Rascunho é do seller: ele mesmo envia para revisão, sem aviso.
  IF NEW.status = 'draft' OR OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  _reason := NULLIF(trim(COALESCE(NEW.rejection_reason, '')), '');

  IF NEW.status = 'pending_review' THEN
    _title := 'Produto em revisão';
    _message := format('O produto "%s" entrou em revisão pela equipe e saiu do ar até a análise terminar.%s',
      NEW.name, CASE WHEN _reason IS NOT NULL THEN ' Motivo: ' || _reason ELSE '' END);
  ELSIF NEW.status = 'inactive' THEN
    _title := 'Produto desativado';
    _message := format('O produto "%s" foi desativado pela equipe.%s',
      NEW.name, CASE WHEN _reason IS NOT NULL THEN ' Motivo: ' || _reason ELSE '' END);
  ELSIF NEW.status = 'active' AND OLD.status = 'pending_review' THEN
    _title := 'Produto aprovado';
    _message := format('O produto "%s" foi aprovado e o checkout já pode receber vendas.', NEW.name);
  ELSIF NEW.status = 'active' AND OLD.status = 'inactive' THEN
    _title := 'Produto reativado';
    _message := format('O produto "%s" voltou a ficar ativo.', NEW.name);
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (NEW.user_id, _title, _message, 'product');
  RETURN NEW;
END;
$function$;

-- 4) Avisos ao seller sobre a verificação diziam "KYC aprovado/recusado" (termo interno da equipe).
DO $migration$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'app_private.admin_approve_kyc', 'app_private.admin_reject_kyc',
    'app_private.admin_approve_seller_with_manager', 'app_private.staff_review_kyc'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname || '.' || p.proname = f LIMIT 1;
    IF d IS NULL THEN CONTINUE; END IF;
    IF position('KYC aprovado' in d) = 0 AND position('KYC recusado' in d) = 0 THEN CONTINUE; END IF;
    d := replace(replace(d, '''KYC aprovado''', '''Cadastro aprovado'''), '''KYC recusado''', '''Cadastro recusado''');
    EXECUTE d;
  END LOOP;
END $migration$;

-- 5) Valores nos avisos ao seller saíam no formato americano ("R$ 91.18", "R$ 1,234.56": o banco usa en_US).
--    `app_private.fmt_brl` escreve "R$ 1.234,56" sem depender do idioma do servidor.
CREATE OR REPLACE FUNCTION app_private.fmt_brl(_v numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT 'R$ ' || replace(replace(replace(to_char(round(COALESCE(_v, 0), 2), 'FM999,999,999,990.00'), ',', '#'), '.', ','), '#', '.')
$function$;
GRANT EXECUTE ON FUNCTION app_private.fmt_brl(numeric) TO authenticated, service_role;

DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.notify_transaction_paid()'::regprocedure);
  IF position('app_private.fmt_brl' in d) = 0 THEN
    d := replace(d, '''Você recebeu R$ '' || to_char(COALESCE(NEW.net_amount, 0), ''FM999999990.00'') || '' líquidos.''',
                    '''Você recebeu '' || app_private.fmt_brl(NEW.net_amount) || '' líquidos.''');
    IF position('app_private.fmt_brl' in d) = 0 THEN RAISE EXCEPTION 'notify_transaction_paid não está na versão esperada'; END IF;
    EXECUTE d;
  END IF;

  d := pg_get_functiondef('public.notify_withdrawal_status_change()'::regprocedure);
  IF position('app_private.fmt_brl' in d) = 0 THEN
    d := replace(d, '''Seu saque de R$ '' || to_char(NEW.amount, ''FM999G999G990D00'') || ''', '''Seu saque de '' || app_private.fmt_brl(NEW.amount) || ''');
    IF position('app_private.fmt_brl' in d) = 0 THEN RAISE EXCEPTION 'notify_withdrawal_status_change não está na versão esperada'; END IF;
    EXECUTE d;
  END IF;

  d := pg_get_functiondef('public.handle_dispute_balance()'::regprocedure);
  IF position('app_private.fmt_brl' in d) = 0 THEN
    d := replace(d, '. R$ '' || to_char(_hold,''FM999999990.00'') || '' congelados', '. '' || app_private.fmt_brl(_hold) || '' congelados');
    IF position('app_private.fmt_brl' in d) = 0 THEN RAISE EXCEPTION 'handle_dispute_balance não está na versão esperada'; END IF;
    EXECUTE d;
  END IF;
END $migration$;

-- 6) "Saldo insuficiente. Disponível: R$ 273.54" (o seller lê essa mensagem no pedido de saque) passa a "R$ 273,54".
DO $migration$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.validate_withdrawal()', 'public.validate_withdrawal_balance()', 'public.validate_withdrawal_amount()'] LOOP
    IF to_regprocedure(f) IS NULL THEN CONTINUE; END IF;
    d := pg_get_functiondef(to_regprocedure(f));
    IF position('Disponível: R$ %'', ROUND(_available, 2)' in d) = 0 THEN CONTINUE; END IF;
    d := replace(d, 'Disponível: R$ %'', ROUND(_available, 2)', 'Disponível: %'', app_private.fmt_brl(_available)');
    EXECUTE d;
  END LOOP;
END $migration$;

-- 7) Reembolso total ou disputa perdida tirava o acesso ao curso mesmo de quem tinha OUTRA compra paga do mesmo
--    produto com o mesmo e-mail (o acesso aponta para a última venda entregue). Agora o acesso passa para a outra
--    compra paga e só é revogado quando não sobra nenhuma.
CREATE OR REPLACE FUNCTION app_private.revoke_access_for_tx(_tx uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _t public.transactions%ROWTYPE; _other uuid;
BEGIN
  SELECT * INTO _t FROM public.transactions WHERE id = _tx;
  IF FOUND AND _t.product_id IS NOT NULL AND btrim(COALESCE(_t.customer_email, '')) <> '' THEN
    SELECT o.id INTO _other FROM public.transactions o
     WHERE o.id <> _tx AND o.product_id = _t.product_id
       AND lower(btrim(o.customer_email)) = lower(btrim(_t.customer_email))
       AND o.status IN ('approved', 'paid', 'completed') AND o.is_simulated = false
     ORDER BY o.created_at DESC LIMIT 1;
  END IF;
  IF _other IS NOT NULL THEN
    UPDATE public.user_access SET transaction_id = _other WHERE transaction_id = _tx AND status = 'active';
  END IF;
  UPDATE public.user_access SET status = 'revoked', revoked_at = now() WHERE transaction_id = _tx AND status IS DISTINCT FROM 'revoked';
END $function$;
REVOKE ALL ON FUNCTION app_private.revoke_access_for_tx(uuid) FROM PUBLIC, anon, authenticated;

-- 8) "Congelar saldo" no admin grava profiles.balance_frozen e avisa o seller que os saques estão bloqueados,
--    mas a trava de saque só lia a coluna antiga profiles.frozen: o seller congelado conseguia sacar.
--    A trava passa a ler as duas, e as mensagens deixam de falar "KYC" com o seller.
CREATE OR REPLACE FUNCTION public.enforce_kyc_on_withdrawal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _status text; _frozen boolean;
BEGIN
  SELECT account_status, (COALESCE(frozen, false) OR COALESCE(balance_frozen, false)) INTO _status, _frozen
    FROM public.profiles WHERE user_id = NEW.user_id;
  IF _frozen IS TRUE THEN
    RAISE EXCEPTION 'Seu saldo está congelado pelo time de risco. Os saques voltam quando a análise terminar.';
  END IF;
  IF _status = 'blocked' THEN
    RAISE EXCEPTION 'Sua conta está bloqueada. Fale com o suporte.';
  END IF;
  IF COALESCE(_status, 'pending') <> 'approved' THEN
    RAISE EXCEPTION 'Seu cadastro ainda não foi aprovado. O saque fica liberado depois da aprovação.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_account_status_on_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _status text; _frozen boolean;
BEGIN
  SELECT account_status, balance_frozen INTO _status, _frozen FROM public.profiles WHERE user_id = NEW.user_id;
  IF _status = 'blocked' THEN
    RAISE EXCEPTION 'Sua conta está bloqueada. Não é possível criar produtos.';
  END IF;
  IF _status = 'rejected' THEN
    RAISE EXCEPTION 'Seu cadastro foi recusado. Ajuste os dados e reenvie para criar produtos.';
  END IF;
  IF COALESCE(_status, 'pending') NOT IN ('approved', 'active') THEN
    RAISE EXCEPTION 'Seu cadastro ainda está em análise. Você cria produtos depois da aprovação.';
  END IF;
  IF _frozen = true THEN
    RAISE EXCEPTION 'Seu saldo está congelado pelo time de risco. A criação de produtos volta quando a análise terminar.';
  END IF;
  RETURN NEW;
END;
$function$;

-- 9) Reembolso pelo seller: a checagem de conta bloqueada comparava profiles.id (que é diferente do id do usuário)
--    e status que não existem ('frozen','banned','suspended'), então nunca barrava nada. Agora barra conta bloqueada
--    e saldo congelado. Os valores das mensagens de reembolso saem em real ("R$ 91,18").
DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('app_private.seller_refund_transaction(uuid,numeric,text)'::regprocedure);
  d := replace(d,
    'IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND COALESCE(account_status,''active'') IN (''frozen'',''banned'',''suspended'')) THEN RAISE EXCEPTION ''conta bloqueada''; END IF;',
    'IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND account_status = ''blocked'') THEN RAISE EXCEPTION ''conta bloqueada''; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND (COALESCE(balance_frozen, false) OR COALESCE(frozen, false))) THEN RAISE EXCEPTION ''seu saldo está congelado, peça o reembolso ao suporte''; END IF;');
  d := replace(d, '(necessário R$ %)'', to_char(_net,''FM999999990.00'')', '(necessário %)'', app_private.fmt_brl(_net)');
  IF position('user_id = _uid AND account_status = ''blocked''' in d) = 0 OR position('fmt_brl(_net)' in d) = 0 THEN
    RAISE EXCEPTION 'seller_refund_transaction: trecho esperado não encontrado';
  END IF;
  EXECUTE d;

  d := pg_get_functiondef('app_private.admin_refund_transaction(uuid,numeric,text)'::regprocedure);
  IF position('(R$ %)'', to_char(_rem, ''FM999999990.00'')' in d) > 0 THEN
    d := replace(d, '(R$ %)'', to_char(_rem, ''FM999999990.00'')', '(%)'', app_private.fmt_brl(_rem)');
    EXECUTE d;
  END IF;
END $migration$;

-- 10) A trava de status das vendas só deixava passar a chave de serviço e o admin. Ficavam de fora:
--     - os jobs do próprio banco (pg_cron rodam sem JWT): o job de 5 em 5 minutos que expira Pix vencido
--       quebrava assim que havia um Pix para expirar, e nenhum Pix pendente expirava;
--     - o reembolso total feito pelo seller: record_transaction_refund marcava a venda como reembolsada e a
--       trava recusava ("transaction status is server-controlled"). Só o reembolso parcial funcionava.
--     Agora passam também: quem roda dentro do banco sem JWT (nunca uma requisição da API, que sempre traz um
--     papel) e a mudança para 'refunded' feita por record_transaction_refund, que liga uma marca local só
--     durante o próprio UPDATE.
CREATE OR REPLACE FUNCTION public.protect_transaction_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _jwt_role text := COALESCE(auth.role(), '');
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF _jwt_role = 'service_role' THEN RETURN NEW; END IF;
  IF _jwt_role = '' AND session_user NOT IN ('authenticator', 'anon', 'authenticated') THEN RETURN NEW; END IF;
  IF NEW.status = 'refunded' AND current_setting('app.tx_refund', true) = 'on' THEN RETURN NEW; END IF;
  IF app_private.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'transaction status is server-controlled';
END;
$function$;

DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.record_transaction_refund(uuid,numeric,text,uuid)'::regprocedure);
  IF position('app.tx_refund' in d) = 0 THEN
    d := replace(d, '  UPDATE public.transactions
  SET refunded_amount=_new_total,', '  PERFORM set_config(''app.tx_refund'', ''on'', true);
  UPDATE public.transactions
  SET refunded_amount=_new_total,');
    d := replace(d, '  WHERE id=_transaction_id;

  RETURN jsonb_build_object(', '  WHERE id=_transaction_id;
  PERFORM set_config(''app.tx_refund'', ''off'', true);

  RETURN jsonb_build_object(');
    IF (length(d) - length(replace(d, 'app.tx_refund', ''))) / length('app.tx_refund') <> 2 THEN
      RAISE EXCEPTION 'record_transaction_refund: trecho esperado não encontrado';
    END IF;
    EXECUTE d;
  END IF;
END $migration$;

-- 11) A liberação automática do valor retido das vendas no cartão só olhava vendas 'completed', status que nada
--     no sistema grava (venda paga fica 'approved'). Na prática o retido nunca voltava para o saldo do seller.
--     Passa a liberar vendas pagas ('approved', 'paid', 'completed') com o prazo vencido. Venda em disputa
--     ('disputed') continua presa até a decisão; reembolso e chargeback já liberam o retido no próprio gatilho.
DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.release_due_card_holds()'::regprocedure);
  IF position('WHERE status = ''completed''' in d) > 0 THEN
    d := replace(d, 'WHERE status = ''completed''', 'WHERE status IN (''approved'', ''paid'', ''completed'')');
    EXECUTE d;
  END IF;
END $migration$;
