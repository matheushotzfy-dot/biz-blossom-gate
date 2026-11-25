-- O Supabase concede por padrão SELECT/REFERENCES/TRIGGER ao papel `anon` em toda tabela criada em `public`.
-- A RLS já devolvia zero linhas, mas deixar o privilégio em tabelas que não têm NENHUMA política para
-- visitantes (chaves de API, entregas de webhook, razão de comissões, tokens de verificação…) depende de
-- uma única camada. Aqui tiramos o privilégio onde ele nunca teve uso: visitante sem política = sem acesso.
-- As páginas públicas (checkout, link de pagamento, obrigado, certificado) usam views `*_public` e funções
-- SECURITY DEFINER em `app_private`, que não dependem do privilégio de `anon` nessas tabelas.

DO $$
DECLARE
  _t record;
BEGIN
  FOR _t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND (has_table_privilege('anon', c.oid, 'SELECT')
         OR has_table_privilege('anon', c.oid, 'REFERENCES')
         OR has_table_privilege('anon', c.oid, 'TRIGGER'))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
       WHERE p.schemaname = 'public' AND p.tablename = _t.relname
         AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles))
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', _t.relname);
    END IF;
  END LOOP;
END $$;
