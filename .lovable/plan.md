## Objetivo

Corrigir os alinhamentos do header do dashboard, melhorar o painel de notificações (real-time, destaque de avisos, mobile z-index), e criar uma nova aba **Corrida de Faturamento** dentro de Premiações — totalmente conectada ao banco e configurável pelo admin.

---

## 1) Alinhamento dos ícones do header (arquivo `src/components/layout/DashboardLayout.tsx`)

Hoje o botão Search (`h-10 w-10 rounded-xl`), o toggle de olho dentro do card de saldo (`h-8 w-8 rounded-xl`), o toggle de tema (`h-8 w-8 rounded-md`) e o sino de notificações (`h-8 w-8 rounded-md`) usam tamanhos, raios e paddings diferentes → visual desalinhado.

- Padronizar **todos** os botões utilitários do header (Search, Tema, Notificações, Olho de privacidade) em: `h-9 w-9 rounded-xl border border-border/60 bg-muted/40 hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-primary`, ícone `h-4 w-4` strokeWidth 2.
- Agrupar Tema + Sino no mesmo cluster do Search com `gap-1.5`, alinhados via `items-center`.
- O botão "olho" que está dentro do card de saldo passa a viver **fora** do card (ao lado direito de Search), para não bagunçar a altura do card.
- Divisor vertical entre cluster de ações e avatar com `h-6 w-px bg-border/60`.
- Badge de não-lidas no sino: `-top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card`.

## 2) Painel de Notificações (`src/components/NotificationPanel.tsx` + `useNotificationCount`)

- **Real-time confiável**: hoje só ouve `INSERT`. Ampliar para `event: "*"` (INSERT/UPDATE/DELETE) e disparar refetch quando novo status de venda/saque cria notificação. Mover `loadNotifications` para fora e chamar tanto no INSERT quanto no UPDATE. Aplicar o mesmo em `useNotificationCount`.
- **Destaque para avisos importantes** (`type in ('announcement','alert','warning')` e `user_id IS NULL` = geral):
  - Renderizar em uma seção "Avisos importantes" no topo do painel, com card destacado (borda `border-primary/40`, fundo `bg-primary/[0.06]`, ícone maior, label "IMPORTANTE").
  - Após "Marcar todas como lidas", essa seção **desaparece automaticamente** (filtro por `!is_read`). Volta ao normal (apenas lista abaixo).
- **Mobile/tablet z-index bug** ("abre atrás"): o painel usa `z-[70]` mas o header sticky usa `z-30`, `MobileBottomNav` e `MobileRevenueBar` podem ter z-index maior em algumas telas. Também há `SidebarInset` com `overflow-hidden`. Correções:
  - Renderizar via **Portal** no `document.body` (React `createPortal`) para escapar do stacking context do `SidebarInset`.
  - Backdrop `z-[100]`, painel `z-[110]`.
  - Em mobile, posicionar o painel como bottom-sheet (`inset-x-0 bottom-0 rounded-t-3xl max-h-[85vh]`) em vez de `top-14`, com animação `slide-in-from-bottom`.
- Ajustar espaçamento interno do header do painel (título + contador + botões) para ficar visualmente balanceado.

## 3) Nova aba "Corrida de Faturamento" (Premiações)

### Frontend
- `src/pages/PremiacoesHub.tsx`: adicionar nova tab `{ id: "corrida", label: "Corrida de Faturamento", icon: Trophy }` além da existente "Premiações".
- Criar `src/pages/CorridaFaturamento.tsx` seguindo o **mesmo layout** do Dashboard (Hero banner com pódio, KPI cards, tabela de ranking, cards de premiações). Sem exageros — mesma paleta Navy Trust, mesmos raios `rounded-3xl`/`rounded-2xl`, tipografia Sora/Manrope.
- Seções:
  1. **Hero da corrida ativa**: nome, prêmio destaque (imagem/logo), datas início/fim, countdown, meta total.
  2. **Pódio Top 3** com foto/nickname e valor faturado no período.
  3. **Ranking completo** (tabela): posição, seller, faturamento no período, % da meta, prêmio associado à faixa.
  4. **Grade de premiações** (cards com imagem/logo, título, faixa de faturamento requerida ex.: "R$ 100k → iPhone 17 Pro").
  5. **Minha posição** (destaque para o seller logado): posição, quanto falta pra próxima faixa/prêmio, barra de progresso.

### Admin — nova aba em `src/pages/admin/AdminDashboard.tsx`
- Criar `src/pages/admin/tabs/AdminCorridasTab.tsx`:
  - CRUD de corridas: título, descrição, `starts_at`, `ends_at`, `is_active`, logo/banner, moeda (BRL).
  - CRUD de faixas de prêmio dentro da corrida: título do prêmio, imagem/logo (upload), valor mínimo de faturamento, ordem, posição-alvo (opcional).
  - Preview em tempo real do ranking calculado (mesma view do seller).
  - Ação "Recalcular ranking agora".

### Banco (migração)
Tabelas novas (com GRANTs + RLS conforme padrão da plataforma):

- `public.revenue_races` — colunas de domínio: `title`, `description`, `starts_at`, `ends_at`, `is_active`, `banner_url`, `logo_url`.
- `public.revenue_race_prizes` — `race_id (fk)`, `title`, `image_url`, `min_revenue_cents`, `target_position`, `sort_order`.
- View/RPC `race_leaderboard(race_id)` — soma `transactions.net_amount` por `seller_id` no intervalo `[starts_at, ends_at]` com `status='completed'`, ordenado desc.

Políticas:
- `revenue_races` / `revenue_race_prizes`: SELECT liberado para `authenticated` (todos os sellers veem); INSERT/UPDATE/DELETE só `has_role(auth.uid(),'admin')`.
- Ranking calculado via RPC `security definer` que só retorna agregados (nome público + valor), sem vazar dados sensíveis.

### Storage
- Bucket público `race-assets` para logos/banners dos prêmios (uploads do admin).

## 4) Verificação

- Playwright headless: abrir `/dashboard` em viewport desktop e mobile, screenshotar o header alinhado e o painel de notificações aberto (em ambos os viewports).
- Abrir `/premiacoes?tab=corrida`, validar hero + ranking + minha posição.
- Abrir admin, criar uma corrida de teste + 3 faixas de prêmio, confirmar que aparece na tela do seller.

---

## Fora do escopo
- Não altero lógica de vendas, transações, adquirentes ou webhooks.
- Não mexo no fluxo de saques nem no Auth.
