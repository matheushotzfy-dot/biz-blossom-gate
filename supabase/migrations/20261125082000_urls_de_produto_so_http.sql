-- Endereços gravados por vendedores (checkout, capas, banners, redirecionamentos) eram aceitos de qualquer
-- jeito: `javascript:…`, `data:…`, `blob:…`. O painel admin abria `checkout_url` com window.open, então um
-- produto com `javascript:` rodaria código na sessão de quem revisa. Daqui em diante, essas colunas só
-- guardam http(s) absoluto, sem espaço nem aspas, com até 2048 caracteres (ou vazio/NULL).

-- 1) Duas linhas antigas que o novo formato rejeitaria.
--    · produto de demonstração com o slug solto no lugar do endereço do checkout;
--    · banner `blob:` — só existia no navegador de quem escolheu o arquivo, nunca carregou para ninguém.
UPDATE public.products
   SET checkout_url = 'https://hotzfy.com.br/pay/' || checkout_url
 WHERE checkout_url ~ '^[a-z0-9][a-z0-9_-]*$';

UPDATE public.products SET checkout_banner_desktop_url = NULL WHERE checkout_banner_desktop_url ~* '^blob:';
UPDATE public.products SET checkout_banner_mobile_url  = NULL WHERE checkout_banner_mobile_url  ~* '^blob:';

-- 2) Uma regra, aplicada igual em todas as colunas de endereço escritas por usuários.
DO $$
DECLARE
  _col record;
  _name text;
BEGIN
  FOR _col IN
    SELECT * FROM (VALUES
      ('products',              'checkout_url'),
      ('products',              'upsell_url'),
      ('products',              'downsell_url'),
      ('products',              'page_url'),
      ('products',              'image_url'),
      ('products',              'checkout_banner_desktop_url'),
      ('products',              'checkout_banner_mobile_url'),
      ('payment_links',         'redirect_url'),
      ('payment_links',         'cover_url'),
      ('payment_links',         'image_url'),
      ('courses',               'thumbnail_url'),
      ('modules',               'banner_url'),
      ('lesson_attachments',    'file_url'),
      ('award_tiers',           'image_url'),
      ('reward_claims',         'tracking_url'),
      ('revenue_goals',         'reward_image_url'),
      ('revenue_race_overrides','avatar_url'),
      ('revenue_race_prizes',   'image_url'),
      ('revenue_races',         'banner_url'),
      ('revenue_races',         'logo_url'),
      ('profiles',              'avatar_url')
    ) AS t(tbl, col)
  LOOP
    _name := _col.tbl || '_' || _col.col || '_http_chk';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE n.nspname = 'public' AND r.relname = _col.tbl AND c.conname = _name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I IS NULL OR %I = '''' OR (length(%I) <= 2048 AND %I ~* %L))',
        _col.tbl, _name, _col.col, _col.col, _col.col, _col.col, '^https?://[^[:space:]<>"''\\]+$'
      );
    END IF;
  END LOOP;
END $$;
