# Gerentes e Staff — isolamento temporal, permissões e comissões

## Objetivo
Construir um controle confiável em que cada seller tenha no máximo um gerente ativo, o gerente veja e opere somente sua carteira e somente a partir do início do vínculo, e toda comissão permaneça correta mesmo após transferências, reembolsos, chargebacks ou MED PIX.

Decisões confirmadas:
- Um seller terá apenas um gerente ativo por vez.
- O vínculo começa na aprovação da conta.
- O gerente anterior perde todo acesso operacional ao seller após a transferência e mantém somente seu próprio extrato histórico de comissão.
- O dono poderá marcar um gerente como padrão para novos sellers, desligar essa regra e escolher outro depois.
- Nenhuma aprovação financeira final será delegada; pedidos continuam dependendo do dono.

## Estado atual confirmado
- O vínculo atual registra apenas criação, sem encerramento; a troca pode deixar dois gerentes com acesso ao mesmo seller.
- O painel do gerente carrega até 200 transações sem filtro por período nem corte pela data do vínculo.
- A comissão e seus estornos resolvem o gerente vigente no momento do evento; uma troca entre venda e estorno pode cobrar o gerente errado.
- Não há gerente cadastrado nem vínculo ativo atualmente, portanto a mudança pode ser aplicada sem migrar carteiras existentes.
- O painel Staff não possui fluxo próprio coerente: contas employee podem autenticar, mas a rota de gerente aceita apenas manager; no painel administrativo ainda existem consultas globais liberadas a employee.
- Há permissões exibidas na interface sem cobertura completa e comprovada em todas as rotinas do servidor.

## 1. Modelo temporal e auditável de carteira
- Evoluir os vínculos para registrar início, fim, responsável pela criação/encerramento, motivo e estado.
- Impor no banco um único gerente ativo por seller, inclusive sob duas tentativas simultâneas.
- Criar operação única e transacional para atribuir, transferir ou remover gerente; fechar o vínculo anterior antes de abrir o novo.
- Proibir edição e exclusão direta do histórico de vínculos pelo navegador.
- Registrar cada atribuição, transferência, remoção e mudança de gerente padrão na auditoria do dono.
- Criar configuração exclusiva de “gerente padrão para novos sellers”; ativar um desativa o anterior de forma atômica.

## 2. Aprovação de seller vinculada ao gerente
- Centralizar a aprovação de conta em uma operação protegida do dono.
- Na aprovação, exibir um seletor de gerente com o padrão pré-selecionado; permitir que o dono escolha outro ou deixe explicitamente sem gerente.
- Gravar aprovação e vínculo no mesmo processo para impedir conta aprovada com atribuição parcial.
- O instante confirmado da aprovação será o início exato da carteira, visibilidade e comissão.
- Remover a associação financeira implícita baseada apenas em `approved_by`; comissão dependerá do vínculo temporal formal.

## 3. Visibilidade estritamente limitada
- Substituir leituras diretas e cargas amplas por consultas paginadas, protegidas e filtradas pela carteira ativa.
- O gerente verá somente dados dos sellers atualmente atribuídos e somente eventos criados após o início do vínculo: vendas, clientes, taxas, saques, reembolsos, chargebacks, MED PIX, notas e indicadores.
- Dados anteriores ao vínculo não entrarão em listas, totais, gráficos, busca, exportação ou contagens.
- Após transferência, o gerente anterior perderá imediatamente perfil, transações, notas e ações daquele seller.
- O gerente nunca poderá consultar volume total da plataforma nem chamar totalizadores administrativos diretamente.
- Revisar as regras de acesso de todas as tabelas e funções envolvidas; acesso negado deve falhar fechado, nunca aparecer como total zero saudável.

## 4. Comissão imutável por evento
- No crédito inicial, fixar gerente, percentual aplicado, seller, transação e data do vínculo no ledger.
- Reembolso, chargeback e MED PIX localizarão e reverterão exatamente o lançamento original, sem recalcular pelo gerente ou percentual atual.
- Transferências não alterarão comissões antigas e não retroagirão sobre vendas anteriores.
- Garantir idempotência para impedir crédito ou estorno duplicado e preservar saldo negativo quando um estorno ocorrer após pagamento de comissão.
- Manter alterações de percentual e exceções de comissão auditadas e efetivas apenas para eventos futuros.
- Separar no painel: volume da carteira no período, comissão gerada, estornos, comissão disponível e histórico; nunca exibir o volume global.

## 5. Permissões reais de gerente e staff
- Criar uma matriz única de permissões usada pela interface e pelas regras do servidor.
- Para cada permissão existente, definir claramente: consultar, solicitar, executar e decisão final.
- Gerente e staff somente acessarão sellers atribuídos; permissões não ampliam o escopo da carteira.
- Aprovação/recusa de KYC respeitará as permissões específicas e a operação versionada no banco; botões sem função real serão removidos ou conectados corretamente.
- Alteração de taxas exigirá vínculo ativo, permissão e piso individual definido pelo dono.
- Bloqueio por staff/gerente continuará limitado a saques para análise; somente o dono poderá liberar.
- Reembolsos, MED PIX, adquirentes e demais ações sensíveis continuarão como pedidos ao dono quando não houver poder final autorizado.
- Remover acessos globais herdados de employee e impedir acesso a páginas administrativas do dono.
- Criar entrada e painel próprios para Staff, com as mesmas garantias de escopo e somente as funções concedidas.

## 6. Painel do gerente
- Reestruturar o painel com filtros de Hoje, Ontem, 7 dias, 30 dias e período personalizado, sempre limitados ao início de cada vínculo.
- Mostrar sellers da carteira, vendas aprovadas, movimentado, ticket médio, reembolsos, chargebacks, MED PIX e comissão — somente da carteira e do período permitido.
- Adicionar lista paginada de sellers e transações, busca segura, estados de carregamento/vazio/falha e ficha operacional do seller.
- Exibir ações apenas quando a permissão correspondente estiver ativa; o servidor repetirá todas as validações.
- Usar o tema e os componentes semânticos da VENXPAY, com layout estável em computador, tablet e celular.

## 7. Administração de gerentes
- Na criação e edição, incluir permissões, piso de taxas, comissão e opção exclusiva “padrão para novos sellers”.
- Mostrar carteira atual, data de início, histórico de transferências e comissões sem expor credenciais.
- Permitir atribuir, transferir e remover sellers com justificativa e confirmação reforçada.
- Na aprovação de conta, permitir escolher o gerente responsável antes de confirmar.
- Corrigir a configuração de comissão para passar somente pela operação auditada, sem gravação direta pelo navegador.

## 8. Testes de segurança e funcionamento
- Criar contas temporárias controladas: dono, dois gerentes, um staff e sellers de teste; remover ou desativar os artefatos ao final.
- Testar diretamente as regras do banco e também os painéis autenticados.
- Casos obrigatórios:
  - gerente A não acessa seller de B;
  - vínculo novo não revela histórico anterior;
  - transferência remove imediatamente o acesso de A e libera B somente a partir do novo horário;
  - apenas um gerente fica ativo sob concorrência;
  - gerente padrão é aplicado na aprovação e pode ser substituído pelo dono;
  - desligar/trocar o padrão afeta apenas aprovações futuras;
  - venda anterior à transferência credita A; venda posterior credita B;
  - estorno, chargeback e MED revertem o lançamento original uma única vez;
  - gerente e staff não acessam totais globais, sellers alheios, exclusão de contas, saldo, aprovação final de saque ou liberação de bloqueio;
  - cada uma das permissões concedida e removida produz exatamente o efeito esperado;
  - taxas abaixo do piso, vínculo encerrado e chamadas diretas indevidas são rejeitados;
  - desktop, tablet e celular sem desalinhamento ou conteúdo oculto.
- Executar testes unitários, integração real das regras de acesso, funções protegidas, concorrência e Playwright.
- Rodar verificação de segurança do banco, erros de execução, build e regressões das áreas Staff/Admin relacionadas.

## Critérios de conclusão
- Nenhuma consulta de gerente/staff retorna dados globais ou de seller não atribuído.
- Nenhum dado anterior ao vínculo participa da visibilidade ou dos indicadores do novo gerente.
- Nenhuma transferência altera lançamentos históricos de comissão.
- Toda ação crítica possui validação no servidor, auditoria e teste negativo de acesso direto.
- As permissões do painel correspondem às permissões efetivas do servidor.
- O relatório final separará: validado automaticamente, validado ponta a ponta com contas temporárias e qualquer limitação externa ainda não verificável. Não será feita promessa absoluta de ausência futura de falhas sem evidência.

## Detalhes técnicos
- Manter implementações privilegiadas fora do esquema exposto e wrappers públicos com execução mínima.
- Usar locks transacionais, índice único parcial para gerente ativo e chaves idempotentes no ledger.
- Aplicar RLS e permissões explícitas em toda estrutura nova; nenhuma leitura anônima.
- Atualizar os tipos e consultas após a mudança de estrutura, mantendo paginação e limites explícitos.
- Não executar vendas, reembolsos, MED PIX, chargebacks, saques ou movimentações financeiras reais; os testes financeiros usarão registros controlados e isolados.
