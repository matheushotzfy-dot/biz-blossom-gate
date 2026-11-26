-- Pendências técnicas anotadas nas revisões (plano da plataforma, Fase 5). Pode rodar de novo sem erro.

-- 1) Disputa do tipo reembolso decidida a favor do cliente marcava a venda como CHARGEBACK.
--    Agora vira "refunded" com `refunded_amount` = valor da venda (os outros tipos continuam chargeback). O dinheiro
--    não muda: a venda sai de "disputed" (não paga), então o ledger não lança nada de novo; o valor congelado já é o
--    débito. Webhook (`payment.refunded`), estorno da comissão da equipe e a vaga do cupom já tratam "refunded".
DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.handle_dispute_balance()'::regprocedure);
  IF position('WHEN NEW.type = ''refund'' THEN ''refunded''' in d) > 0 THEN RETURN; END IF;
  IF position('UPDATE public.transactions SET status = ''chargeback'', updated_at = now() WHERE id = NEW.transaction_id AND status = ''disputed'';' in d) = 0 THEN
    RAISE EXCEPTION 'handle_dispute_balance não está na versão esperada';
  END IF;
  d := replace(d,
    'UPDATE public.transactions SET status = ''chargeback'', updated_at = now() WHERE id = NEW.transaction_id AND status = ''disputed'';',
    'UPDATE public.transactions SET status = CASE WHEN NEW.type = ''refund'' THEN ''refunded'' ELSE ''chargeback'' END, refunded_amount = CASE WHEN NEW.type = ''refund'' THEN amount ELSE refunded_amount END, updated_at = now() WHERE id = NEW.transaction_id AND status = ''disputed'';');
  EXECUTE d;
END $migration$;

-- 2) O ranking da corrida devolvia `is_manual` (participante com valor fixo) a qualquer seller.
--    Agora só o admin recebe o campo; para os outros ele vem nulo (a tela do seller não usa).
DO $migration$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('app_private.race_leaderboard(uuid)'::regprocedure);
  IF position('THEN is_manual ELSE NULL::boolean END AS is_manual' in d) > 0 THEN RETURN; END IF;
  IF position(E'    position AS rank_position,\n    is_manual\n  FROM ranked' in d) = 0 THEN
    RAISE EXCEPTION 'race_leaderboard não está na versão esperada';
  END IF;
  d := replace(d,
    E'    position AS rank_position,\n    is_manual\n  FROM ranked',
    E'    position AS rank_position,\n    CASE WHEN public.has_role(auth.uid(), ''admin''::public.app_role) THEN is_manual ELSE NULL::boolean END AS is_manual\n  FROM ranked');
  EXECUTE d;
END $migration$;

-- 3) Plano de assinatura: preço mínimo de R$ 1,00 (a tela já exigia, o banco aceitava 0) e só com produto do
--    próprio seller (a política de INSERT/UPDATE só conferia o dono do plano). Admin e service_role passam.
CREATE OR REPLACE FUNCTION app_private.guard_subscription_plans_admin_hold()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.admin_hold_at IS NOT NULL THEN
      RAISE EXCEPTION 'A equipe pausou este plano e ele só sai com a liberação do suporte.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE plan_id = OLD.id) THEN
      RAISE EXCEPTION 'Este plano tem assinantes e não pode ser apagado. Pause o plano em vez disso.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.price IS NULL OR NEW.price < 1 THEN
    RAISE EXCEPTION 'O preço do plano precisa ser de pelo menos R$ 1,00.' USING ERRCODE = '22023';
  END IF;
  IF NEW.product_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id)
     AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.user_id = auth.uid() AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Escolha um produto seu para este plano.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.admin_hold_reason := NULL; NEW.admin_hold_at := NULL;
    RETURN NEW;
  END IF;
  NEW.admin_hold_reason := OLD.admin_hold_reason;
  NEW.admin_hold_at := OLD.admin_hold_at;
  IF OLD.admin_hold_at IS NOT NULL AND COALESCE(NEW.is_active, false) THEN
    RAISE EXCEPTION 'A equipe pausou este plano e ele só volta com a liberação do suporte.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

-- 3b) A mesma regra do preço também no CHECK da tabela (vale para todos, inclusive admin e service_role).
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.subscription_plans'::regclass AND conname = 'valid_price'
             AND pg_get_constraintdef(oid) LIKE '%>= (0)%') THEN
    ALTER TABLE public.subscription_plans DROP CONSTRAINT valid_price;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.subscription_plans'::regclass AND conname = 'valid_price') THEN
    ALTER TABLE public.subscription_plans ADD CONSTRAINT valid_price CHECK (price >= 1) NOT VALID;
    ALTER TABLE public.subscription_plans VALIDATE CONSTRAINT valid_price;
  END IF;
END $migration$;

-- 4) Curso novo ligado a um produto não chegava a quem já tinha comprado o produto.
--    Ao ligar um curso a um produto (criação ou troca de produto), cada comprador com venda paga e não simulada
--    desse produto que já recebeu a entrega (ou cuja entrega falhou por "Produto sem curso vinculado") ganha
--    acesso ao curso novo, com a mesma venda de origem; a entrega que tinha falhado passa a "entregue".
--    Quem ainda espera a entrega (sem conta com e-mail confirmado) recebe todos os cursos do produto quando
--    `process_checkout_delivery` rodar. Acesso revogado não volta (ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION app_private.grant_course_to_product_buyers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.product_id IS NOT DISTINCT FROM OLD.product_id THEN RETURN NEW; END IF;

  INSERT INTO public.user_access (user_id, course_id, transaction_id, status, granted_at)
  SELECT DISTINCT ON (b.buyer_id) b.buyer_id, NEW.id, b.transaction_id, 'active', now()
  FROM (
    SELECT d.buyer_user_id AS buyer_id, d.transaction_id, t.created_at
    FROM public.checkout_delivery_attempts d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.product_id = NEW.product_id AND d.buyer_user_id IS NOT NULL
      AND (d.status = 'delivered' OR (d.status = 'failed' AND d.last_error = 'Produto sem curso vinculado'))
      AND t.product_id = NEW.product_id AND t.status IN ('approved','paid','completed') AND t.is_simulated = false
    UNION ALL
    SELECT ua.user_id, ua.transaction_id, t.created_at
    FROM public.user_access ua
    JOIN public.transactions t ON t.id = ua.transaction_id
    WHERE ua.status = 'active' AND t.product_id = NEW.product_id
      AND t.status IN ('approved','paid','completed') AND t.is_simulated = false
  ) b
  WHERE b.buyer_id <> NEW.user_id
  ORDER BY b.buyer_id, b.created_at DESC
  ON CONFLICT (user_id, course_id) DO NOTHING;

  UPDATE public.checkout_delivery_attempts d
  SET status = 'delivered', last_error = NULL, delivered_at = now(), updated_at = now()
  FROM public.transactions t
  WHERE t.id = d.transaction_id AND d.product_id = NEW.product_id AND d.buyer_user_id IS NOT NULL
    AND d.status = 'failed' AND d.last_error = 'Produto sem curso vinculado'
    AND t.status IN ('approved','paid','completed') AND t.is_simulated = false;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION app_private.grant_course_to_product_buyers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_grant_course_to_product_buyers ON public.courses;
CREATE TRIGGER trg_grant_course_to_product_buyers
  AFTER INSERT OR UPDATE OF product_id ON public.courses
  FOR EACH ROW EXECUTE FUNCTION app_private.grant_course_to_product_buyers();

-- 5) Pedido da equipe/sócio por e-mail do seller revelava se o e-mail tinha conta ("seller não encontrado" x
--    "seller fora da sua carteira" x pedido aceito) e quem errava não contava no limite (o erro desfazia tudo).
--    Agora e-mail sem conta, ou fora da carteira do gerente, devolve NULL sem gravar nada (a tela diz "não
--    encontramos esse seller entre as contas que você pode pedir"), e cada erro desses conta: 10 por hora.
CREATE OR REPLACE FUNCTION app_private.request_staff_action(_kind text, _target_seller uuid, _target_acquirer uuid, _payload jsonb, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _u uuid := auth.uid();
  _role text;
  _id uuid;
  _recent int;
  _seller uuid := _target_seller;
  _email text := lower(btrim(COALESCE(_payload->>'seller_email', '')));
  _r text := btrim(regexp_replace(COALESCE(_reason, ''), '[[:cntrl:]]+', ' ', 'g'));
  _miss_ok boolean;
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _u AND role::text IN ('partner','manager') ORDER BY role::text = 'partner' DESC LIMIT 1;
  IF _role IS NULL OR NOT app_private.has_financial_permission(_u,'request_actions') THEN RAISE EXCEPTION 'sem permissão para enviar pedidos'; END IF;
  IF _role = 'manager' AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _u AND frozen = true) THEN RAISE EXCEPTION 'sem permissão para enviar pedidos'; END IF;
  IF _kind NOT IN ('acquirer_change','acquirer_toggle','fee_change','seller_freeze','platform_setting','other') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF char_length(_r) < 5 OR char_length(_r) > 1000 THEN RAISE EXCEPTION 'motivo com 5 a 1000 caracteres'; END IF;
  SELECT count(*) INTO _recent FROM public.staff_action_requests WHERE requested_by = _u AND created_at > now() - interval '1 hour';
  IF _recent >= 30 THEN RAISE EXCEPTION 'muitos pedidos em sequência'; END IF;
  IF _seller IS NULL AND _email <> '' THEN
    IF length(_email) > 254 THEN RAISE EXCEPTION 'informe o seller'; END IF;
    SELECT user_id INTO _seller FROM public.profiles WHERE lower(email) = _email LIMIT 1;
    IF _seller IS NULL OR (_role = 'manager' AND NOT app_private.has_active_seller_assignment(_u, _seller)) THEN
      SELECT allowed INTO _miss_ok FROM public.bump_rate_limit('staff_request_miss:' || _u::text, 3600, 10);
      IF NOT COALESCE(_miss_ok, false) THEN RAISE EXCEPTION 'muitos pedidos em sequência'; END IF;
      RETURN NULL;
    END IF;
  END IF;
  IF _role = 'manager' AND _seller IS NOT NULL AND NOT app_private.has_active_seller_assignment(_u, _seller) THEN
    RAISE EXCEPTION 'seller fora da sua carteira';
  END IF;
  IF _kind IN ('acquirer_change','seller_freeze') AND _seller IS NULL THEN RAISE EXCEPTION 'informe o seller'; END IF;
  IF _kind IN ('acquirer_change','acquirer_toggle') AND (_target_acquirer IS NULL OR NOT EXISTS (SELECT 1 FROM public.acquirers WHERE id = _target_acquirer)) THEN RAISE EXCEPTION 'adquirente inválida'; END IF;
  INSERT INTO public.staff_action_requests(kind,target_seller_id,target_acquirer_id,payload,reason,requested_by,requested_role)
  VALUES (_kind,_seller,_target_acquirer,jsonb_build_object('seller_email',NULLIF(_email,''),'active',_payload->'active'),_r,_u,_role) RETURNING id INTO _id;
  INSERT INTO public.admin_alerts(kind,severity,message,metadata) VALUES ('staff_request','warning','Novo pedido da equipe aguardando aprovação', jsonb_build_object('request_id',_id,'kind',_kind,'role',_role));
  RETURN _id;
END $function$;
