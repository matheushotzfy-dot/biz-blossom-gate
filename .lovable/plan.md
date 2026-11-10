# Vemprapay Seller — reconstrução completa com identidade própria

Objetivo: o painel do seller deixa de parecer "template de IA" e passa a ter cara de app de banco grande (Mercado Pago, Inter, Nubank): identidade própria, leve, rápido, com gráficos e detalhes de produto real. Começamos só pelo seller; admin fica para depois.

## 1. O que sai (o "padrão de IA")
- Sidebar lateral comum com lista de ícones.
- Grade de 4 cartões de KPI iguais com ícone no canto.
- Gráficos de área genéricos com tooltip padrão.
- Cartões brancos todos iguais, mesmo espaçamento, mesmo peso.

## 2. Nova identidade "Vemprapay"
- **Assinatura visual:** a forma do "V-check" vira elemento de marca — recorte diagonal no cartão de saldo, marcador de item ativo, indicadores de status.
- **Tipografia de banco:** números grandes em fonte de exibição com centavos menores e alinhados ("R$ 12.480,90"), rótulos pequenos em caixa alta espaçada.
- **Cor com hierarquia:** verde só para dinheiro e ação principal; navy profundo na barra superior; superfícies em 3 níveis (fundo, cartão, cartão elevado) em vez de tudo branco igual.
- **Textura de fintech:** padrão sutil de linhas-guia (tipo nota de dinheiro / guilloché) apenas no cartão de saldo.

## 3. Nova navegação (fim da sidebar comum)
- **Barra superior navy fixa** com logo, busca rápida (Ctrl+K: buscar venda, produto, cliente, ir para página), saldo compacto, notificações e perfil.
- **Navegação por abas horizontais** logo abaixo (Início, Vendas, Financeiro, Produtos, Marketing, Integrações), com submenu em painel ao passar o mouse — como internet banking.
- **Celular:** barra inferior com botão central "Pix/Cobrar" destacado (padrão Nubank/Mercado Pago).

## 4. Início (dashboard) refeito
- **Cartão de saldo protagonista:** disponível, a liberar e bloqueado em uma linha do tempo de liberação ("R$ 1.200 libera amanhã"), botão Sacar, ocultar valores.
- **Atalhos em carrossel** com ícones desenhados para a marca (não ícones genéricos).
- **Gráfico principal próprio:** barras de vendas por dia com linha de meta, comparação com período anterior, cursor que mostra o dia inteiro; troca de período fluida.
- **Pulso do dia:** mini-gráfico por horário + "última venda há 3 min".
- **Funil de conversão** (visitas no checkout → PIX gerado → pago) em barras horizontais.
- **Métodos de pagamento** em barra segmentada (PIX x cartão) com taxa de aprovação.
- **Extrato estilo banco:** agrupado por dia ("Hoje", "Ontem"), ícone por tipo, valor colorido por entrada/saída, clique abre comprovante lateral.
- **Pendências inteligentes:** KYC, chave PIX, produto em análise — cartões de ação apenas quando existem.

## 5. Sensação de leveza ("parece PHP")
- Navegação instantânea: dados das páginas principais pré-carregados ao passar o mouse nas abas.
- Esqueletos com o formato exato do conteúdo (sem "pulos" na tela).
- Transições curtas (150–200ms) só de opacidade/posição; nada de animações pesadas.
- Números com contagem suave apenas na primeira carga.

## 6. Demais páginas do seller (mesma linguagem, uma por vez)
1. Vendas: filtros em chips, tabela densa estilo extrato, painel lateral de detalhe.
2. Financeiro/Saques: cartão de saldo, linha do tempo de liberações, fluxo de saque em etapas com comprovante.
3. Produtos: grade com capa, status e vendas do mês; editor em etapas.
4. Cupons, Links de pagamento, Integrações, Perfil/Identidade, Suporte, Premiações.

## 7. Como vou apresentar
- Faço primeiro a **nova estrutura (barra superior + abas + celular) e o Início completo**, tiro prints desktop e celular e te mostro antes de seguir para as outras páginas.
- Nenhum valor inventado aparece como real: sem vendas, os gráficos mostram estado vazio elegante.

## Detalhes técnicos
- Novo layout `SellerShell` (topbar + tabs + bottom nav) substitui `DashboardLayout`/`AppSidebar` apenas nas rotas do seller; admin intacto.
- Tokens novos no bloco final de `src/index.css` (superfícies em 3 níveis, navy da topbar, padrão guilloché em SVG); sem cores fixas em componentes.
- Gráficos com Recharts customizado (tooltip, eixos e cursores próprios) — dados das mesmas consultas atuais, sem mudar backend.
- Command palette com o `cmdk` já existente; prefetch com React Query no hover das abas.
- Componentes até ~150 linhas, verificação por Playwright (desktop 1280 e celular 390) e testes existentes rodando.
