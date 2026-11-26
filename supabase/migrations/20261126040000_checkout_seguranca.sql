-- Checkout: travas que faltavam no servidor (revisão do checkout e do construtor, 2026-11-26).
--
-- 1. order_bumps: a policy "Owners manage order bumps" só confere o produto PRINCIPAL. Qualquer seller podia
--    pendurar o produto de OUTRO seller (ou o próprio produto) como oferta no seu checkout, e não havia limite
--    de ofertas. O gatilho abaixo exige o mesmo dono, proíbe oferecer o próprio produto e limita a 5 por produto
--    (o mesmo limite das telas). Em produção não existe nenhum bump que quebre essas regras (conferido antes).
-- 2. get_public_payment_link: devolvia título, valor, descrição e instruções de link DESATIVADO ou BLOQUEADO
--    pela equipe para qualquer um que soubesse o endereço (a página escondia, a RPC não). Agora só o link aberto
--    traz os dados; o fechado traz só o necessário para a página dizer "não encontrado" / "indisponível".
-- 3. increment_payment_link_clicks: comparava o slug com diferença de maiúsculas, enquanto a página abre o link
--    sem diferenciar; o clique de quem digitou com outra caixa não contava. Também ignora link arquivado/bloqueado.
-- 4. validate_coupon: aceitava cupom de produto excluído (deleted_at preenchido mas status ainda 'active').
-- 5. get_checkout_status: respondia o status de qualquer transação, de qualquer data, a quem tivesse o id.
--    O checkout só consulta cobranças abertas há poucas horas; agora vale para as dos últimos 7 dias,
--    o mesmo prazo do resumo da compra (get_thank_you_summary).

-- ───────── 1. order bumps ─────────
CREATE OR REPLACE FUNCTION app_private.guard_order_bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _bump_owner uuid;
  _count integer;
BEGIN
  SELECT user_id INTO _owner FROM public.products WHERE id = NEW.product_id;
  SELECT user_id INTO _bump_owner FROM public.products WHERE id = NEW.bump_product_id;
  IF _owner IS NULL OR _bump_owner IS NULL THEN
    RAISE EXCEPTION 'order_bump_product_not_found' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.bump_product_id = NEW.product_id THEN
    RAISE EXCEPTION 'order_bump_self' USING ERRCODE = 'check_violation';
  END IF;
  IF _owner <> _bump_owner THEN
    RAISE EXCEPTION 'order_bump_not_owner' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    -- Duas abas adicionando ao mesmo tempo não passam do limite.
    PERFORM pg_advisory_xact_lock(hashtext('order_bumps:' || NEW.product_id::text));
    SELECT count(*) INTO _count FROM public.order_bumps WHERE product_id = NEW.product_id AND id <> NEW.id;
    IF _count >= 5 THEN
      RAISE EXCEPTION 'order_bump_limit' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.sort_order := least(greatest(coalesce(NEW.sort_order, 0), 0), 100);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.guard_order_bump() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_00_guard_order_bump ON public.order_bumps;
CREATE TRIGGER trg_00_guard_order_bump
  BEFORE INSERT OR UPDATE OF product_id, bump_product_id, sort_order ON public.order_bumps
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_order_bump();

-- ───────── 2. link de pagamento público ─────────
CREATE OR REPLACE FUNCTION app_private.get_public_payment_link(_slug text)
RETURNS TABLE(id uuid, slug text, title text, description text, cover_url text, amount numeric, is_active boolean, accept_pix boolean, accept_card boolean, accept_boleto boolean, max_uses integer, current_uses integer, expires_at timestamp with time zone, billing_type text, pricing_type text, min_amount numeric, max_amount numeric, suggested_amount numeric, allow_quantity boolean, max_quantity integer, reference_code text, instructions text, pix_expiration_minutes integer, recurrence_interval text, recurrence_interval_count integer, recurrence_cycles integer, trial_days integer, cancellation_policy text, admin_status text, redirect_url text, options jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH l AS (
    SELECT p.*, pr.pix_enabled AS pr_pix, pr.credit_card_enabled AS pr_card, pr.boleto_enabled AS pr_boleto,
           (coalesce(p.is_active, false) AND p.admin_status IS DISTINCT FROM 'blocked') AS open
    FROM public.payment_links p
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE _slug IS NOT NULL AND length(_slug) BETWEEN 1 AND 160
      AND lower(p.slug) = lower(trim(_slug)) AND p.archived_at IS NULL
    LIMIT 1
  )
  SELECT l.id, l.slug,
         CASE WHEN l.open THEN l.title END,
         CASE WHEN l.open THEN l.description END,
         CASE WHEN l.open THEN l.cover_url END,
         CASE WHEN l.open THEN l.amount END,
         coalesce(l.is_active, false),
         CASE WHEN l.open THEN (l.accept_pix AND coalesce(l.pr_pix, false)) ELSE false END,
         CASE WHEN l.open THEN (l.accept_card AND coalesce(l.pr_card, false)) ELSE false END,
         CASE WHEN l.open THEN (l.accept_boleto AND coalesce(l.pr_boleto, false)) ELSE false END,
         CASE WHEN l.open THEN l.max_uses END,
         CASE WHEN l.open THEN l.current_uses END,
         CASE WHEN l.open THEN l.expires_at END,
         CASE WHEN l.open THEN l.billing_type END,
         CASE WHEN l.open THEN l.pricing_type END,
         CASE WHEN l.open THEN l.min_amount END,
         CASE WHEN l.open THEN l.max_amount END,
         CASE WHEN l.open THEN l.suggested_amount END,
         CASE WHEN l.open THEN l.allow_quantity END,
         CASE WHEN l.open THEN l.max_quantity END,
         CASE WHEN l.open THEN l.reference_code END,
         CASE WHEN l.open THEN l.instructions END,
         CASE WHEN l.open THEN l.pix_expiration_minutes END,
         CASE WHEN l.open THEN l.recurrence_interval END,
         CASE WHEN l.open THEN l.recurrence_interval_count END,
         CASE WHEN l.open THEN l.recurrence_cycles END,
         CASE WHEN l.open THEN l.trial_days END,
         CASE WHEN l.open THEN l.cancellation_policy END,
         CASE WHEN l.admin_status = 'blocked' THEN 'blocked' ELSE l.admin_status END,
         CASE WHEN l.open THEN l.redirect_url END,
         CASE WHEN l.open THEN COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'description', o.description, 'amount_delta', o.amount_delta, 'is_required', o.is_required) ORDER BY o.position)
           FROM public.payment_link_options o WHERE o.payment_link_id = l.id AND o.is_active), '[]'::jsonb)
         ELSE '[]'::jsonb END
  FROM l;
$$;

CREATE OR REPLACE FUNCTION app_private.increment_payment_link_clicks(_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _allowed boolean;
BEGIN
  IF _slug IS NULL OR length(trim(_slug)) < 3 OR length(_slug) > 160 THEN RETURN; END IF;
  SELECT allowed INTO _allowed
  FROM public.bump_rate_limit('payment_link_click:' || lower(trim(_slug)), 60, 300)
  LIMIT 1;
  IF COALESCE(_allowed, false) THEN
    UPDATE public.payment_links
    SET clicks = COALESCE(clicks, 0) + 1
    WHERE lower(slug) = lower(trim(_slug))
      AND is_active = true
      AND archived_at IS NULL
      AND admin_status IS DISTINCT FROM 'blocked';
  END IF;
END;
$$;

-- ───────── 4. cupom ─────────
CREATE OR REPLACE FUNCTION app_private.validate_coupon(_code text, _product_id uuid, _amount numeric)
RETURNS TABLE(valid boolean, coupon_id uuid, discount_amount numeric, discount_type text, discount_value numeric, apply_to_bumps boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _coupon record;
  _discount numeric := 0;
  _allowed boolean;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 OR length(trim(_code)) > 80 OR _amount IS NULL OR _amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  SELECT allowed INTO _allowed
  FROM public.bump_rate_limit('coupon:' || _product_id::text || ':' || md5(lower(trim(_code))), 60, 120)
  LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Tente novamente em instantes'; RETURN;
  END IF;
  SELECT user_id INTO _owner FROM public.products WHERE id = _product_id AND status = 'active' AND deleted_at IS NULL LIMIT 1;
  IF _owner IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  SELECT * INTO _coupon FROM public.coupons
  WHERE user_id = _owner AND upper(code) = upper(trim(_code)) AND is_active = true LIMIT 1;
  IF _coupon IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom expirado'; RETURN;
  END IF;
  IF _coupon.max_uses IS NOT NULL AND _coupon.current_uses >= _coupon.max_uses THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom esgotado'; RETURN;
  END IF;
  IF _coupon.product_id IS NOT NULL AND _coupon.product_id <> _product_id THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric, NULL::text, 0::numeric, false, 'Cupom inválido'; RETURN;
  END IF;
  IF _coupon.discount_type = 'percentage' THEN
    _discount := round((_amount * _coupon.discount_value / 100)::numeric, 2);
  ELSE
    _discount := _coupon.discount_value;
  END IF;
  _discount := greatest(least(_discount, _amount - 0.01), 0);
  RETURN QUERY SELECT true, _coupon.id, _discount, _coupon.discount_type, _coupon.discount_value, _coupon.apply_to_bumps, NULL::text;
END;
$$;

-- ───────── 5. status da cobrança ─────────
CREATE OR REPLACE FUNCTION app_private.get_checkout_status(_transaction_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT status FROM public.transactions
  WHERE id = _transaction_id AND created_at > now() - interval '7 days'
  LIMIT 1;
$$;

-- As wrappers públicas (INVOKER) continuam as mesmas; garante o EXECUTE que elas precisam.
GRANT EXECUTE ON FUNCTION app_private.get_public_payment_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.increment_payment_link_clicks(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.validate_coupon(text, uuid, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_checkout_status(uuid) TO anon, authenticated;
