## Varredura Mobile — Área do Seller

Escopo grande demais pra uma resposta só sem quebrar coisa. Proposta em 4 ondas curtas, cada uma verificada antes de seguir.

### Onda 1 — Núcleo diário (maior tráfego)
- `Dashboard.tsx`: segmentação de período (grid 4 cols em mobile fica apertado), cards de KPI, listas de últimas vendas com truncate/tabular-nums, popover de 320px que estoura em telas <360px.
- `Suporte.tsx`: layout `380px_1fr` já responsivo; ajustar composer + preview de imagens + indicador de digitando pra não sumir/quebrar; scroll da lista de tickets em mobile.
- `Perfil.tsx` + `PerfilHub.tsx`: header, grid de KPIs 2/4 cols, formulários com `grid-cols-3/4` que precisam colapsar em <sm.

### Onda 2 — Vendas & Financeiro
- `vendas/*`: tabelas densas → `overflow-x-auto` + versão card em mobile pros itens principais.
- `financeiro/*`: KPI grid, extrato, saques (form PIX/cripto), gráficos com altura fixa e legendas cortadas.

### Onda 3 — Membros & Marketplace
- `membros/*`: cinema-style Netflix já é mobile-friendly; revisar filtros/tabs.
- `Marketplace.tsx`, `Premiacoes.tsx`, `PremiacoesHub.tsx`, `Gamificacao.tsx`: grids grandes (`xl:grid-cols-7`) e blobs de blur que causam scroll horizontal.

### Onda 4 — Hubs & auxiliares
- `IntegracoesHub.tsx`, `Certificado.tsx`, `StatusPage.tsx`, `ThankYou.tsx`, `PublicCheckout.tsx`.

### Padrão aplicado em todas as ondas
- Container: `px-3 sm:px-4 lg:px-6`, `overflow-x-hidden` no wrapper de página, blurs decorativos com `overflow-hidden` no pai.
- Grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` (nunca começar em ≥2 cols sem justificativa clara).
- Tipografia: `text-base sm:text-lg md:text-xl` em títulos; `truncate` + `min-w-0` em flex children com texto longo.
- Tabelas densas: wrapper `overflow-x-auto` + `min-w-[720px]` na tabela OU render alternativo em cards <md.
- Botões/CTAs: `w-full sm:w-auto`, altura mínima `h-11` pra toque.
- Modais/popovers: `w-[min(320px,calc(100vw-24px))]`.
- Preservar tokens semânticos, dark mode e animações existentes.

### Entrega
Começo pela **Onda 1** neste próximo turno, mostro diff, você aprova ou ajusta, sigo pra Onda 2. Assim nada quebra silencioso.