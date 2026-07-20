
# Refino Premium — Dashboard, Link de Pagamento e Premiações

Objetivo: elevar o padrão visual de 4 áreas que ainda estão "genéricas demais", mantendo o design system Navy/Emerald + Sora/Manrope, sem inventar componentes fora do padrão.

## 1. Dashboard · Últimas Transações (lista + detalhe)

**Lista (`src/pages/Dashboard.tsx` — bloco a partir da linha ~955)**
- Substituir a lista simples por linhas "editorial" com:
  - Avatar circular com iniciais do cliente + halo colorido pelo status (emerald/amber/rose/steel).
  - Coluna principal: nome do cliente em Sora bold + linha secundária com produto · método · hora relativa ("há 4 min").
  - Coluna de valor tabular à direita (JetBrains Mono) + micro-badge de status estilo "pill 1px border" (padrão management-list).
  - Divisor sutil `border-border/40` entre linhas, hover lift `translateY(-1px)` + glow lateral primary/10.
  - Ícone de método (PIX / cartão) num quadradinho 32px `bg-muted/40`.
- Cabeçalho da seção ganha KPI compacto ("14 hoje · R$ 2.480 · taxa aprovação 92%") e um filtro segmentado (Todas / Aprovadas / Pendentes) 1px border, sem shadow.
- Empty state redesenhado com ilustração leve (ícone `Receipt` num círculo emerald + microcopy).

**Detalhe (`src/components/transactions/TransactionDetailPanel.tsx`)**
- Reorganizar o panel 760px em 3 blocos verticais bem definidos:
  1. **Hero do cliente**: avatar 56px + nome + documento mascarado + status pill grande; à direita valor grande Sora black + método.
  2. **Grid 2 colunas de metadados** (produto, adquirente="HOTZFY", taxa, líquido, IP, UTM) em cards internos com 1px border e labels 10px uppercase tracking-widest.
  3. **Timeline** (`TransactionTimeline`) já existente, mas com header próprio e conector vertical mais nítido.
- Ações no rodapé (reembolsar / copiar id / abrir cliente) num cluster com 1px border, sem gradientes chamativos.
- Manter tokens semânticos, sem shadow/glass.

## 2. Dashboard · Gráfico de Faturamento (só o gráfico)

**Alvo:** bloco "Faturamento" a partir da linha ~816.

- Trocar barras por **AreaChart dupla** (entradas em emerald, reembolsos em muted) com:
  - Gradiente vertical primary → transparente.
  - Grid horizontal pontilhado `strokeDasharray="2 4"` cor `border/40`, sem grid vertical.
  - Eixo Y removido; eixo X só com ticks de início/meio/fim.
  - Tooltip customizado (card 1px border, valor em tabular, delta vs período anterior).
  - Ponto ativo destacado com halo emerald.
- Header do card ganha 3 mini-KPIs alinhados à direita: **Total · Ticket médio · Melhor dia**, cada um em coluna com label 10px uppercase.
- Toggle Hoje/Semana/Mês continua, mas em estilo "segmented control" mais limpo (pill single, sem borda dupla).

## 3. Dashboard · Cards "Faturamento hoje / Meta" e KPI de Premiação (topo)

**Alvo:** chip combinado ~626 e o card "Faturamento Total" (~740).

- Chip Faturamento/Meta vira **hero card horizontal** ocupando full width no topo:
  - Coluna esquerda: label "Faturamento" + valor grande Sora black + delta vs período anterior (seta emerald/rose).
  - Coluna central: barra de progresso da meta com marcador do valor atual, meta em label acima, "faltam R$ X" abaixo.
  - Coluna direita: chip do período clicável (abre popover de filtro) + atalho "hoje".
- Card KPI "Faturamento Total" (canto superior esquerdo do grid de KPIs) recebe tratamento **destaque**:
  - Fundo com gradient sutil primary/[0.06] → transparente.
  - Ícone num quadrado 44px com 1px border primary/30.
  - Sparkline reduzida integrada abaixo do valor com linha 2px + área.
  - Micro-badge "vs período anterior" com número tabular.
- Padding, tipografia e espaçamento alinhados aos outros KPIs para manter grid.

## 4. Premiações (`src/pages/Premiacoes.tsx`)

Reescrita da tela em estilo "achievement vault" cinematográfico (respeitando o memory `Achievement Vault`), sem depender de cards genéricos.

- **Hero editorial**: título Sora ultra-black em 2 linhas ("Sua jornada de conquistas · Hotzfy Awards"), subheader com métricas do usuário (total desbloqueado / próximo marco / ranking global) numa linha só com separadores verticais 1px.
- **Trilha de tiers** (Bronze → Diamond) como **timeline horizontal** no topo:
  - Nós circulares grandes com o ícone do tier; os já conquistados em emerald sólido, futuros em muted com 1px border tracejada.
  - Linha conectora com progresso preenchido até o tier atual.
  - Ao clicar num nó, rola até a seção do tier.
- **Vault de troféus**: grid assimétrico (bento) por tier, cada troféu como "plaque" 3D-lite:
  - Frente com ícone grande centralizado, nome em Sora, faturamento requerido em tabular abaixo.
  - Estado bloqueado: monocromático + overlay 1px border tracejada + label "R$ X para desbloquear".
  - Estado desbloqueado: leve gradiente emerald, badge "Conquistado em dd/mm/aaaa".
  - Hover: lift + glow emerald/20, sem shadow pesado.
- **Painel lateral "Próxima conquista"** fixo em desktop (xl:col-span-1) com:
  - Nome do próximo troféu, barra de progresso, valor faltante em tabular, CTA "Ver detalhes".
- **Sem "cards com legenda comum"** — remover subtítulos redundantes e mover metadados pra tooltip/hover.
- Manter dark mode via tokens, tipografia Sora/Manrope, densidade alta.

## 5. Checkout do Link de Pagamento (`src/pages/PublicPaymentLink.tsx`)

Reforma completa do layout público para parecer produto real, não "AI generado":

- **Layout split 2 colunas em desktop** (`lg:grid-cols-[1.1fr_1fr]`), coluna única no mobile:
  - **Esquerda (brand/produto)**:
    - Cover ocupando altura total com overlay gradient bottom→top, título e descrição sobrepostos no rodapé em Sora black.
    - Chip do vendedor (avatar + nome + selo verificado) no topo.
    - Rodapé com selos de segurança: "PIX oficial · SSL · Anti-fraude" em ícones 1px border.
    - Sem cover: fallback com pattern sutil de pontos + monograma do vendedor.
  - **Direita (checkout)**:
    - Header sticky com valor em Sora ultra-black tabular + parcelamento fake removido (é PIX).
    - Stepper 1px border: "1 Dados · 2 Pagamento · 3 Confirmação".
    - Inputs revisados: labels 10px uppercase, altura 48px, focus ring emerald 1px, placeholders com exemplo real.
    - Máscara CPF/CNPJ com feedback inline (badge verde ao validar).
    - Botão CTA "Gerar PIX" full-width, 52px, com ícone à esquerda e microcopy "Aprovação em segundos" abaixo.
- **Estado PIX gerado**:
  - QR Code **real renderizado como imagem** (usar `pixQrCodeImage` do payload PodPay v2 já suportado) num card centralizado 260×260 com borda emerald.
  - Botão "Copiar código PIX" grande + código truncado com tooltip.
  - Contador regressivo de expiração em tabular grande.
  - Passo a passo "Como pagar" em 3 bullets numerados com ícones.
- **Estado aprovado**:
  - Fullscreen success com checkmark animado (SVG stroke), mensagem, id da transação e CTA "Baixar comprovante".
- Trocar `bg-gradient-to-br from-background via-background to-primary/[0.03]` por fundo mais premium (`bg-background` + camada radial emerald sutil no topo).
- Micro-interações: `motion` já disponível — fade+y nos steps, sem animação exagerada.

## Detalhes técnicos

- Arquivos tocados:
  - `src/pages/Dashboard.tsx` (hero de faturamento, KPI destaque, gráfico Area, lista últimas transações).
  - `src/components/transactions/TransactionDetailPanel.tsx` (reorg completa).
  - `src/pages/Premiacoes.tsx` (reescrita da UI mantendo dados/hooks existentes).
  - `src/pages/PublicPaymentLink.tsx` (reescrita do layout, mantendo lógica de fetch/`pay-link-pix`).
- Sem alterações de schema, RPC ou edge functions — puramente UI/apresentação.
- Todos os tokens via `bg-*`, `text-*`, `border-*` semânticos. Sem hex hardcoded. Sem glass/shadow além do padrão do design system.
- Testes: `tsgo` clean; verificação visual via Playwright screenshots das 4 telas ao final.
- Fonts: Sora (display), Manrope (body), JetBrains Mono / Inter Tabular para números — já no projeto.

## Ordem de execução

1. Dashboard: hero faturamento/meta + KPI destaque.
2. Dashboard: gráfico Faturamento (Area + tooltip).
3. Dashboard: lista Últimas Transações + `TransactionDetailPanel`.
4. `PublicPaymentLink` reescrita.
5. `Premiacoes` reescrita.
6. Typecheck + screenshots de validação.
