# Reformulação: topo do dashboard, painel admin clean e onboarding do seller

## 1. Topo do dashboard do seller (o que está na print)

- Remover o card "Faturamento · Hoje / meta" do cabeçalho — ele sai do topo por completo.
- O seletor de período (calendário) passa a viver dentro do `PromoBanner`, no canto superior direito do card — no lugar onde hoje aparece o readout "Autorização 118ms".
  - Novo calendário "futurista": botão compacto com grade de dias em SVG, anel de progresso da meta ao redor do ícone, rótulo do período ativo (Hoje / 7 / 15 / 30 / Período) e micro-brilho no hover. Abre o mesmo popover com presets + range custom já existente.
- "Seja bem-vindo, {nome}" desce e fica alinhado ao conteúdo, sem o bloco vazio à direita: cabeçalho vira uma faixa única e compacta, com o subtítulo logo abaixo e o botão de privacidade (olho) reduzido e discreto ao lado do nome.
- Remover o espaçamento morto entre saudação e o primeiro bloco (padding-top e `space-y` reduzidos).

## 2. Barra superior (topbar)

- Altura reduzida de 64px para ~52px, com ícones em 32px.
- Campo "Buscar em tudo…" some: fica apenas o ícone de lupa (mesmo atalho ⌘K, com tooltip).
- Ícones de olho (privacidade), tema (sol/lua) e sino redesenhados: traço mais fino, alvo quadrado 32px, raio 9px, borda só no hover, com estado ativo sutil.
- Avatar de perfil melhorado: anel duplo fino, iniciais em tipografia display e indicador de status (conta aprovada / em análise) como ponto no canto.
- Módulo de saldo compactado na mesma altura, sem perder o botão "Sacar".

## 3. Painel admin no mesmo estilo clean

Aplicar a linguagem visual do dashboard do seller (raio 10/12px, sem sombras nem gradientes, bordas hairline, transições só de cor):

- Sidebar do admin: item ativo como "cartão de seleção" (fundo tênue + borda + ícone em cor primária), sem chip preenchido nem glow.
- Cards/painéis (`AdminPremium.tsx`: `PremiumPanel`, `PremiumMetric`, `PremiumMetricGrid`, `PremiumSegmented`, `PremiumEmpty`, `premiumTable`): raios normalizados, remoção dos micro-caps com tracking exagerado, números tabulares, hover apenas em cor.
- Topbar e páginas de opções/configuração do admin (Settings, Tools, Acquirers, Command Center) alinhadas ao mesmo padrão de inputs/botões do seller.

## 4. Onboarding do novo seller

Novo bloco de onboarding no dashboard (substitui o popup KYC como fluxo principal, mantendo o upload existente):

- Checklist com 4 etapas e progresso: **Perfil/contato → Identidade (KYC) → Dados bancários/chave PIX → Conta ativada**.
- Cada etapa mostra estado (pendente / enviado / aprovado) lido do perfil, dos documentos KYC e das contas bancárias/PIX já cadastradas.
- Enquanto não concluído: banner fixo no topo do dashboard com CTA para a próxima etapa; ações de venda e saque exibem aviso e direcionam para a etapa pendente (o bloqueio real de saque no banco já existe e é mantido).
- Ao concluir todas as etapas, o bloco vira um card de "conta ativada" e desaparece no próximo acesso.

## Detalhes técnicos

- Arquivos: `src/pages/Dashboard.tsx` (cabeçalho, remoção do chip, passagem do estado de período para o banner), `src/components/dashboard/PromoBanner.tsx` (slot do calendário futurista), `src/components/layout/DashboardLayout.tsx` (topbar), `src/components/layout/AppSidebar.tsx` (ajustes finos), `src/pages/admin/AdminDashboard.tsx` + `src/pages/admin/tabs/AdminPremium.tsx` + tabs de opções, e um novo `src/components/dashboard/SellerOnboarding.tsx`.
- O onboarding lê dados via os hooks já existentes (`useProfile`, consultas de `bank_accounts`/`pix_keys` e storage `kyc-documents`) — sem mudanças de schema.
- Somente frontend/apresentação; nenhuma regra de negócio ou RLS é alterada.
