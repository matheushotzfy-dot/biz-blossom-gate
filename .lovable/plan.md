# Correção financeira, PIX, saques, taxas, calendário e blindagem

## Objetivo

Corrigir os números financeiros exibidos, remover integralmente as vendas simuladas, modernizar as experiências de Gerar PIX, saque automático, taxas e calendário, e revisar as superfícies críticas de seller, admin e páginas públicas sem enfraquecer os controles existentes.

## Diagnóstico confirmado

- Hoje, 10/09/2026 no fuso de São Paulo, a conta `admin@admin.com` possui **17.846 transações simuladas**.
- Destas, **14.235 estão aprovadas e somam R$ 495.849,79**. Esse é o valor indevido que aparece como faturamento, embora não existam vendas reais hoje.
- A função que alimenta o dashboard seller soma transações simuladas nos cards e no gráfico, enquanto o saldo contábil já ignora essas vendas. Isso explica a divergência entre faturamento e saldo.
- As visões financeiras do admin também incluem dados simulados nos totais.
- O Gerar PIX atual é um modal central sem vínculo espacial com o botão clicado; por isso não abre visualmente a partir do ícone.
- O backend está saudável no momento. Há, porém, consultas antigas de listagens e atualizações de perfil com custo elevado, além de 55 alertas de revisão para funções privilegiadas; eles serão avaliados individualmente, sem correção indiscriminada.

## Plano de implementação

### 1. Limpeza e fonte única dos números financeiros

- Apagar todas as transações marcadas como simuladas e somente os registros dependentes dessas transações, preservando integralmente vendas reais e usuários.
- Fazer a remoção em ordem segura, respeitando vínculos de eventos, disputas, entregas, afiliados e demais registros relacionados.
- Corrigir os agregados do seller e do admin para excluir permanentemente `is_simulated = true` de faturamento, conversão, gráficos, rankings, relatórios e totais financeiros.
- Padronizar os status considerados aprovados entre seller e admin (`approved`, `completed`, `paid`) e o fuso comercial `America/Sao_Paulo`.
- Corrigir o card mobile de faturamento para respeitar o período exibido, em vez de usar silenciosamente todo o histórico.
- Remover ou desativar o mecanismo de simulação restante para impedir nova mistura com produção.
- Verificar dashboard, Vendas, painel admin, extrato, saldo, reembolsos/MEDs, saques, depósitos e taxas com consultas independentes no banco.

### 2. Gerar PIX ancorado ao ícone

- No desktop, abrir a experiência diretamente a partir do botão/ícone Gerar PIX, com posição ancorada, colisão segura nas bordas e transição curta baseada em `transform` e `opacity`.
- No mobile, abrir uma tela inferior dedicada, dimensionada para teclado virtual, safe area e rolagem sem cortes.
- Refazer a interface em etapas claras: valor e pagador; revisão; PIX gerado; pagamento confirmado.
- Preservar autenticação, KYC, limite de ticket, idempotência, adquirente, taxas e polling atuais.
- Melhorar mensagens de erro, validação de CPF/CNPJ, estados de carregamento, cópia do código e confirmação em tempo real.
- Manter foco, navegação por teclado, leitura acessível e bloqueio contra envios duplicados.

### 3. Saque automático no mesmo padrão

- Refazer o bloco e a configuração de saque automático com a mesma linguagem visual do novo Gerar PIX: superfície sólida, bordas precisas, hierarquia financeira e sem gradientes decorativos.
- Organizar ativação, valor-alvo, presets até R$ 10 mil, seleção da chave PIX, resumo da regra e confirmação por senha.
- Preservar KYC, limites, reautenticação e função financeira protegida existentes.
- Garantir estados vazio, ativo, desativado, inválido, salvando e erro em desktop e mobile.

### 4. Página de taxas com identidade VENXPAY

- Reconstruir a apresentação sem alterar os cálculos: comparação direta por meio de pagamento, percentual + valor fixo, prazo de liberação e tarifa de saque.
- Exibir claramente quando a taxa é padrão ou personalizada, usando a mesma fonte de dados consumida pelas cobranças PIX.
- Usar composição editorial própria da VENXPAY, dados tabulares, superfícies sólidas e controles compactos; sem cards genéricos, gradientes ou decoração artificial.
- Validar a rota `/financeiro/taxas`, carregamento, valores padrão e overrides individuais do seller.

### 5. Calendário do dashboard

- Refazer o seletor mantendo uma única fonte de período para cards e gráfico.
- Desktop: painel ancorado ao controle, com presets compactos, mês legível e intervalo visual contínuo.
- Mobile: tela inferior com alvos de toque maiores, resumo fixo e safe area.
- Corrigir seleção de hoje, ontem, 7/15/30 dias, mês atual, intervalo personalizado, datas futuras e virada de fuso.
- Remover aparência genérica e alinhar tipografia, bordas, espaçamento e estados à identidade atual da plataforma.

### 6. Blindagem por camadas

- **Autenticação e rotas:** validar guards de seller, manager e admin contra as funções server-side, sessões, 2FA e tentativas de acesso direto.
- **Funções financeiras:** revisar PIX, checkout, saque, reembolso, ajustes, antecipação e impersonação quanto a ownership, role, idempotência, limites, reautenticação e auditoria.
- **Webhooks e integrações:** validar assinatura, anti-replay, idempotência, isolamento por seller, segredos e sanitização de logs.
- **Banco e permissões:** inventariar funções privilegiadas e políticas por tabela; corrigir apenas permissões realmente excessivas, preservando fluxos públicos necessários.
- **Dados sensíveis:** garantir mascaramento de CPF, PIX, banco, tokens e payloads em seller, admin, exportações e logs.
- **Abuso e desempenho:** revisar rate limiting dos endpoints críticos e eliminar listagens sem limite/prefetch de todas as transações.
- Registrar uma trilha de auditoria suficiente para ações financeiras e administrativas, incluindo ator, alvo, antes/depois, horário e contexto disponível.

## Detalhes técnicos

- Alterações de banco serão feitas por migração; a exclusão dos dados simulados será uma operação de dados separada e explícita.
- Não serão alteradas vendas reais, contas de usuários ou configurações de adquirentes.
- Componentes novos usarão os controles e tokens semânticos existentes, sem cores visuais hardcoded.
- A camada em tempo real invalidará as mesmas chaves usadas pelos agregados, evitando números antigos após uma venda, saque ou reembolso.
- A revisão de segurança será guiada por evidência: cada função privilegiada será classificada antes de qualquer alteração para evitar bloqueios ou abertura de acesso.

## Validação

- Comparar os totais do banco com seller e admin para: hoje, ontem, 7 dias, 30 dias e intervalo personalizado.
- Confirmar zero faturamento hoje quando não houver venda real e confirmar que uma nova venda real atualiza seller/admin sem recarregar.
- Testar Gerar PIX ponta a ponta, incluindo falha da adquirente, clique repetido, cópia, expiração e aprovação.
- Testar saque automático com e sem KYC, sem chave PIX, limites mínimo/máximo e reautenticação.
- Testar taxas padrão e personalizadas contra o valor efetivamente calculado na cobrança.
- Testar desktop e mobile com screenshots e interações reais.
- Executar testes direcionados de segurança, plataforma e validação, conferir erros de execução e validar o estado final da aplicação.

## Resultado esperado

- Nenhum dado de demonstração misturado à produção.
- Seller e admin exibem exatamente os mesmos fatos financeiros, respeitando período, status e fuso.
- Gerar PIX nasce do ícone no desktop e vira uma experiência própria no mobile.
- Saque automático, taxas e calendário passam a ter uma identidade VENXPAY consistente, precisa e não genérica.
- Fluxos críticos ficam protegidos por validação server-side e testados sem comprometer checkout público ou integrações existentes.
