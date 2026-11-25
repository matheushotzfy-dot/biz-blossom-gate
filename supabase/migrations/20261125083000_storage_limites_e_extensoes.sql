-- Dois buckets escritos por usuários comuns ficaram de fora da regra que barra arquivos executáveis pelo
-- navegador (.html, .svg, .js, .xml…) e sem limite de tamanho/tipo no próprio bucket:
--   · payment-link-covers: só imagem (jpeg/png/webp) até 4 MB — o mesmo que a tela já exige;
--   · ticket-attachments: até 5 MB por arquivo — o mesmo limite da tela de suporte.
-- A validação da tela é só conveniência; o que vale é o que o servidor recusa.

DO $$
DECLARE
  _cond text := $cond$((bucket_id <> ALL (ARRAY['checkout-banners'::text, 'kyc-documents'::text, 'dispute-evidence'::text, 'course-content'::text, 'withdrawal-proofs'::text, 'payment-link-covers'::text, 'ticket-attachments'::text])) OR ((lower(name) !~~ '%.svg'::text) AND (lower(name) !~~ '%.svgz'::text) AND (lower(name) !~~ '%.html'::text) AND (lower(name) !~~ '%.htm'::text) AND (lower(name) !~~ '%.xhtml'::text) AND (lower(name) !~~ '%.js'::text) AND (lower(name) !~~ '%.mjs'::text) AND (lower(name) !~~ '%.xml'::text) AND (lower(name) !~~ '%.swf'::text) AND (lower(name) !~~ '%.xsl'::text)))$cond$;
BEGIN
  EXECUTE 'ALTER POLICY block_dangerous_uploads_all_user_buckets ON storage.objects USING ' || _cond || ' WITH CHECK ' || _cond;
END $$;

UPDATE storage.buckets
   SET file_size_limit = 4194304,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'payment-link-covers';

UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'ticket-attachments';
