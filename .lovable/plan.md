# Refinamento do fundo, sidebar e cards do Dashboard

## Objetivo
Deixar o shell visual contínuo e intencional: grade técnica na sidebar — inclusive quando expandida — e na faixa superior, enquanto a área principal do Dashboard recebe um fundo limpo, uniforme e sem cortes. Elevar todos os cards do Dashboard ao mesmo nível visual da aba Vendas, preservando dados, filtros e ações existentes.

## Implementação

### 1. Fundo único e sem emendas
- Consolidar as regras duplicadas de `.platform-shell` e remover a sobreposição específica criada dentro de `Dashboard.tsx`, mantendo uma única fonte de fundo no layout.
- Aplicar a grade técnica somente à sidebar e à faixa superior, do primeiro pixel até o fim dessas regiões.
- Garantir que a sidebar expandida mantenha o mesmo fundo quadriculado, sem ficar sólida ou transparente durante a animação.
- Criar uma superfície central contínua e responsiva para o conteúdo, sem recortes nas bordas, no topo ou ao longo da rolagem.

### 2. Sidebar expandida
- Manter o comportamento atual de pino e expansão por hover, corrigindo apenas a composição visual do fundo.
- Preservar a sobreposição sobre o conteúdo sem deslocar o Dashboard.
- Harmonizar borda divisória, estado recolhido e estado expandido para não haver troca perceptível de camada ou cor.

### 3. Todos os cards do Dashboard
Usar a aba Vendas como referência direta de acabamento: bordas finas, contraste controlado, numerais fortes, ícones fantasma discretos e hierarquia limpa.

- Refazer os quatro cards financeiros: Saldo, Recebido hoje, Bloqueio cautelar e Faturamento total.
- Refinar os quatro atalhos: Gerar PIX, Solicitar Saque, Transações e Credenciais API.
- Alinhar os painéis de Faturamento, Índices, Links de pagamentos e Últimas transações ao mesmo sistema visual.
- Harmonizar o bloco de onboarding com o restante da página para ele não parecer uma peça isolada.
- Manter o banner principal como destaque, sem transformar todos os módulos em cards decorativos iguais.
- Extrair/reaproveitar primitives visuais compartilhadas onde isso reduzir divergências entre Dashboard e Vendas, sem alterar regras financeiras ou consultas.

### 4. Responsividade e qualidade
- Verificar sidebar recolhida, hover expandido e fixado em desktop.
- Verificar Dashboard e cards em desktop, tablet e celular, incluindo textos longos, valores ocultos e estados vazios.
- Confirmar que não há sobreposição, corte horizontal, salto de largura ou fundo interrompido durante rolagem.
- Validar nomes acessíveis dos controles por ícone, foco por teclado e alvos de toque no mobile.
- Conferir build, erros de console e screenshots finais comparativos de Dashboard e Vendas.

## Arquivos principais previstos
- `src/index.css`
- `src/components/layout/DashboardLayout.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/hd/HDPage.tsx` ou um primitive visual equivalente, caso seja necessário compartilhar o acabamento dos cards

## Limites
- Nenhuma mudança em dados, cálculos financeiros, autenticação ou backend.
- Nenhuma alteração funcional na aba Vendas; ela será apenas a referência visual.
