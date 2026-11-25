-- APLICADA em 2026-11-25 (aprovada por Lucker, via Lovable query_database) — Marketing: coproduções e afiliados (versão final, inclui o trigger de INSERT e a linha do apply_transaction_splits).

-- ============================================================
-- 1) COPRODUÇÃO: aceitar vincula a conta do convidado; dono do registro não pode ser trocado
-- ============================================================
create or replace function public.protect_co_productions_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select p.user_id into v_owner from public.products p where p.id = new.product_id;

  if auth.uid() is distinct from v_owner and not public.has_role(auth.uid(), 'admin'::app_role) then
    -- convidado: só responde ao convite
    new.split_percentage   := old.split_percentage;
    new.product_id         := old.product_id;
    new.owner_user_id      := old.owner_user_id;
    new.co_producer_email  := old.co_producer_email;
    if new.status not in ('accepted','rejected') then new.status := old.status; end if;
    if new.status = 'accepted' then
      new.co_producer_user_id := auth.uid();
      new.accepted_at := coalesce(old.accepted_at, now());
    else
      new.co_producer_user_id := old.co_producer_user_id;
      new.accepted_at := old.accepted_at;
    end if;
  elsif auth.uid() = v_owner and old.status = 'accepted' and new.split_percentage <> old.split_percentage then
    raise exception 'A divisão não pode mudar depois que o parceiro aceita';
  end if;

  new.updated_at := now();
  return new;
end $$;

-- NOVO (não estava na proposta): convite novo só pode ser criado pelo dono real do produto, sempre pendente e sem
-- parceiro vinculado. Sem isso, o índice de "um convite aberto por produto" deixaria qualquer usuário travar o produto
-- de outra pessoa com um convite falso (a policy de INSERT só confere owner_user_id = auth.uid()).
create or replace function public.guard_co_productions_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;
  select p.user_id into v_owner from public.products p where p.id = new.product_id;
  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'Você só pode convidar co-produtor para um produto seu';
  end if;
  new.owner_user_id := v_owner;
  new.status := 'pending';
  new.co_producer_user_id := null;
  new.accepted_at := null;
  return new;
end $$;

drop trigger if exists trg_guard_co_productions_insert on public.co_productions;
create trigger trg_guard_co_productions_insert
  before insert on public.co_productions
  for each row execute function public.guard_co_productions_insert();

-- Regras básicas: um convite ativo por produto, divisão de 1 a 99, status válidos (tabela vazia: já nasce validado).
create unique index if not exists co_productions_one_open_per_product
  on public.co_productions (product_id) where status in ('pending','accepted');
alter table public.co_productions drop constraint if exists co_productions_split_range;
alter table public.co_productions drop constraint if exists co_productions_status_valid;
alter table public.co_productions
  add constraint co_productions_split_range check (split_percentage between 1 and 99),
  add constraint co_productions_status_valid check (status in ('pending','accepted','rejected'));

-- ============================================================
-- 2) apply_transaction_splits
--    (a) só aceita coprodução do dono real: WHERE ... AND owner_user_id = _tx.user_id
--    (b) CORREÇÃO DE BUG: a versão atual faz `_afflink := NULL` e depois lê `_afflink.affiliate_user_id`, o que dá erro
--        "record is not assigned yet" em TODA venda sem link de afiliado. Como ledger_on_transaction_change chama esta
--        função sem proteção, a aprovação da venda real inteira falharia. Troquei o RECORD por variáveis simples.
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_transaction_splits(_tx_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tx RECORD;
  _coprod RECORD;
  _aff_id uuid;
  _aff_user uuid;
  _aff_pct numeric;
  _split numeric := 0;
  _bal_co numeric;
  _bal_owner numeric;
  _bal_aff numeric;
  _bal_sell numeric;
  _comm numeric := 0;
  _max_affiliate numeric;
BEGIN
  SELECT id, product_id, user_id, net_amount, amount, status, is_simulated, affiliate_link_id
  INTO _tx FROM public.transactions WHERE id = _tx_id;
  IF NOT FOUND OR _tx.is_simulated OR _tx.status NOT IN ('approved','paid','completed') OR _tx.product_id IS NULL THEN RETURN; END IF;

  SELECT id, co_producer_user_id, owner_user_id, split_percentage
  INTO _coprod FROM public.co_productions
  WHERE product_id = _tx.product_id AND status = 'accepted' AND owner_user_id = _tx.user_id LIMIT 1;

  IF FOUND AND _coprod.co_producer_user_id IS NOT NULL THEN
    _split := LEAST(ROUND(_tx.net_amount * _coprod.split_percentage / 100.0, 2), _tx.net_amount);
    IF _split > 0 AND NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key='split_c_'||_tx_id||'_'||_coprod.id) THEN
      PERFORM pg_advisory_xact_lock(hashtext(_coprod.co_producer_user_id::text));
      PERFORM pg_advisory_xact_lock(hashtext(_coprod.owner_user_id::text));
      _bal_co := public.calculate_ledger_balance(_coprod.co_producer_user_id);
      _bal_owner := public.calculate_ledger_balance(_coprod.owner_user_id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_coprod.co_producer_user_id,_tx_id,'split_credit',_split,_bal_co+_split,'Coprodução: '||_coprod.split_percentage||'% da venda','split_c_'||_tx_id||'_'||_coprod.id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_coprod.owner_user_id,_tx_id,'split_debit',_split,_bal_owner-_split,'Repasse coprodução: '||_coprod.split_percentage||'%','split_d_'||_tx_id||'_'||_coprod.id);
    END IF;
  END IF;

  _aff_id := NULL; _aff_user := NULL; _aff_pct := NULL;
  IF _tx.affiliate_link_id IS NOT NULL THEN
    SELECT id, affiliate_user_id, commission_pct
    INTO _aff_id, _aff_user, _aff_pct FROM public.affiliate_links
    WHERE id=_tx.affiliate_link_id AND is_active=true AND owner_user_id=_tx.user_id AND product_id=_tx.product_id;
  END IF;

  IF _aff_user IS NOT NULL THEN
    _comm := ROUND(_tx.net_amount * _aff_pct / 100.0, 2);
    _max_affiliate := GREATEST(_tx.net_amount-_split,0);
    _comm := LEAST(_comm,_max_affiliate);
    IF _comm > 0 AND NOT EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key='aff_c_'||_tx_id||'_'||_aff_id) THEN
      PERFORM pg_advisory_xact_lock(hashtext(_aff_user::text));
      PERFORM pg_advisory_xact_lock(hashtext(_tx.user_id::text));
      _bal_aff := public.calculate_ledger_balance(_aff_user);
      _bal_sell := public.calculate_ledger_balance(_tx.user_id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_aff_user,_tx_id,'affiliate_credit',_comm,_bal_aff+_comm,'Comissão afiliado: '||_aff_pct||'%','aff_c_'||_tx_id||'_'||_aff_id);
      INSERT INTO public.financial_ledger(user_id,transaction_id,entry_type,amount,balance_after,description,idempotency_key)
      VALUES (_tx.user_id,_tx_id,'affiliate_debit',_comm,_bal_sell-_comm,'Repasse comissão afiliado: '||_aff_pct||'%','aff_d_'||_tx_id||'_'||_aff_id);
      INSERT INTO public.affiliate_sales(affiliate_link_id,affiliate_user_id,seller_user_id,product_id,transaction_id,sale_amount,commission_pct,commission_amount,status)
      VALUES (_aff_id,_aff_user,_tx.user_id,_tx.product_id,_tx.id,_tx.amount,_aff_pct,_comm,'approved')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$function$;

-- ============================================================
-- 3) AFILIADOS: o link só nasce para produto com programa ligado e o afiliado não reativa o que o produtor pausou
-- ============================================================
alter table public.affiliate_links add column if not exists paused_by_owner boolean not null default false;

create or replace function public.pin_affiliate_commission_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
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
  return new;
end $$;

create or replace function public.protect_affiliate_links_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
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
    -- o produtor pausando marca o link; reativando, desmarca
    if new.is_active is distinct from old.is_active then new.paused_by_owner := not new.is_active; end if;
  end if;
  return new;
end $$;
