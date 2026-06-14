## Plano — Admin: Top Sellers, Inativos, Staff & Gerentes, Comissões

Base da comissão: **net_amount** (líquido). Pagamento: **manual** — você lança/aprova; sistema só calcula, acumula e exibe.

---

### 1. Top Sellers (reformular `AdminTopSellersTab`)

Foco em faturamento detalhado, sem decoração inútil.

- **Filtros sticky**: período (Hoje / 7d / 30d / Mês / Custom) + busca por nome/email.
- **KPIs do topo** (4 cards densos, tabular): TPV bruto, Líquido (net), Taxas geradas, Ticket médio.
- **Tabela ranking** — colunas: Posição, Seller (avatar+nome+email), Vendas (qtd), TPV bruto, Líquido, Taxas, Ticket médio, Aprovação %, Chargeback %, MED %, Última venda. Ordenável por qualquer coluna. 50/página.
- **Linha expandível** ao clicar: 
  - Breakdown por método (PIX / Cartão / Boleto) com valor e %.
  - Top 5 produtos do seller no período.
  - Heatmap simples de horário (24h × 7d) com volume de vendas.
  - Atalhos: "Ver perfil completo" (abre o `SellerDetailDialog` já existente), "Login as user", "Ajustar taxas".
- Export CSV do ranking.

### 2. Inativos (refazer `AdminInactiveSellersTab`)

Mesma densidade billion-dollar SaaS dos outros painéis.

- Critério: sem venda há ≥ 30 dias (configurável: 30/60/90).
- Cards de resumo: total inativos, faturamento histórico acumulado, taxas históricas pagas, ticket histórico médio.
- **Tabela**: Seller, Contato (email + WhatsApp clicáveis, ícones), Documento, Última venda (há X dias), Vendas totais (qtd), Faturamento histórico (bruto/líquido), Taxas pagas, Saldo atual, Status KYC, Observação curta.
- Ações por linha: WhatsApp direto (`wa.me`), copiar email, abrir detalhes, adicionar nota rápida, marcar "Recuperado" (move para ativos), Login as user.
- Painel lateral de detalhes ao clicar — mesma estética do painel de transações: dados pessoais, histórico financeiro consolidado, últimas 10 transações, observações editáveis (`seller_notes`), tentativas de reativação (registradas em `activity_logs`).

### 3. Staff & Gerentes — criação e permissões

Hoje `AdminEmployeesTab` e `AdminManagersTab` só promovem contas existentes. Mudar para criação direta pelo admin.

**Migração** (esquema):
- Nova tabela `staff_permissions` (user_id, key, granted_by) — granular: `view_sellers`, `edit_fees`, `approve_kyc`, `view_financial`, `process_refund_request` (apenas solicitar), `view_disputes`, `manage_meds`, etc. RLS: só admin escreve; staff/manager lê o próprio.
- Coluna `profiles.frozen` (boolean) → quando true, edge function de login nega acesso.
- Coluna `profiles.created_by_admin` (uuid) e `profiles.staff_role_type` (`employee` | `manager`).
- Coluna em `profiles`: `approved_by` (uuid) — preenchida automaticamente quando staff/manager aprova KYC do seller. Imutável (trigger).
- Tabela `staff_audit_log` (staff_user_id, action, entity_type, entity_id, before, after, created_at) — append-only, RLS admin-only read, trigger imutável (sem UPDATE/DELETE).

**Edge functions novas**:
- `admin-create-staff` (verify_jwt=false + admin check): recebe `{ email, password, full_name, role: 'employee'|'manager', permissions[], commission_pct }`, usa service role para `auth.admin.createUser({ email_confirm: true })`, popula `profiles`, insere `user_roles`, insere `staff_permissions`, insere `staff_commission_config`. Retorna user_id.
- `admin-freeze-staff`: alterna `profiles.frozen`, registra em `staff_audit_log`.
- `admin-reset-staff-password`: troca senha via service role.
- Atualizar `manager-login` para checar `frozen=true` e barrar.

**UI** — duas abas separadas (Gerente / Staff), cada uma:
- Botão "Criar conta" → modal com email, senha (com gerador), nome, função, switches de permissões, % comissão inicial, sellers atribuídos (gerente).
- Lista densa: nome, email, função, % comissão, sellers atribuídos (qtd), status (ativo/congelado), criado em.
- Por linha — ações: editar permissões (drawer com switches), alterar % comissão, alterar taxa mínima permitida (gerente), congelar/descongelar, resetar senha, ver auditoria, excluir.
- Drawer "Auditoria": timeline das ações do staff (aprovações de KYC, mudanças de taxa, processamento, refunds solicitados, etc.) — lê `staff_audit_log`.

**Reforço de permissões**: hook `useStaffPermission(key)` no front + checagem real no backend via RLS/edge function (front nunca é fonte de verdade). Triggers em `transactions`, `withdrawals`, `disputes`, `profiles` gravam `staff_audit_log` automaticamente quando o autor é staff/manager.

**Aprovações com rastro**: ao aprovar KYC/produto/saque, trigger preenche `approved_by`. UI do seller exibe "Aprovado por: João (staff)" — para sempre.

### 4. Comissões de Staff/Gerente

**Migração**:
- `staff_commission_config` (user_id PK, base_pct numeric, base text default 'net_amount', is_active bool).
- `staff_commission_overrides` (staff_user_id, seller_user_id, pct) — opcional por seller, sobrepõe a global.
- `staff_commissions_ledger` (id, staff_user_id, seller_user_id, transaction_id, type ['accrual','clawback_refund','clawback_med','payout','adjustment'], base_amount, pct, amount, balance_after, created_at, idempotency_key UNIQUE). Append-only, RLS admin + próprio staff (read).

**Triggers** (`AFTER UPDATE` em `transactions` e `disputes`):
- Venda completed → busca staff/gerente vinculado (gerente via `manager_seller_assignments`; staff via futura `staff_seller_assignments` ou por aprovador do KYC — definimos: usar `profiles.approved_by` como fallback). Aplica `pct × net_amount` → `accrual`.
- Refund/chargeback → `clawback_refund`/`clawback_med` negativo do mesmo valor (idempotente).
- Disputa MED resolvida contra seller → `clawback_med`.

Tudo idempotente via `idempotency_key = '<type>_<tx_or_dispute_id>_<staff_id>'`.

**Nova aba admin: "Comissões Staff/Gerente"** (`AdminStaffCommissionsTab`):
- KPIs: total a pagar (saldo positivo somado), pago no mês, clawbacks no mês, comissão média %.
- Tabela: Nome, Função, % padrão, Acumulado período, Clawbacks, Saldo a pagar, Último pagamento. Filtro por período.
- Clique abre painel:
  - Detalhe de todas as movimentações do ledger (transação, seller, base, %, valor, tipo).
  - Editor de % global e de overrides por seller (tabela editável inline).
  - Botão "Registrar pagamento" → modal (valor, método, observação) → insere `payout` no ledger e cria registro em `withdrawals` (tipo `staff_commission`) marcado como aprovado manualmente.
  - Export CSV.

**Visibilidade no painel do staff/gerente**: card no dashboard deles mostrando saldo de comissão, últimas movimentações, MEDs/refunds que descontaram, botão "Solicitar pagamento" (cria entry `payout_request` pendente — só você aprova).

### 5. Visual / UX

- Tabelas: 1px border, sem sombra/blur, fonte tabular para números, hover muda só o background, ações aparecem no hover (padrão Management Lists).
- Drawers laterais 760px via portal, mesma estrutura do `TransactionDetailPanel`.
- Sem animações de entrada em listas densas; transições 220-280ms apenas em drawers/modais.
- Todos os tokens semânticos (sem cor hardcoded).

### 6. Ordem de execução

1. Migração: `staff_permissions`, `staff_audit_log`, colunas `frozen`/`created_by_admin`/`staff_role_type`/`approved_by`, `staff_commission_config`, `staff_commission_overrides`, `staff_commissions_ledger`, triggers de auditoria e de comissão, GRANTS + RLS.
2. Edge functions: `admin-create-staff`, `admin-freeze-staff`, `admin-reset-staff-password`; atualizar `manager-login`.
3. Refatorar `AdminEmployeesTab` e `AdminManagersTab` (criar conta, permissões, congelar, auditoria, % comissão).
4. Criar `AdminStaffCommissionsTab` + entry no `AdminDashboard`.
5. Refazer `AdminTopSellersTab` (ranking detalhado + expansão).
6. Refazer `AdminInactiveSellersTab` (cards + tabela + painel de detalhes).
7. Card de comissão no dashboard do staff/gerente.
8. QA end-to-end: criar staff/gerente novo, aprovar KYC com ele, registrar venda, verificar accrual, refund → clawback, congelar conta → login bloqueado, auditoria visível.

### Notas técnicas

- Toda escrita sensível passa por edge function com checagem `has_role(auth.uid(),'admin')` server-side.
- `staff_audit_log` ganha trigger `RAISE EXCEPTION` em UPDATE/DELETE (imutável).
- Ledger de comissão usa `pg_advisory_xact_lock(hashtext(staff_user_id::text))` como o financial_ledger.
- Reaproveitar `SellerDetailDialog` e `TransactionDetailPanel` existentes para evitar duplicação.
