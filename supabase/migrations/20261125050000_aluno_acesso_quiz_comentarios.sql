-- Área do aluno: entrega de acesso, quiz e comentários.
--
-- 1) process_checkout_delivery
--    a) só entrega para conta com e-mail CONFIRMADO (antes, quem cadastrasse o e-mail de outra
--       pessoa antes dela receberia o curso dela);
--    b) entrega TODOS os cursos do produto (antes: `LIMIT 1` sem ordem, ou seja, um curso qualquer
--       quando o produto tem mais de um).
-- 2) Entrega pendente é refeita sozinha quando o e-mail é confirmado (trigger em auth.users, que nunca
--    bloqueia o cadastro) e sob demanda pelo aluno (claim_my_pending_deliveries, botão "Atualizar acesso").
-- 3) quiz_attempts: o aluno só LÊ as próprias tentativas. Antes a política era ALL: dava para inserir uma
--    tentativa com nota 100, ou apagar tentativas para burlar o limite. A correção continua em grade_quiz_attempt
--    (SECURITY DEFINER).
-- 4) Aula grátis só é legível quando o curso está publicado (antes, qualquer pessoa lia título e vídeo de
--    aula grátis de curso em rascunho).
-- 5) get_lesson_comment_authors: nomes de quem comentou ("Maria S."), sem expor perfil completo nem e-mail.

------------------------------------------------------------------------------------------------------
-- 1) Entrega de acesso
------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.process_checkout_delivery(_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tx public.transactions%ROWTYPE;
  _buyer_id uuid;
  _granted integer;
  _delivery_id uuid;
  _email text;
  _alert_key text;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;
  IF _tx.status NOT IN ('approved','paid','completed') THEN
    RAISE EXCEPTION 'payment is not confirmed';
  END IF;
  IF _tx.product_id IS NULL OR _tx.user_id IS NULL THEN
    RAISE EXCEPTION 'transaction product or seller is missing';
  END IF;

  _email := lower(btrim(COALESCE(_tx.customer_email, '')));
  IF _email = '' OR length(_email) > 255 THEN
    RAISE EXCEPTION 'customer email is invalid';
  END IF;

  INSERT INTO public.checkout_delivery_attempts(
    transaction_id, product_id, seller_user_id, customer_email, status, attempt_count, last_attempt_at
  ) VALUES (
    _tx.id, _tx.product_id, _tx.user_id, _email, 'pending', 1, now()
  )
  ON CONFLICT (transaction_id, product_id) DO UPDATE SET
    attempt_count = public.checkout_delivery_attempts.attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  RETURNING id INTO _delivery_id;

  -- Só conta com e-mail confirmado recebe acesso: quem digitou o e-mail de outra pessoa não prova que é dela.
  SELECT id INTO _buyer_id
  FROM auth.users
  WHERE lower(email) = _email
    AND email_confirmed_at IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF _buyer_id IS NULL THEN
    UPDATE public.checkout_delivery_attempts
    SET status='pending', last_error='Aguardando conta do comprador com e-mail confirmado', updated_at=now()
    WHERE id=_delivery_id;

    _alert_key := 'delivery_pending:' || _tx.id::text;
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_alerts
      WHERE kind='checkout_delivery_pending'
        AND metadata->>'dedupe_key'=_alert_key
    ) THEN
      INSERT INTO public.admin_alerts(kind,severity,message,metadata)
      VALUES ('checkout_delivery_pending','warning','Pagamento confirmado aguardando conta do comprador',
        jsonb_build_object('dedupe_key',_alert_key,'transaction_id',_tx.id,'product_id',_tx.product_id,'seller_user_id',_tx.user_id));
    END IF;
    RETURN jsonb_build_object('status','pending','delivery_id',_delivery_id);
  END IF;

  -- Todos os cursos do produto (inclusive rascunhos: quando forem publicados o aluno já tem acesso).
  INSERT INTO public.user_access(user_id,course_id,transaction_id,status,granted_at)
  SELECT _buyer_id, c.id, _tx.id, 'active', now()
  FROM public.courses c
  WHERE c.product_id = _tx.product_id
  ON CONFLICT (user_id,course_id) DO UPDATE SET
    transaction_id=EXCLUDED.transaction_id,status='active',granted_at=now(),revoked_at=NULL;
  GET DIAGNOSTICS _granted = ROW_COUNT;

  IF _granted = 0 THEN
    UPDATE public.checkout_delivery_attempts
    SET buyer_user_id=_buyer_id, status='failed', last_error='Produto sem curso vinculado', updated_at=now()
    WHERE id=_delivery_id;
    RETURN jsonb_build_object('status','failed','delivery_id',_delivery_id,'reason','course_not_linked');
  END IF;

  UPDATE public.checkout_delivery_attempts
  SET buyer_user_id=_buyer_id,status='delivered',last_error=NULL,delivered_at=now(),updated_at=now()
  WHERE id=_delivery_id;

  RETURN jsonb_build_object('status','delivered','delivery_id',_delivery_id,'buyer_user_id',_buyer_id,'courses',_granted);
END;
$function$;

------------------------------------------------------------------------------------------------------
-- 2a) Refaz entregas pendentes quando o e-mail é confirmado (nunca bloqueia o cadastro/confirmação)
------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.deliver_pending_on_email_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _row record;
BEGIN
  BEGIN
    _email := lower(btrim(COALESCE(NEW.email, '')));
    IF _email <> '' THEN
      FOR _row IN
        SELECT transaction_id
        FROM public.checkout_delivery_attempts
        WHERE lower(customer_email) = _email
          AND status IN ('pending','failed')
        ORDER BY created_at
        LIMIT 50
      LOOP
        BEGIN
          PERFORM app_private.process_checkout_delivery(_row.transaction_id);
        EXCEPTION WHEN OTHERS THEN
          NULL; -- pagamento estornado/inválido: segue pendente para a revisão do admin
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deliver_pending_on_email_confirmed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.deliver_pending_on_email_confirmed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_deliver_pending_on_signup ON auth.users;
CREATE TRIGGER trg_deliver_pending_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION app_private.deliver_pending_on_email_confirmed();

DROP TRIGGER IF EXISTS trg_deliver_pending_on_confirm ON auth.users;
CREATE TRIGGER trg_deliver_pending_on_confirm
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION app_private.deliver_pending_on_email_confirmed();

------------------------------------------------------------------------------------------------------
-- 2b) "Atualizar acesso": o aluno pede a conferência das próprias compras pagas
------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.claim_my_pending_deliveries()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _row record;
  _res jsonb;
  _delivered integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT lower(btrim(u.email)) INTO _email
  FROM auth.users u
  WHERE u.id = _uid AND u.email_confirmed_at IS NOT NULL;

  IF _email IS NULL OR _email = '' THEN RETURN 0; END IF;

  FOR _row IN
    SELECT transaction_id
    FROM public.checkout_delivery_attempts
    WHERE lower(customer_email) = _email
      AND status IN ('pending','failed')
    ORDER BY created_at
    LIMIT 50
  LOOP
    BEGIN
      _res := app_private.process_checkout_delivery(_row.transaction_id);
      IF _res->>'status' = 'delivered' THEN _delivered := _delivered + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- pagamento não confirmado/estornado: continua pendente
    END;
  END LOOP;

  RETURN _delivered;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_my_pending_deliveries()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public', 'app_private'
AS $function$SELECT app_private.claim_my_pending_deliveries()$function$;

REVOKE ALL ON FUNCTION app_private.claim_my_pending_deliveries() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_my_pending_deliveries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.claim_my_pending_deliveries() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_my_pending_deliveries() TO authenticated, service_role;

------------------------------------------------------------------------------------------------------
-- 3) quiz_attempts: aluno só lê; quem grava é grade_quiz_attempt
------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users view own attempts" ON public.quiz_attempts;
CREATE POLICY "Users view own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

------------------------------------------------------------------------------------------------------
-- 4) Aula grátis só de curso publicado
--    A checagem fica numa função SECURITY DEFINER: dentro da política, ler courses/modules com as permissões do
--    próprio aluno esconderia a aula grátis de quem não comprou (RLS dessas tabelas).
------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.module_in_published_course(_module_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = _module_id AND c.is_published = true
  )
$function$;

REVOKE ALL ON FUNCTION app_private.module_in_published_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.module_in_published_course(uuid) TO anon, authenticated, service_role;

ALTER POLICY "View lessons of accessible courses" ON public.lessons
  USING (
    (is_free = true AND app_private.module_in_published_course(module_id))
    OR EXISTS (
      SELECT 1
      FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
        AND (
          c.user_id = auth.uid()
          OR app_private.has_role(auth.uid(), 'admin'::app_role)
          OR (
            c.is_published = true
            AND (
              c.product_id IS NULL
              OR EXISTS (
                SELECT 1 FROM public.user_access ua
                WHERE ua.course_id = c.id AND ua.user_id = auth.uid() AND ua.status = 'active'
              )
            )
          )
        )
    )
  );

------------------------------------------------------------------------------------------------------
-- 5) Autores dos comentários da aula
------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.get_lesson_comment_authors(_lesson_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, is_producer boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _course uuid;
  _published boolean;
  _product uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT c.user_id, c.id, c.is_published, c.product_id
  INTO _owner, _course, _published, _product
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE l.id = _lesson_id
  LIMIT 1;

  IF _course IS NULL THEN RETURN; END IF;

  -- Mesma regra de leitura da política de lesson_comments.
  IF NOT (
    _owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      _published
      AND (
        _product IS NULL
        OR EXISTS (
          SELECT 1 FROM user_access ua
          WHERE ua.course_id = _course AND ua.user_id = auth.uid() AND ua.status = 'active'
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Só "Nome S." sai do banco: nunca o nome completo nem o e-mail.
  RETURN QUERY
  SELECT p.user_id,
         CASE
           WHEN n.words IS NULL OR array_length(n.words, 1) IS NULL THEN NULL
           WHEN array_length(n.words, 1) = 1 THEN left(n.words[1], 30)
           ELSE left(n.words[1], 30) || ' ' || upper(left(n.words[array_length(n.words, 1)], 1)) || '.'
         END,
         (p.user_id = _owner)
  FROM profiles p
  CROSS JOIN LATERAL (
    SELECT regexp_split_to_array(
             NULLIF(btrim(COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.nickname), ''))), ''),
             '\s+'
           ) AS words
  ) n
  WHERE p.user_id IN (SELECT DISTINCT cm.user_id FROM lesson_comments cm WHERE cm.lesson_id = _lesson_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_lesson_comment_authors(_lesson_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, is_producer boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'app_private'
AS $function$SELECT * FROM app_private.get_lesson_comment_authors($1)$function$;

REVOKE ALL ON FUNCTION app_private.get_lesson_comment_authors(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_lesson_comment_authors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_lesson_comment_authors(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_lesson_comment_authors(uuid) TO authenticated, service_role;
