# Refino visual: banner, seletor de período, fundo e ícones do shell

## 1. Banner "Taxas baixas e saques instantâneos"

- Remover o chip **"Taxa a partir de 2,99%"** (some por completo da lista de selos).
- Recriar os três blocos circulados (Liquidação D+0, Reserva 0% e o seletor de período) fora do padrão "cartãozinho arredondado com borda":
  - **Liquidação / Reserva** viram *readouts técnicos* ancorados na ilustração: sem caixa fechada, apenas uma linha-guia fina saindo do anel até um rótulo com filete superior (regra hairline de 1px + micro-tick), número em tipografia display grande e unidade menor alinhada à base. Nada de fundo preenchido nem borda em volta — o valor "flutua" sobre o plate como marcação de instrumento.
  - Posicionamento passa a acompanhar o anel (um acima-esquerda, outro abaixo-esquerda), com espaçamento coerente e sem sobrepor o V central.

## 2. Seletor de período (print 1 e print 2)

- Trigger reconstruído: em vez do card com dial + valor empilhado, vira uma **barra-instrumento horizontal** discreta — marcação de dia em tipografia display, filete de progresso da meta na base (linha reta, não anel), rótulo do período e o valor em tabular; borda só no hover.
- Popover:
  - **Abre para o lado** (`side="left"`, alinhado ao topo) em telas médias/grandes, com fallback para baixo no mobile, evitando o corte da tela visto na print 2.
  - Layout em duas colunas: coluna esquerda com os presets empilhados (Hoje, 7, 15, 30, Este mês) e coluna direita com o calendário de intervalo.
  - Calendário compactado: dias menores, cabeçalho de mês em linha única com setas discretas, sem os separadores horizontais entre semanas; largura fixa que cabe na viewport.

## 3. Fundo cortado

- O fundo verde/contraste hoje é aplicado em camada que termina no limite do container rolável — passa a ser aplicado no shell inteiro (camada fixa cobrindo a viewport, atrás do conteúdo e da sidebar), de modo que o gradiente cubra até a borda inferior e direita da tela em qualquer altura de scroll.
- Ajuste do grid técnico e do gradiente para casar entre sidebar, topbar e área de conteúdo, sem "emenda" visível.

## 4. Ícones e moldura (print 3)

- Substituir os ícones padrão Lucide por **ícones próprios em SVG** (traço fino, geometria técnica), mantendo tamanho e área de clique:
  - lupa → glifo de busca com haste diagonal reta;
  - toggle da sidebar → marca de painel com barra de estado;
  - olho (privacidade) → íris geométrica com traço de corte quando oculto;
  - sol/lua → disco com raios em tick marks / crescente sólido;
  - sino → silhueta trapezoidal com badge de ponto.
- Moldura do shell: sidebar e topbar passam a compartilhar a mesma linguagem — borda hairline única, sem contorno duplo em volta da área de conteúdo, cantos do painel de conteúdo alinhados ao da sidebar, para não parecer "quadro dentro de quadro".

## Detalhes técnicos

- Arquivos: `src/components/dashboard/PromoBanner.tsx` (chips e readouts), `src/pages/Dashboard.tsx` (`PeriodDial` + popover), `src/components/layout/DashboardLayout.tsx` (topbar/ícones), `src/components/layout/AppSidebar.tsx` (moldura/trigger), `src/index.css` (`.platform-shell` / `.ambient-backdrop`), e um novo `src/components/icons/ShellIcons.tsx` com os ícones customizados.
- Só apresentação: nenhuma regra de negócio, query ou RLS é alterada.
