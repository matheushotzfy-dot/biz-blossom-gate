-- Afiliados no checkout público: contagem de cliques e atribuição da venda.
--
-- 1) register_affiliate_click(produto, slug): o checkout chama ao abrir um link ?aff=<slug>. Só conta se o link existe,
--    está ativo e é daquele produto, e só se o produto está ativo com programa de afiliados ligado. Limite de 300
--    cliques por minuto por link, para um laço no navegador não inflar o número.
-- 2) resolve_affiliate_link(produto, slug): devolve o id do link que a função de cobrança vai gravar em
--    transactions.affiliate_link_id. É para uso do servidor (service_role): o navegador nunca escolhe o id.
-- 3) `clicks` só muda pela função do item 1. Antes o próprio afiliado podia editar o número direto na tabela
--    (a política de UPDATE deixava) ou criar o link já com um valor alto.

-- ── 1) Cliques ──────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.register_affiliate_click(_product_id uuid, _slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _link uuid;
  _allowed boolean;
BEGIN
  IF _product_id IS NULL OR _slug IS NULL OR _slug !~ '^[A-Za-z0-9_-]{3,64}$' THEN
    RETURN false;
  END IF;

  SELECT al.id INTO _link
  FROM public.affiliate_links al
  JOIN public.products p ON p.id = al.product_id
  WHERE al.slug = _slug
    AND al.product_id = _product_id
    AND al.is_active = true
    AND p.status = 'active'
    AND p.deleted_at IS NULL
    AND p.affiliate_enabled = true
  LIMIT 1;
  IF _link IS NULL THEN RETURN false; END IF;

  SELECT allowed INTO _allowed FROM public.bump_rate_limit('affclick:' || _link::text, 60, 300) LIMIT 1;
  IF NOT COALESCE(_allowed, false) THEN RETURN false; END IF;

  PERFORM set_config('app.affiliate_click', '1', true);
  UPDATE public.affiliate_links SET clicks = clicks + 1 WHERE id = _link;
  PERFORM set_config('app.affiliate_click', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_affiliate_click(_product_id uuid, _slug text)
RETURNS boolean
LANGUAGE sql
SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.register_affiliate_click($1, $2) $$;

REVOKE ALL ON FUNCTION app_private.register_affiliate_click(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_affiliate_click(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.register_affiliate_click(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_affiliate_click(uuid, text) TO anon, authenticated, service_role;

-- ── 2) Resolução do link para a cobrança (só servidor) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.resolve_affiliate_link(_product_id uuid, _slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT al.id
  FROM public.affiliate_links al
  JOIN public.products p ON p.id = al.product_id
  WHERE _slug ~ '^[A-Za-z0-9_-]{3,64}$'
    AND al.slug = _slug
    AND al.product_id = _product_id
    AND al.is_active = true
    AND al.owner_user_id = p.user_id
    AND p.status = 'active'
    AND p.deleted_at IS NULL
    AND p.affiliate_enabled = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.resolve_affiliate_link(_product_id uuid, _slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.resolve_affiliate_link($1, $2) $$;

REVOKE ALL ON FUNCTION app_private.resolve_affiliate_link(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_affiliate_link(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.resolve_affiliate_link(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_affiliate_link(uuid, text) TO service_role;

-- ── 3) `clicks` só muda pela função de cliques ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pin_affiliate_commission_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_owner uuid; v_enabled boolean; v_pct numeric;
begin
  select user_id, affiliate_enabled, affiliate_commission into v_owner, v_enabled, v_pct
    from public.products where id = new.product_id and status = 'active';
  if not found or not coalesce(v_enabled, false) then
    raise exception 'Este produto não aceita afiliados';
  end if;
  if v_owner = new.affiliate_user_id then
    raise exception 'Você não pode divulgar o seu próprio produto';
  end if;
  new.owner_user_id := v_owner;
  new.commission_pct := coalesce(v_pct, 30);
  new.clicks := 0;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.protect_affiliate_links_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_owner uuid;
begin
  -- O contador só anda pela função register_affiliate_click (ela liga o aviso só dentro da própria transação).
  if coalesce(current_setting('app.affiliate_click', true), '') <> '1' then
    new.clicks := old.clicks;
  end if;
  select p.user_id into v_owner from public.products p where p.id = new.product_id;
  if auth.uid() is distinct from v_owner and not public.has_role(auth.uid(), 'admin'::app_role) then
    new.commission_pct    := old.commission_pct;
    new.product_id        := old.product_id;
    new.affiliate_user_id := old.affiliate_user_id;
    new.owner_user_id     := old.owner_user_id;
    new.slug              := old.slug;
    new.paused_by_owner   := old.paused_by_owner;
    if old.paused_by_owner then new.is_active := old.is_active; end if;
  else
    if new.is_active is distinct from old.is_active then new.paused_by_owner := not new.is_active; end if;
  end if;
  return new;
end $$;
