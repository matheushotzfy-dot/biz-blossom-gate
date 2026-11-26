-- Cadastro: os dados do negócio que o seller informa ao criar a conta passam a ser guardados.
-- Antes: o formulário pedia razão social, segmento, faturamento e "onde conheceu", mandava tudo para o
-- cadastro, e o gatilho handle_new_user só copiava nome, apelido, documento, tipo e telefone. O resto ficava
-- perdido dentro de auth.users.raw_user_meta_data (razão social do CNPJ incluída).
--
-- Os dados vão para uma tabela própria e fechada: o dono e o admin leem, ninguém escreve pelo navegador
-- (só o gatilho de criação de conta, que roda como dono da função). Assim a razão social não pode ser
-- trocada depois por um update no próprio perfil, e a tabela profiles não ganha coluna nova.

CREATE TABLE IF NOT EXISTS public.seller_signup_info (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  business_segment text,
  monthly_revenue_band text,
  referral_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_signup_info_company_len CHECK (company_name IS NULL OR char_length(company_name) BETWEEN 2 AND 160),
  CONSTRAINT seller_signup_info_segment_ok CHECK (business_segment IS NULL OR business_segment IN
    ('infoproduto','mentoria','comunidade','ebook','software','servico','fisico','outro')),
  CONSTRAINT seller_signup_info_revenue_ok CHECK (monthly_revenue_band IS NULL OR monthly_revenue_band IN
    ('ate_10k','10k_50k','50k_200k','acima_200k')),
  CONSTRAINT seller_signup_info_referral_ok CHECK (referral_source IS NULL OR referral_source IN
    ('instagram','indicacao','youtube','pesquisa','tiktok','outro'))
);

ALTER TABLE public.seller_signup_info ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.seller_signup_info FROM anon, authenticated;
GRANT SELECT ON public.seller_signup_info TO authenticated;

DROP POLICY IF EXISTS "Owner reads own signup info" ON public.seller_signup_info;
CREATE POLICY "Owner reads own signup info" ON public.seller_signup_info FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read signup info" ON public.seller_signup_info;
CREATE POLICY "Admins read signup info" ON public.seller_signup_info FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.seller_signup_info IS
  'Dados do negócio informados no cadastro (razão social, segmento, faturamento, origem). Escrita só pelo gatilho handle_new_user.';

-- Escolha do formulário: devolve o valor se estiver na lista, senão NULL (um valor inesperado nunca derruba o cadastro).
CREATE OR REPLACE FUNCTION app_private.signup_choice(_value text, _allowed text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN lower(btrim(_value)) = ANY (_allowed) THEN lower(btrim(_value)) ELSE NULL END;
$function$;

-- Nome da empresa: sem espaços sobrando e sem caracteres de controle; vazio vira NULL.
CREATE OR REPLACE FUNCTION app_private.signup_company_name(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN char_length(btrim(regexp_replace(COALESCE(_value, ''), '[[:cntrl:]]+', ' ', 'g'))) < 2 THEN NULL
    ELSE left(btrim(regexp_replace(regexp_replace(_value, '[[:cntrl:]]+', ' ', 'g'), '\s{2,}', ' ', 'g')), 160)
  END;
$function$;

REVOKE ALL ON FUNCTION app_private.signup_choice(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.signup_company_name(text) FROM PUBLIC, anon, authenticated;

-- O gatilho de criação de conta passa a guardar também os dados do negócio.
-- Mesmo corpo de antes para profiles e user_roles; a razão social só vale para conta de CNPJ.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _doc_type text := COALESCE(NEW.raw_user_meta_data->>'document_type', 'cpf');
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, nickname, document_number, document_type, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'document_number', NULL),
    _doc_type,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  INSERT INTO public.seller_signup_info (user_id, company_name, business_segment, monthly_revenue_band, referral_source)
  VALUES (
    NEW.id,
    CASE WHEN _doc_type = 'cnpj' THEN app_private.signup_company_name(NEW.raw_user_meta_data->>'company_name') END,
    app_private.signup_choice(NEW.raw_user_meta_data->>'segment',
      ARRAY['infoproduto','mentoria','comunidade','ebook','software','servico','fisico','outro']),
    app_private.signup_choice(NEW.raw_user_meta_data->>'monthly_revenue_band',
      ARRAY['ate_10k','10k_50k','50k_200k','acima_200k']),
    app_private.signup_choice(NEW.raw_user_meta_data->>'referral_source',
      ARRAY['instagram','indicacao','youtube','pesquisa','tiktok','outro'])
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Contas que já existem: recupera o que ficou em raw_user_meta_data (9 contas na época; pouca coisa, mas é do cliente).
INSERT INTO public.seller_signup_info (user_id, company_name, business_segment, monthly_revenue_band, referral_source)
SELECT
  u.id,
  CASE WHEN COALESCE(u.raw_user_meta_data->>'document_type', 'cpf') = 'cnpj'
       THEN app_private.signup_company_name(u.raw_user_meta_data->>'company_name') END,
  app_private.signup_choice(u.raw_user_meta_data->>'segment',
    ARRAY['infoproduto','mentoria','comunidade','ebook','software','servico','fisico','outro']),
  app_private.signup_choice(u.raw_user_meta_data->>'monthly_revenue_band',
    ARRAY['ate_10k','10k_50k','50k_200k','acima_200k']),
  app_private.signup_choice(u.raw_user_meta_data->>'referral_source',
    ARRAY['instagram','indicacao','youtube','pesquisa','tiktok','outro'])
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
ON CONFLICT (user_id) DO NOTHING;
