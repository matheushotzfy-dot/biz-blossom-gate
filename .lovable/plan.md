# Produtos limpo + navegação lateral com identidade própria

Três frentes, só visual: nada de mudança em queries, rotas ou handlers.

## 1. Produtos — tirar o excesso (partes circuladas)

Sair da página:

- A faixa de 4 KPIs (Produtos no catálogo / Ativos / Rascunhos / Em revisão) — a informação já vive nas tabs e no contador do header.
- A barra "Catálogo · 4 produtos · Todos" com o ícone verde.

O que fica: header da página (título + Novo produto), a linha de tabs de status e a busca. A busca sai da barra removida e passa a morar na mesma linha das tabs — tabs à esquerda, campo de busca compacto à direita (empilha no mobile). Resultado: da headline direto para o grid, sem dois blocos redundantes no meio.

## 2. Card do produto — hover com vida, sem peso

Estado de repouso continua limpo. No hover, três coisas acontecem juntas em 220ms:

- A capa faz um zoom mínimo (scale 1.03) por trás da borda arredondada, com um véu escuro que se dissolve de baixo para cima.
- A borda ganha o verde da marca e o card sobe 3px, com um halo verde muito difuso (não sombra cinza).
- Os ícones de ação (builder, pixels, abrir, "...") saem de 55% de opacidade para cheios, e o botão Editar ganha um leve brilho na borda.

Sem blur pesado, sem filtro caro: apenas transform/opacity, animação em GPU, `will-change` só durante o hover para não travar em listas grandes. No toque (mobile) os ícones já ficam sempre visíveis.

## 3. Sidebar — sair do padrão

O problema hoje: filete + ícone + texto, ou seja, o desenho genérico de qualquer template. Proposta de linguagem própria:

- **Trilho vivo:** uma coluna fina de 2px percorre toda a área de navegação. O indicador do item ativo não é um filete estático — é um segmento verde que desliza verticalmente até o item selecionado (mesma técnica de "magic line", 260ms), então a mudança de aba é um movimento contínuo, não um piscar.
- **Ícone em cápsula:** cada item ganha um quadrado arredondado (28px) atrás do ícone. Inativo: transparente. Hover: preenchimento sutil. Ativo: preenchimento verde 12% com o ícone em verde cheio. Isso dá âncora visual e faz o modo colapsado (só ícones) continuar legível.
- **Seções sem ruído:** os rótulos COMANDO / INFOPRODUTOS / FINANCEIRO viram micro-labels de 9.5px com traço curto ao lado, em vez de bloco de texto solto.
- **Contadores em pílula:** o "04" atual vira uma pílula discreta alinhada à direita, verde quando o item está ativo.
- **Hover coerente:** fundo do item aparece em 200ms com o texto passando de 60% para 100%; nada de deslocamento lateral que causa reflow.
- **Item ativo:** fundo levemente elevado + tipografia semibold + cápsula verde, tudo lido de uma vez, sem depender só de cor de texto.

Tudo com os tokens existentes (verde da marca + escala dark do sidebar). Nenhuma cor nova.

## Detalhes técnicos

- `src/pages/vendas/Produtos.tsx`: remover `HDStatGrid`/`HDStat` (e o cálculo `counts` deixa de alimentar KPIs mas continua alimentando as tabs), remover a prop `toolbar` do `ProductGridView`, e recompor a linha tabs + busca.
- `src/components/products/ProductGridView.tsx`: remover o container `toolbar`; adicionar as camadas de hover no `ProductCard` (wrapper `overflow-hidden` na capa, `group-hover:scale-[1.03]`, transições em transform/opacity apenas).
- `src/components/layout/AppSidebar.tsx`: refazer o render do item de navegação (cápsula do ícone, pílula do contador, micro-label de seção) e trocar o filete estático por um indicador posicionado via `ref`/`offsetTop` do item ativo, com fallback estático enquanto mede.
- Estados colapsado, sobreposto (unpinned) e mobile revalidados após a mudança.
