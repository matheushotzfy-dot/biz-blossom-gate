# Melhorias de UI/UX solicitadas

## 1. Dashboard — filtro de dias
- Remover o seletor/pill de período que fica à esquerda no hero.
- Manter apenas o **ícone de calendário** (à direita). Ao clicar, abre um popover com os presets (Hoje, 7d, 30d, 90d, Mês, Ano, Personalizado) — mesmo comportamento atual, só que unificado num único ponto de entrada.

## 2. Dashboard — card "Faturamento Total"
- Remover o badge "% vs ontem" do card de Faturamento Total.
- Garantir formatação BR correta (`R$ 1.234.567,89`) com `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` — inclusive quando o período for "todos" (mês/ano).
- O valor exibido deve refletir o range selecionado (soma real do período, não só do dia).

## 3. Links de Pagamento (`/vendas/links`)
- Refazer o layout no padrão premium (mesma linguagem do Dashboard: hero + PremiumMetric + Panels sólidos).
- **Novo formulário de criação** com:
  - Título, **Descrição longa** (textarea), Valor, Slug
  - **Upload de imagem/capa** (bucket `payment-link-covers` no storage, RLS por owner)
  - Métodos (PIX / Cartão / Boleto)
- Persistir `description` (já existe) e novo campo `cover_url` na tabela `payment_links`.
- **Corrigir "produto não encontrado"** no checkout público: a página `PublicPaymentLink.tsx` deve usar RPC pública já criada (`get_public_payment_link`) — verificar retorno e mapear os novos campos (cover, description) na tela do checkout.
- Renderizar cover + descrição na página pública do link.

## 4. Saques automatizados — presets
- Em `AutoWithdrawalSettings.tsx`, adicionar preset de **R$ 10.000** e recentralizar os chips (flex justify-center, wrap balanceado).

## 5. Suporte (`/suporte`)
- Polir o layout geral: espaçamentos, hierarquia dos botões (Novo ticket, filtros, ações), agrupar meta (status/prioridade/canal) em chips consistentes, alinhar composer de mensagens, revisar responsivo.
- Não mexer em lógica de dados/realtime — apenas apresentação.

## 6. Webhooks (`/integracoes?tab=webhooks`)
- Refazer no estilo do Dashboard: hero premium com título + subtítulo + ação "Novo webhook", grid de `PremiumMetric` (total, ativos, entregas 24h, taxa de sucesso), lista em Panels sólidos com status/eventos/último disparo, drawer/dialog padronizado para criar/editar.

## 7. API Keys (`/integracoes?tab=keys`)
- Mesmo tratamento premium: hero + métricas (chaves ativas, requests 24h, última utilização) + lista polida com badge de ambiente (live/test), botão copiar, revogar, e modal de criação padronizado.

---

## Detalhes técnicos

**Migração**
- `ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS cover_url text;`
- Novo bucket público `payment-link-covers` + policies:
  - SELECT público
  - INSERT/UPDATE/DELETE apenas ao owner (`auth.uid()::text = (storage.foldername(name))[1]`)
- Atualizar RPC `get_public_payment_link` para retornar `cover_url` e `description`.

**Arquivos a alterar**
- `src/pages/Dashboard.tsx` — remover pill esquerdo, remover % vs ontem, unificar filtro no ícone de calendário, formatar total.
- `src/pages/vendas/LinkPagamento.tsx` — refazer layout + upload de capa + textarea descrição.
- `src/pages/PublicPaymentLink.tsx` — renderizar cover/description e corrigir fetch.
- `src/components/financeiro/AutoWithdrawalSettings.tsx` — presets.
- `src/pages/Suporte.tsx` — polish de layout.
- `src/pages/vendas/Webhooks.tsx` — refazer no padrão premium.
- `src/pages/vendas/ApiKeys.tsx` — refazer no padrão premium.

**Escopo**
- Apenas apresentação + os campos novos de payment_links (cover_url). Nenhuma mudança em lógica de pagamento, webhooks dispatch, RLS existente fora do que está listado.
