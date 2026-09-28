# Remoção total das gateways e simplificação do editor de produtos

## Objetivo
Retirar completamente PodPay e VeoPag da VENXPAY, inclusive dados históricos vinculados, mantendo apenas uma estrutura genérica vazia para uma futura integração. Refinar a criação e edição de produtos no mesmo fluxo atual, com menos ruído e melhor hierarquia.

## Impacto confirmado
- Novos PIX, links de pagamento, estornos automáticos, consultas de status e saques por adquirente ficarão indisponíveis até uma nova gateway ser integrada.
- Transações, saques, assinaturas, eventos e registros financeiros vinculados às gateways atuais serão apagados; totais e relatórios serão recalculados sem esses dados.
- Usuários, produtos, cursos, configurações de produto e dados administrativos não ligados às gateways serão preservados.

## Remoção das gateways
- Bloquear imediatamente novas cobranças e desativar os provedores atuais.
- Remover os registros PodPay/VeoPag e limpar as atribuições de adquirente dos sellers, preservando as tabelas genéricas `acquirers` e `seller_acquirer_config` vazias.
- Apagar, em ordem segura, dados dependentes das transações dessas gateways: eventos, entregas, intents/ciclos, assinaturas, comissões, ledger, disputas, antecipações, saques e demais vínculos encontrados no banco.
- Desligar os agendamentos de polling e reconciliação específicos dos provedores.
- Retirar do servidor as funções PodPay/VeoPag, helpers compartilhados, webhooks, polling, refund, cashout e criação PIX dependente desses provedores.
- Remover referências a segredos PodPay/VeoPag e excluir as credenciais armazenadas no banco e no ambiente.
- Manter contratos genéricos de pagamento desacoplados de fornecedor, mas retornar uma indisponibilidade clara e segura enquanto não houver gateway configurada.

## Limpeza da interface
- Remover PodPay, VeoPag e nomes técnicos de telas seller, admin, checkout público, documentação, status, auditoria visual e textos auxiliares.
- Manter no admin uma área genérica de adquirentes vazia, pronta para receber outra integração no futuro.
- Desabilitar ações que exigem gateway com uma mensagem objetiva, sem botões que falham silenciosamente.
- Preservar integrações de marketing e entrega, como UTMify, Z-API e webhooks próprios, pois não são adquirentes financeiras.

## Criar e editar produto
- Manter o modelo atual de editor e suas funcionalidades, sem transformar em assistente de etapas nem remover configurações.
- Reduzir a sensação de excesso com hierarquia mais limpa: cabeçalho menor, navegação mais discreta, largura de leitura controlada e espaçamento consistente.
- Dar prioridade visual a nome, imagem, descrição, tipo, preço e cobrança; informações complementares continuam disponíveis, mas com menor peso visual.
- Agrupar campos relacionados em blocos abertos e simples, evitando cartões dentro de cartões, textos repetitivos e indicadores redundantes.
- Recolher apenas recursos opcionais extensos quando estiverem desativados, mantendo seu conteúdo imediatamente acessível ao ativar.
- Simplificar o progresso e a barra de salvamento para comunicar somente estado, pendências reais e ação principal.
- Preservar validações, persistência, vínculos, permissões e comportamento atual de criação/edição.

## Detalhes técnicos
- Executar a limpeza de dados em transação, respeitando chaves estrangeiras e recalculando agregados restantes.
- Usar uma nova migração para desativar rotinas e manter a estrutura genérica; migrações históricas não serão alteradas.
- Remover as funções publicadas somente após a limpeza do banco e dos chamadores do site.
- Separar o editor monolítico em componentes focados sem alterar os contratos de dados.
- Registrar no projeto que o processamento financeiro depende de um adaptador genérico e que nenhum provedor deve aparecer diretamente nas telas seller.

## Validação
- Confirmar que não resta ocorrência ativa de PodPay/VeoPag no código, nas funções publicadas, nos agendamentos, nos dados ou nas telas.
- Confirmar que não há transações, saques, assinaturas ou eventos órfãos depois da limpeza.
- Verificar que checkout, PIX, saque e estorno exibem indisponibilidade controlada em vez de erro.
- Testar criação e edição de produto em desktop e celular, incluindo salvamento, validações e recursos opcionais.
- Validar compilação, testes críticos, erros de execução e políticas de acesso antes da entrega.
