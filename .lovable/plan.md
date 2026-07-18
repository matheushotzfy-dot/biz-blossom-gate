
# Plano — 5 tarefas em uma única entrega

Vou executar tudo em sequência, com cuidado em cada detalhe. Abaixo o que será feito em cada uma.

---

## Tarefa 1 — Filtro de período no Dashboard

**O quê:** Transformar o chip de "Faturamento hoje" no Dashboard em um botão clicável que abre um menu com filtros de período. Ao mudar, todos os KPIs, gráficos e rankings do Dashboard recalculam.

- Opções: **Hoje**, **Ontem**, **7 dias**, **30 dias**, **Este mês**, **Mês passado**, **Personalizado** (com date range picker).
- UI: `Popover` do shadcn com o mesmo estilo dos botões premium do Dashboard (bordas suaves, glow discreto, ícone de calendário).
- Persistência do filtro selecionado em `localStorage` para lembrar entre sessões.
- Refetch das queries (`useTransactions`, KPIs, top produtos, campeões) usando o range escolhido.

## Tarefa 2 — Vendas + Saques + Dados bancários

**Vendas:**
- Pré-seleção fixa em **"Hoje"** ao entrar na aba (sem herdar filtro antigo).

**Saques (Pix copia e cola / confirmação):**
- Corrigir o modal para usar layout com `max-h-[90vh]` + `overflow-y-auto` interno para que o botão **Confirmar** fique sempre acessível em telas pequenas.
- Remover a mensagem avulsa "Pix copia e cola" (redundante).
- Melhorar o quadrado do código: fundo escuro suave, borda 1px, fonte mono, botão de copiar integrado, feedback de "Copiado ✓".
- Redirecionamento pós-confirmação mais fluido (loading → sucesso → volta à listagem).

**Dados bancários (mobile/tablet):**
- Substituir o `Select` nativo que dispara teclado por um **Combobox controlado** (input readonly + lista custom), evitando abrir teclado automático.
- Adicionar `inputMode="none"` e `readOnly` no trigger para não dar zoom no iOS.
- Meta viewport reforçado (`maximum-scale=1`) no formulário para evitar zoom.
- Corrigir scroll da lista de bancos: `max-h-[60vh]` + `overflow-y-auto` + `overscroll-contain` na lista, com `touch-action: pan-y`.

## Tarefa 3 — Produtos no estilo do Dashboard

- Aplicar o mesmo padrão visual do Dashboard: `FinanceiroHero`, KPIs premium (Total de produtos, Ativos, Faturamento por produto, Ticket médio), seções com título/subtítulo padronizados.
- Manter a grid/lista de produtos atual, mas reenquadrada em `PageShell` + `Panel` como no Dashboard.
- Remover elementos "dinâmicos" desnecessários e deixar mais estático/limpo.
- Preservar toda funcionalidade existente (criar, editar, arquivar, checkout).

## Tarefa 4 — Links de Pagamento (cobrança avulsa, tipo Mercado Pago)

**Backend (nova tabela):**
- Tabela `payment_links`: `id`, `user_id`, `slug` (único), `title`, `description`, `amount`, `payment_methods` (pix/cartão/boleto), `image_url` (opcional), `is_active`, `expires_at`, `max_uses`, `current_uses`, `total_revenue`, `clicks`, `created_at`.
- GRANTs + RLS (owner CRUD, anon SELECT quando `is_active=true` via slug).
- Tabela `payment_link_transactions` ou reaproveitar `transactions` com coluna `payment_link_id`.

**Painel (/vendas/link-pagamento):**
- Refazer no estilo Dashboard: hero, KPIs (Receita, Cliques, Conversões, Links ativos), lista real vinda do banco (não mais MOCK).
- Modal "Novo link" com: título, descrição, valor, métodos aceitos, slug custom, limite de usos, expiração.
- Ações: copiar link, abrir preview, editar, pausar, excluir.

**Checkout público (/link/:slug):**
- Nova rota pública, layout enxuto (só o essencial: título, valor, formulário de pagamento — nome, email, CPF).
- Integra com o mesmo fluxo de criação PIX/cartão que o checkout de produto (edge function `quick-pix` ou similar).
- Página de obrigado reutilizando `/obrigado?tx=...`.

## Tarefa 5 — Corrida de Faturamento + Metas + Suporte

**Corrida (visual):**
- Redesign completo: pódio cinematográfico mais elegante, cards de prêmio maiores, animações suaves.
- Remover a lógica de "meta por valor" — a corrida agora é **puramente ranking**: Top 1/2/3 (e demais) ganham os prêmios cadastrados.
- Deixar claro na UI que é uma competição entre sellers pelo topo, sem barra de meta.

**Metas de faturamento (novo — admin):**
- Nova tabela `revenue_goals`: `id`, `title`, `description`, `target_amount`, `period_type` (week/month/custom), `start_date`, `end_date`, `reward_title`, `reward_image_url`, `is_active`, `created_at`.
- Tabela `revenue_goal_achievements`: registra qual seller bateu qual meta e quando.
- Nova aba no admin **"Metas de Faturamento"**: CRUD completo (criar meta com valor alvo, período, prêmio), listar quem já bateu, marcar como pago.
- Seller vê suas metas em andamento numa seção nova em Premiações ou no Dashboard (com barra de progresso real).

**Suporte (correção):**
- Investigar o fluxo de `support_tickets` + `ticket_messages`.
- Corrigir envio de mensagem (provavelmente RLS/GRANT ou realtime não configurado).
- Garantir que ao enviar mensagem: (a) persiste no banco, (b) aparece na conversa imediatamente, (c) admin recebe notificação, (d) admin consegue responder e seller vê.
- Adicionar realtime subscription na conversa.

---

## Detalhes técnicos

**Frontend:**
- `src/pages/Dashboard.tsx` — Popover com `DateRangePicker` (shadcn `Calendar` mode="range" + presets).
- `src/pages/vendas/Vendas.tsx` — inicializar filtro com "hoje".
- `src/pages/financeiro/Saques.tsx` — refactor do modal PIX + confirmação.
- `src/pages/financeiro/DadosBancarios.tsx` — Combobox custom no lugar de Select nativo.
- `src/pages/vendas/Produtos.tsx` — envelopar em `PageShell` + `FinanceiroHero` + KPIs.
- `src/pages/vendas/LinkPagamento.tsx` — reescrever do zero, integrado ao Supabase.
- `src/pages/PublicPaymentLink.tsx` (novo) — checkout público do link.
- `src/pages/CorridaFaturamento.tsx` — remover meta, redesign do pódio.
- `src/pages/admin/tabs/AdminGoalsTab.tsx` (novo) — CRUD de metas.
- `src/pages/Suporte.tsx` + admin support — corrigir envio + realtime.

**Backend (migrations):**
- `payment_links` + GRANTs + RLS.
- `revenue_goals` + `revenue_goal_achievements` + GRANTs + RLS + trigger que audita quando um seller atinge a meta no período.
- Correção de policies/grants de `support_tickets`/`ticket_messages` se necessário.

**Edge functions:**
- `create-payment-link-charge` (nova) — recebe slug + dados do pagador, cria transação PIX/cartão via acquirer.

**Sem alterações destrutivas:** nenhuma tabela existente é removida; apenas adição de colunas/tabelas novas e reescrita de páginas de UI.
