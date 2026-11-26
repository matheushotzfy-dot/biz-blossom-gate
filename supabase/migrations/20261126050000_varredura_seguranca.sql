-- Varredura de segurança (2026-11-26). Cada bloco corrige um achado conferido no banco de produção.

-- ───────── 1. Notas internas do admin sobre o seller ─────────
-- `profiles.admin_notes` era lida pelo PRÓPRIO seller ("Users can view own profile" devolve a linha inteira, e o realtime
-- de `profiles` também manda a linha inteira) e pela equipe com `sellers.view`. As notas passam para uma tabela só do admin;
-- a coluna antiga fica (para não quebrar tipos e telas antigas) e passa a ser sempre vazia.
CREATE TABLE IF NOT EXISTS public.seller_admin_notes (
  user_id uuid PRIMARY KEY,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.seller_admin_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_admin_notes FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.seller_admin_notes TO authenticated;
DROP POLICY IF EXISTS "Admins manage seller admin notes" ON public.seller_admin_notes;
CREATE POLICY "Admins manage seller admin notes" ON public.seller_admin_notes
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION app_private.stamp_seller_admin_notes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Texto puro (a tela mostra como texto): só tira caracteres de controle e limita o tamanho.
  NEW.notes := left(btrim(regexp_replace(coalesce(NEW.notes, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), 5000);
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.stamp_seller_admin_notes() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_stamp_seller_admin_notes ON public.seller_admin_notes;
CREATE TRIGGER trg_stamp_seller_admin_notes BEFORE INSERT OR UPDATE ON public.seller_admin_notes
  FOR EACH ROW EXECUTE FUNCTION app_private.stamp_seller_admin_notes();

INSERT INTO public.seller_admin_notes(user_id, notes)
SELECT user_id, admin_notes FROM public.profiles WHERE nullif(btrim(admin_notes), '') IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
UPDATE public.profiles SET admin_notes = NULL WHERE admin_notes IS NOT NULL;

CREATE OR REPLACE FUNCTION app_private.clear_profile_admin_notes()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.admin_notes := NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.clear_profile_admin_notes() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_zz_clear_profile_admin_notes ON public.profiles;
CREATE TRIGGER trg_zz_clear_profile_admin_notes BEFORE INSERT OR UPDATE OF admin_notes ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.clear_profile_admin_notes();

-- A lista de inativos do admin lia `p.admin_notes`: passa a ler a tabela nova (troca só esse trecho da função).
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('app_private.get_admin_inactive_sellers_page(integer,integer,text,text)'::regprocedure) INTO d;
  IF position('public.seller_admin_notes n' in d) > 0 THEN
    RETURN; -- já trocado (migração rodando de novo)
  END IF;
  IF position('p.admin_notes,' in d) = 0 THEN
    RAISE EXCEPTION 'get_admin_inactive_sellers_page mudou: revise a troca de admin_notes';
  END IF;
  EXECUTE replace(d, 'p.admin_notes,', '(SELECT n.notes FROM public.seller_admin_notes n WHERE n.user_id = p.user_id) AS admin_notes,');
END $$;

-- ───────── 2. A equipe lia a linha inteira do perfil dos sellers da carteira ─────────
-- (IP, endereço, chave Pix mascarada, motivo do KYC…). O painel da equipe usa só `get_staff_seller_detail`, que
-- já escolhe o que cada permissão mostra; a leitura direta sai.
DROP POLICY IF EXISTS "Assigned staff view active seller profiles" ON public.profiles;

-- ───────── 3. Gerente lia o que não é dele ─────────
DROP POLICY IF EXISTS "Users read own permissions" ON public.staff_permissions; -- deixava qualquer gerente ler as permissões de toda a equipe
DROP POLICY IF EXISTS "Admins can view podpay webhook events" ON public.podpay_webhook_events;
CREATE POLICY "Admins can view podpay webhook events" ON public.podpay_webhook_events
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'::app_role));

-- Política morta: a chave 'refunds.request' não existe no mapa de has_staff_permission (nunca liberou nada).
DROP POLICY IF EXISTS "Assigned staff view scoped refunds" ON public.refund_requests;

-- ───────── 4. Comissão do gerente dependia de quem disparou a venda ─────────
-- `has_role` responde false quando quem está logado não é o próprio usuário nem admin; dentro de um gatilho disparado
-- por outra conta, o gerente "sumia" e a comissão não era lançada. Lê `user_roles` direto (função interna, sem EXECUTE público).
CREATE OR REPLACE FUNCTION public.resolve_commission_staff(_seller uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.manager_user_id
  FROM public.manager_seller_assignments a
  WHERE a.seller_user_id = _seller
    AND a.ended_at IS NULL
    AND a.started_at <= now()
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = a.manager_user_id AND r.role = 'manager'::app_role)
  ORDER BY a.started_at DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_commission_staff(uuid) FROM PUBLIC, anon, authenticated;

-- ───────── 5. Funções de admin/seller executáveis por visitante ─────────
-- Todas já conferem o papel por dentro; tirar o EXECUTE de anon é a segunda barreira (o wrapper público é INVOKER).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'app_private.admin_decide_balance_adjustment(uuid, boolean)',
    'app_private.admin_open_dispute(uuid, text, text, integer)',
    'app_private.admin_refund_transaction(uuid, numeric, text)',
    'app_private.admin_request_balance_adjustment(uuid, text, numeric, text)',
    'app_private.admin_resolve_dispute(uuid, text, numeric, text)',
    'app_private.admin_set_dispute_review(uuid, text)',
    'app_private.get_financial_action_history(uuid, timestamp with time zone, timestamp with time zone, text, integer, integer)',
    'app_private.get_seller_360(uuid)',
    'app_private.get_seller_balance_breakdown(uuid)',
    'app_private.seller_respond_dispute(uuid, text, text[])',
    'app_private.assert_recent_auth()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
    END IF;
  END LOOP;
END $$;

-- Funções de gatilho no schema público não precisam de EXECUTE de ninguém (só rodam como gatilho).
REVOKE EXECUTE ON FUNCTION public.guard_co_productions_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_support_ticket_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_ticket_message_insert() FROM PUBLIC, anon, authenticated;

-- ───────── 6. Buckets sem limite ─────────
UPDATE storage.buckets
SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'withdrawal-proofs';
UPDATE storage.buckets
SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'dispute-evidence';

-- ───────── 7. Pixels do vendedor nunca carregavam no checkout ─────────
-- `product_pixels_public` era `security_invoker`: o visitante lê com os próprios direitos, e `product_pixels` nega
-- tudo a `anon` (e o comprador logado só vê os pixels dele). Resultado: o checkout recebia lista vazia e nenhum
-- evento (PageView, InitiateCheckout, Purchase…) era disparado. A view passa a ler como dono, com as MESMAS colunas
-- (nenhum token: `api_token_*` fica de fora) e só pixels ligados de produto no ar.
CREATE OR REPLACE VIEW public.product_pixels_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, product_id, platform, pixel_id, is_active, events, fire_on_boleto, fire_on_pix_qr,
       boleto_conversion_value, pix_conversion_value, disable_bump_events, domain
FROM public.product_pixels
WHERE is_active = true AND app_private.is_product_active(product_id);
ALTER VIEW public.product_pixels_public SET (security_invoker = false, security_barrier = true);
REVOKE ALL ON public.product_pixels_public FROM anon, authenticated;
GRANT SELECT ON public.product_pixels_public TO anon, authenticated;
