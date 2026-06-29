Vou corrigir exatamente os pontos citados, sem trocar a estrutura inteira das telas.

1. Dashboard e hover do Fluxo de Vendas
- Restaurar o comportamento visual do hover no gráfico/Fluxo de Vendas, principalmente o tooltip onde aparece o valor.
- Remover o aspecto básico atual e aplicar tooltip mais premium: compacto, nítido, sem blur pesado, borda fina, valor bem destacado e animação suave.
- Melhorar o hover geral dos painéis sem voltar a barrinha transparente bugada no topo.

2. Cards principais do Dashboard
- Redesenhar com mais impacto os 4 cards: Ticket Médio, Pedidos Pagos, Saldo Pendente e Faturamento Total.
- Adicionar contorno/acento azul claro na lateral esquerda dos cards para melhorar visibilidade no dark e no light mode.
- Deixar hover mais liso: leve elevação, borda azul, ícone mais vivo e microinterações sem bagunçar layout.
- Ajustar também o card principal de Faturamento do Dia e o botão Gerar Pix com melhoria leve e consistente.

3. Conversão PIX / Conversão Geral / Vendas
- Criar uma regra única para considerar transação aprovada: completed e approved.
- Aplicar a mesma regra no Dashboard, Conversão Geral, aba Vendas e Funil de Vendas.
- Assim os percentuais deixam de divergir por cálculo diferente entre telas.

4. Menu dos 3 pontos em Produtos
- Melhorar bastante o dropdown: visual mais nítido, ações mais separadas, hover mais perceptível, ícones com fundo/acento azul e melhor contraste no light mode.
- Manter as ações existentes, só refinar layout e sensação premium.

5. Financeiro: seleção de tipo de conta e tipo de chave Pix
- Melhorar os selects de Tipo de conta e Tipo de chave Pix usando o componente global de Select.
- Mais contraste nas opções, lateral/acento azul claro, item selecionado mais visível, menu mais limpo e menor.
- Corrigir duplicidade visual no SelectContent, que hoje tem dois botões de scroll para cima.

6. Estilo global sem estragar layout
- Ajustar utilitários globais de cards e hover para ficarem mais nítidos e fluidos em Dashboard/Vendas/Financeiro.
- Sem glassmorphism pesado, sem sombras exageradas e sem adicionar a barra transparente bugada.

7. Validação
- Verificar a tela do Dashboard na preview com Playwright, incluindo hover no gráfico e aparência dos cards.
- Checar se não há erro visual óbvio nos selects e no menu de produtos.