## Objetivo

Elevar visualmente 4 superfícies financeiras + interações do sidebar, mantendo 100% da lógica de negócio. Tudo segue a memória do projeto: **sem glassmorphism, sem shadow exagerado, sem blur, sem glow** — bordas 1px sólidas, tokens semânticos, Plus Jakarta Sans / Space Grotesk / JetBrains Mono para números, transições suaves 220-280ms cubic-bezier.

## 1. SaquesHub (wrapper)

Hoje usa `backdrop-blur-xl` e `shadow-[0_0_20px_...]` no header — viola padrão.

- Trocar header para `bg-background` com `border-b border-border` sólido (sem blur).
- Remover shadow do ícone, substituir por borda + fundo sólido.
- Unificar abas PIX/Crypto: pílula ativa em `bg-primary/10 text-primary` com `border border-primary/25`, inativa em `text-muted-foreground hover:bg-muted/40`.
- Reduzir altura do header (h-16 → h-14) para densidade premium.
- Indicador "Sistema Online" minimalista: ponto verde + label, sem `animate-ping`.

## 2. Saques PIX (`Saques.tsx`)

A página já é densa e bem estruturada. Refino cirúrgico, sem reescrever lógica:

**Hero (header)**
- Valor disponível: manter tipografia gigante, mas adicionar microcopy "Disponível para saque" em uppercase 9px acima do número (cria contexto imediato).
- Linha de meta-info (pendentes / retido / refresh) → reorganizar como 3 chips horizontais com divisores `|`, mais escaneável.
- Botão "Novo saque": realçar com ícone `+` em círculo `bg-success-foreground/15` interno + texto, mantendo `bg-success`.

**KPIs**
- Eliminar `rail` lateral colorido (decoração frágil). Trocar por **micro-sparkline embutida** de 24h no canto direito de cada KPI (Total sacado, Aprovação, Pendentes) — premium real.
- Padronizar ícone monocromático top-right por KPI em vez do trace de cor lateral.

**Dialog "Solicitar Saque"**
- Aumentar para `max-w-[440px]`.
- Saldo no topo: card maior com label + valor enorme + microcopy de retido.
- Campo de valor: input gigante (h-16, font-black 32px) com prefixo R$ flutuante, atalhos 25/50/75/Máx como chips arredondados maiores.
- Breakdown (solicitado → taxa → líquido) virá como mini-tabela com 3 linhas, separadas por `border-border/40`, número líquido em verde grande.
- Seleção de chave PIX: cards com `radio` à direita, ícone do tipo (CPF/Email/Phone) à esquerda em cor por tipo (sutil).
- CTA inferior fixo com altura 48px, micro-status "Aprovação em até 24h úteis" abaixo.

**Gráfico**
- Adicionar header com valor agregado em destaque + mini badge de variação vs período anterior.
- Reduzir altura para 200px, padding interno consistente.
- Cor da área: `primary` com stop opacity 0.18 → 0 (mais sutil).

**Histórico**
- Tabs de status: pílulas com contador, cores sólidas por status (sem `bg-secondary` cinza neutro no ativo — destacar com cor própria).
- Linhas da tabela: altura uniforme 56px, hover `bg-muted/30`, valor monetário sempre em `tabular-nums`, status como chip `border + bg/10`.

## 3. Saques Crypto (`SaquesCrypto.tsx`)

Foco maior aqui — precisa de presença real de mesa de operações cripto.

**Hero**
- Mesma estrutura do PIX para consistência (valor disponível enorme + linha de meta).
- Adicionar widget **"Cotações ao vivo"** logo abaixo do título: 3 cards horizontais (BTC / USDT / XMR) com símbolo, preço em BRL, variação 24h colorida, mini-sparkline. Atualização visível (timestamp).

**Seletor de ativo**
- Trocar dropdown atual por **grid de 3 cards-pílula** (BTC / USDT / XMR) — selecionado fica com `border-primary` + bg `primary/8`, mostra ícone do símbolo (letra estilizada se sem SVG) na cor do ativo (laranja BTC, verde USDT, laranja XMR) com saturação reduzida.

**Seletor de rede**
- Lista vertical compacta com ícone monocromático, nome da rede + sigla curta à direita.
- Indicador de taxa estimada por rede ("≈ R$ X em taxa de rede") quando aplicável.

**Dialog "Novo saque crypto"**
- Estrutura igual ao PIX para coerência: saldo → valor → ativo/rede → endereço → breakdown → CTA.
- Campo de endereço com validação básica de formato + botão "Colar" e "QR scan" (ícone, ainda placeholder).
- Aviso de irreversibilidade: faixa amarela sutil `bg-warning/8 border-warning/25` acima do CTA.

**KPIs cripto**
- Total sacado, ticket médio em USD/BRL toggle, número de redes utilizadas, tempo médio de confirmação.
- Sparkline em cada KPI (consistente com PIX).

**Histórico**
- Coluna extra: rede (chip pequeno com sigla).
- Hash da transação como link `font-mono` truncado com `tooltip` no hover do full hash.

## 4. QuickPixDialog (Link de Pagamento)

Hoje usa `bg-gradient-to-br`, `backdrop-blur`, `ring`, `shadow-md` — viola padrão.

- Remover todos os gradientes e blur. Header sólido `bg-card` com `border-b border-border`.
- Ícone do header sem ring/glow, apenas `bg-primary/10 border border-primary/20`.
- Inputs: padronizar com a altura/estilo dos outros formulários do projeto (h-11 default, h-14 só pro campo de valor).
- Botão CTA: `bg-primary` sólido, sem shadow.
- Tela de resultado:
  - QR code em card `bg-white border border-border` (mantém branco interno para contraste do QR, é correto).
  - Bloco "PIX copia e cola" com fundo `bg-muted/40` (não `background/60` translúcido), borda sólida.
  - Timer como chip discreto sem fundo colorido, ícone + número monospace.
  - Mensagem "Aguardando pagamento" com ponto pulsante verde (consistente com sidebar status).
- Tela de confirmação: ícone success em círculo sólido `bg-success/10 border border-success/30`, sem ring.

## 5. Sidebar — interações mais lisas (`AppSidebar.tsx`)

Hoje: `transition-colors duration-200` linear. Memória pede 220-280ms com cubic-bezier suave.

- Trocar todos os hovers para `transition-all duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]` (curva Apple).
- Itens do menu:
  - Hover atual: `hover:bg-sidebar-accent/55` → adicionar **translação sutil** `hover:translate-x-[2px]` e ícone com `group-hover/nav:scale-[1.08]` para feedback orgânico.
  - Estado ativo: manter `bg-sidebar-primary` mas adicionar **indicador vertical** à esquerda (`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-primary-foreground rounded-r-full`) — assinatura premium.
  - Border do item: trocar `border-transparent` → fundo sólido no hover (sem borda piscando).
- Active state em click: `active:scale-[0.98]` global em todos os botões do sidebar (header, footer, items).
- Card de receita (RevenueCard): suavizar hover (sem `hover:shadow-lg`, trocar por subtle `hover:bg-sidebar-accent/45` + `translate-y-[-1px]`).
- Botões do footer (Suporte / Perfil / Logout): mesma curva e micro-translation.

## Detalhes técnicos

- Nenhuma mudança em queries, hooks, RPCs, edge functions ou tabelas.
- Nenhum arquivo novo — apenas edição de:
  - `src/pages/financeiro/SaquesHub.tsx`
  - `src/pages/financeiro/Saques.tsx`
  - `src/pages/financeiro/SaquesCrypto.tsx`
  - `src/components/QuickPixDialog.tsx`
  - `src/components/layout/AppSidebar.tsx`
- Tokens semânticos exclusivamente (`primary`, `success`, `warning`, `destructive`, `muted-foreground`, `border`, `card`, `background`, `sidebar-*`).
- Tipografia financeira: `font-display` (Space Grotesk) para números grandes, `tabular-nums slashed-zero` em todo valor monetário.
- Sem `framer-motion` novo onde já existe; sem `backdrop-blur` em lugar nenhum.
- Validação final: abrir cada página no preview e verificar densidade, contraste, alinhamento.

## Critérios de pronto

- Saques PIX e Crypto visualmente irmãos, ambos com presença de "mesa de operações de tesouraria".
- QuickPixDialog limpo, sem nenhum efeito que violasse a memória.
- Sidebar com hover/active claramente mais "liso" e premium.
- Build verde, sem regressões funcionais.