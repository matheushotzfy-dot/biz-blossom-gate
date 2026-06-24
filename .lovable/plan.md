## Objetivo
Refazer o layout mobile (≤640px) de várias abas pra ficar com cara de **aplicativo nativo premium** — cards densos porém respiráveis, tipografia legível, hierarquia clara, sem overflow, sem cards desproporcionais, microinterações táteis.

## Páginas no escopo
1. `src/pages/vendas/Vendas.tsx` — aba Vendas
2. `src/pages/vendas/Produtos.tsx` — aba Produtos
3. `src/pages/IntegracoesHub.tsx` + grid de opções (a "opção" bugada que você citou)
4. `src/pages/financeiro/*` — hub financeiro (Saldo, Saques, Taxas, Extrato)
5. `src/pages/PerfilHub.tsx` / `Perfil.tsx`
6. `src/pages/vendas/ApiKeys.tsx` — Credenciais
7. `src/pages/vendas/Documentacao.tsx` + `ApiDocsComplete.tsx`

## Padrão visual mobile (aplicado em todas)

**Layout & grid**
- Container mobile: `px-3 pb-24 pt-3` (respiro nas bordas + espaço pra bottom nav)
- Stat cards: grid `grid-cols-2 gap-2.5` (nada de 1-col gigante nem 4-col esmagado)
- Listas: cards full-width `rounded-2xl` com altura uniforme, sem texto saindo
- Tabs/segmented control: scroll horizontal com snap (`overflow-x-auto snap-x`) ao invés de quebrar linha

**Cards (estilo app)**
- `rounded-2xl border border-border/60 bg-card/80` 100% sólido
- Padding `p-3.5` mobile, `p-5` desktop
- Header: ícone 36×36 em pill `rounded-xl bg-primary/10` + título `text-[13px] font-semibold` + valor `text-xl font-bold tabular-nums`
- Truncate em TODO texto longo (`truncate` + `min-w-0` no flex parent)
- Sub-label `text-[11px] text-muted-foreground`

**Tipografia mobile**
- H1 página: `text-[22px] font-bold tracking-tight`
- H2 seção: `text-[15px] font-semibold`
- Body: `text-[13px]`
- Números financeiros: `font-mono tabular-nums`

**Interações táteis**
- `active:scale-[0.97] transition-transform duration-150`
- `hover:bg-accent/40` em itens de lista
- Loading skeletons no mesmo formato dos cards finais

**Bugs a corrigir**
- Remover qualquer ícone "quebra-cabeça" remanescente em IntegracoesHub
- Garantir `min-w-0` em flex children pra impedir overflow
- Substituir classes Tailwind inválidas (ex: `h-4.5`, `bg-x/12`) por válidas
- Charts: `ResponsiveContainer` com `aspect-ratio` ao invés de altura fixa, pra não estourar no mobile

## Mudanças específicas por página

**Vendas (`Vendas.tsx`)**
- KPIs no topo: grid 2×2 compacto (receita, vendas, ticket médio, conversão)
- Filtros: segmented control horizontal scrollable (Hoje/7d/30d/Custom)
- Lista de transações: card por linha mobile (cliente + valor à direita + status pill), tabela só ≥md
- FAB de "Exportar" fixo bottom-right no mobile

**Produtos (`Produtos.tsx`)**
- Grid `grid-cols-2 gap-3` mobile (não 1-col)
- Card produto: thumbnail 16:9, nome 2 linhas truncado, preço destacado, badge status
- Busca sticky no topo `sticky top-0 bg-background/95 backdrop-blur`

**Financeiro (hub + sub-páginas)**
- Card de saldo principal full-width destaque (gradiente sutil emerald)
- Ações rápidas: 4 ícones em linha (Sacar, Extrato, Taxas, Antecipar) estilo app bancário
- Lista de movimentações: ícone categoria + descrição + valor colorido (verde/vermelho) + data pequena

**IntegracoesHub**
- Remover ícone bugado
- Grid 2-col mobile com cards iguais: logo serviço + nome + status pill (Conectado/Disponível)
- Categorias como chips horizontais scrolláveis
- Tap no card abre bottom-sheet com detalhes ao invés de navegar

**Perfil (PerfilHub + Perfil)**
- Header avatar + nome + email centralizado (estilo iOS Settings)
- Lista de seções com ícone à esquerda, label, chevron à direita
- Agrupado em "cards" de 3-5 itens com divisor sutil
- Toggle de dark mode inline

**Credenciais (ApiKeys)**
- Cards de chave: label + key parcial mascarada + botão copy grande
- Ações em swipe/long-press no mobile (revelar/revogar)
- CTA "Nova chave" sticky no bottom

**Documentação**
- TOC colapsável no topo mobile (accordion)
- Code blocks com scroll horizontal + botão copy fixo
- Tipografia leitura: `text-[14px] leading-relaxed`
- Nav lateral vira drawer no mobile

## Detalhes técnicos
- Tudo via tokens semânticos (sem `text-white`, `bg-black`)
- Reaproveitar `StatCard.tsx` já refinado
- Componentes shadcn já existentes (Card, Badge, Button, Sheet, ScrollArea)
- Sem novas libs
- Verificação Playwright em 360px, 390px, 768px, 1280px após implementar — screenshot de cada página

## Fora do escopo
- Lógica de negócio, queries, edge functions
- Layout desktop (já está OK conforme conversas anteriores) — só ajustes pontuais se quebrar

Posso seguir e implementar tudo isso?