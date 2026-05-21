
# Plano de Correção — 50 Findings

Vou aplicar as correções em **3 ondas**, priorizando o que mais impacta segurança e estabilidade. Tudo será feito sem quebrar funcionalidades existentes.

## Onda 1 — Banco de Dados (Migração SQL)

**Objetivo:** fechar buracos de segurança RLS e otimizar performance.

- Revogar `EXECUTE` de funções `SECURITY DEFINER` sensíveis para `anon` e `authenticated` (linter findings 1–9): `get_course_analytics`, `get_ledger_balance`, `check_velocity`, `check_blacklist`, `check_signup_conflicts`, `get_affiliate_product_owner`, `get_checkout_status`, `is_product_active`, `current_user_has_role`. Manter `has_role` acessível.
- Criar índices ausentes em colunas de FK e filtro frequente:
  - `activity_logs(user_id, created_at desc)`
  - `notifications(user_id, created_at desc)`
  - `transactions(user_id, status, created_at desc)`
  - `affiliate_sales(affiliate_user_id)`, `affiliate_links(product_id)`
  - `withdrawals(user_id, status)`, `financial_ledger(user_id, created_at desc)`
- Constraints de integridade financeira:
  - `CHECK (amount >= 0)` em `transactions`, `withdrawals`, `affiliate_sales`, `balance_adjustments`.
- `ON DELETE CASCADE` em `order_bumps_bump_product_id_fkey` (hoje deleta o pai e quebra o bump).
- Soft delete em `products` (`deleted_at timestamptz`) + ajuste das RLS para filtrar `deleted_at IS NULL`.
- Sanitização de PII em `activity_logs`: trigger remove chaves `password`, `token`, `secret`, `cpf` antes de gravar.
- Trigger `update_updated_at_column` em `acquirers` e demais tabelas que faltam.
- Limpar policies `deny_anon_*` redundantes (são `RESTRICTIVE` com `false` sem `PERMISSIVE` correspondente para anon) — manter apenas onde há ambiguidade real.

## Onda 2 — Edge Functions

**Objetivo:** validar input, evitar reprocessamento e endurecer respostas.

- Adicionar **Zod validation** em `admin-login`, `manager-login`, `admin-2fa-verify`, `podpay-postback`, `podpay-create-transaction`, `podpay-cashout`, `podpay-refund`, `generate-api-key`, `export-report`, `admin-impersonate`.
- Idempotência em `podpay-postback`: checar `processed_at` antes de processar splits.
- Tipar `supabase: any` → `SupabaseClient` em `podpay-postback` (processCoProductionSplit / processAffiliateSplit).
- CORS restrito: trocar `*` por allowlist dos domínios `hotzfy.com.br`, `www.hotzfy.com.br`, lovable preview.
- Headers de segurança: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` em todas as respostas.
- Retornar 500 com detalhe em `subscription-renewal` quando há falhas; sanitizar URLs nos `catch`.
- `manager-login`: aplicar mesmo split `authClient`/`adminClient` já feito em `admin-login`.
- Rate-limit IP em `admin-login` e `manager-login` via tabela `admin_login_attempts` (já existe) — bloquear após N tentativas/min.
- Retry com backoff exponencial nas chamadas PodPay (`cashout`, `create-transaction`, `refund`).
- `export-report`: paginar resultados em chunks de 1000 antes de montar CSV.

## Onda 3 — Frontend

**Objetivo:** reduzir `as any`, melhorar UX e acessibilidade sem mudar layout.

- Centralizar `formatCurrency(value, locale='pt-BR', currency='BRL')` em `src/lib/utils.ts` e substituir hardcodes.
- `pixelTracking.ts`: guardar flag `__pixel_loaded_<id>` para não reinjetar scripts em re-render.
- Adicionar `aria-label` em botões icon-only restantes (modais, fechar painéis).
- Memoizar listas filtradas (`Vendas.tsx`, `Marketplace.tsx`, `Webhooks.tsx`) com `useMemo`; `React.memo` em linhas pesadas.
- Expor `error` no `useQueryData` e disparar Toast quando falhar.
- Reduzir `as any`: gerar tipo manual para `co_productions` e `webhook_configs_safe` em `src/integrations/supabase/types.ts` está bloqueado (auto-gerado) → criar `src/types/db-extra.ts` com tipos auxiliares e remover ~50 `as any` em arquivos top: `Vendas.tsx`, `Coproducoes.tsx`, `AdminSellersTab.tsx`, `AdminManagersTab.tsx`, `useQueryData.tsx`.
- Loading states em botões de ação (Vendas, Saques, Afiliados): desabilitar enquanto `isLoading`.
- Deletar `src/pages/Dashboard.tsx.bak` e assets `ignore-*` não referenciados.
- `public/robots.txt`: adicionar `Disallow: /admin`, `Disallow: /manager`, `Disallow: /financeiro`.
- `public/manifest.json`: completar `theme_color`, `background_color`, ícones 192/512.

## Detalhes técnicos

- Migração será **uma única transação** com `IF NOT EXISTS` para índices e `DROP POLICY IF EXISTS` antes de recriar.
- Tipos auxiliares ficam em `src/types/db-extra.ts` (não toca `types.ts` auto-gerado).
- CORS allowlist via `const ALLOWED_ORIGINS = [...]` e função `buildCors(origin)` reutilizável (helper inline em cada função, não há shared/).
- Zod: usar `npm:zod@3` direto via Deno specifier.

## Fora do escopo

- Refatorar `Vendas.tsx` (1000+ linhas) — só limpeza de tipos.
- Substituir imagens `ignore-*` por WebP (apenas remover não-referenciadas).
- Sitemap dinâmico (requer nova edge function, posso fazer depois se quiser).
- Mover roles `text` → enum `app_role` (alto risco em prod com triggers existentes).

Confirma que posso seguir com as 3 ondas?
