# Produtos no padrão da aba Vendas + sidebar fluida

Três frentes: padronizar a página de Produtos com a linguagem visual da aba de Vendas, tirar o peso/lag da UI, e deixar a expansão do menu lateral realmente lisa.

## 1. Produtos com o mesmo idioma visual de Vendas

Hoje Produtos usa cards soltos em grade, com pílulas, botões circulares e tipografia própria — nada disso existe em Vendas. Vendas usa um painel único com cabeçalho, linhas densas divididas por 1px, avatar/thumb quadrado arredondado, badge de status com ponto, valor tabular à direita e paginação no rodapé. Produtos passa a usar exatamente essa estrutura:

- **Painel único** com borda 1px e cabeçalho de colunas (Produto · Status · Entrega · Preço · Checkout), no lugar da grade de cards.
- **Linha de produto** (desktop): thumb 40px arredondada, nome + tipo de entrega abaixo, badge de status com ponto no mesmo mapa de cores de Vendas (emerald/amber/muted/destructive), preço em `tabular-nums` alinhado à direita, e ações reveladas no hover (editar, checkout builder, pixels, abrir checkout, menu).
- **Card mobile**: mesma anatomia dos cards de venda no mobile — bloco tocável de altura confortável, título + preço na primeira linha, entrega + data na segunda, badges na terceira.
- **Rascunhos**: em vez do bloco grande de checklist dentro do card, a linha mostra o badge "Rascunho" e o contador "N itens pendentes"; a checklist completa aparece só quando a linha é expandida, mantendo a lista compacta.
- **Link do checkout**: chip monoespaçado copiável, alinhado ao estilo de chips de método de pagamento da aba de Vendas.
- **KPIs no topo**: reaproveitar `HDStatGrid`/`HDStat` (mesmos componentes de Vendas) para Total, Ativos, Rascunhos e Em revisão, com scroll horizontal por snap no mobile.
- **Filtros/busca**: manter os mesmos controles atuais, ajustando raio, altura e tipografia aos usados em Vendas.
- **Paginação** no rodapé do painel com o mesmo componente visual de Vendas quando o catálogo passar de 25 itens.

Nenhuma funcionalidade nova: os mesmos handlers (editar, duplicar, pausar/ativar, pixels, área de membros, copiar link, excluir, limpar rascunhos) continuam ligados.

## 2. Performance / sem lag

- Remover blur e sombras pesadas remanescentes das superfícies do shell (regras com `box-shadow` de raio alto e `filter` em transição no CSS global), deixando hover só de cor/borda.
- Reduzir a transição global dos cards (`transform` + `filter` em 420ms) para transição curta de cor, eliminando repaint em listas grandes.
- Memoizar a linha de produto (`memo`) e estabilizar os handlers com `useCallback` na página, para que digitar na busca não re-renderize todas as linhas.
- Skeleton leve: um único bloco com a mesma altura da linha real, sem múltiplas camadas animadas.
- Imagens dos produtos com `loading="lazy"`, `decoding="async"` e dimensões fixas para evitar reflow.

## 3. Sidebar (expansão no hover)

Problemas atuais: o gap da sidebar fica travado na largura de ícone enquanto o painel cresce, a classe de overlay usada no componente não tem estilo definido, e cada item alterna entre estados com transições diferentes (200ms, 150ms, 700ms) — o resultado é o "engasgo" ao passar o mouse.

- Definir de fato o estado sobreposto: painel expande por cima do conteúdo, sem empurrar a área central (evita reflow do dashboard inteiro a cada hover).
- Uma única curva e duração de animação para largura, opacidade dos rótulos e ícones (transição curta com easing suave), aplicada de forma consistente ao header, itens e rodapé.
- Rótulos e contadores entram por opacidade em vez de aparecer/desaparecer no meio da animação de largura.
- Aumentar levemente o atraso de saída do hover e adicionar zona de tolerância para o menu não fechar quando o cursor passa entre ícone e rótulo.
- Card de faturamento deixa de ser montado/desmontado a cada hover; passa a ficar montado com transição de opacidade, eliminando o salto de layout.

## Detalhes técnicos

Arquivos: `src/pages/vendas/Produtos.tsx`, `src/components/products/ProductGridView.tsx` (convertido em lista/painel), `src/components/products/ProductListView.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/index.css`. Sem migrações, sem mudança de dados ou de regras de negócio.
