# Admin total — controle manual, métricas, adquirentes e ficha do seller
- [x] Staff: criação com 20 permissões permitidas, configuração atômica auditada de comissão/pisos individuais, vínculo de sellers, bloqueio separado de saques e liberação só pelo dono; exclusão removida e banimento de seller restrito ao dono. 42 testes passaram; formulário e rejeições autenticadas de permissão perigosa, piso inválido e exclusão verificados; build OK.
- [ ] Staff: validar criação/persistência e isolamento ponta a ponta com funcionário/gerente (bloqueado: nenhuma conta staff/gerente existente; exige conta de teste autorizada). Permissões em rotinas antigas permanecem na tarefa específica abaixo; não afirmar que todas as 20 opções já habilitam fluxos completos.
- [x] Gerentes: vínculo temporal exclusivo, transferência auditada, gerente padrão, aprovação com atribuição, carteira paginada por período, comissões presas ao crédito original e bloqueios de ex-gerente aplicados no banco; linter limpo, 17 testes e build OK.
- [ ] Gerentes: validar login, transferência entre dois gerentes e extrato histórico ponta a ponta com contas controladas (bloqueado: não existe conta manager no banco e criar identidades sem autorização adicionaria usuários reais).
- [x] Inativos: direção Lista precisa aplicada, ficha lateral estável, atividade e histórico separados, consulta admin-only paginada, filtros de dias/busca/ordenação e CSV seguro. 25 testes aprovados; busca vazia, ficha, exportação e recuperação de falha verificadas em computador/tablet/celular sem erros de execução ou movimentações financeiras. Conciliação com vendas e paginação multipágina real dependem de dados.
- [x] Top Sellers: ranking paginado com vendas/clientes/taxas/custos/MED/chargebacks/reembolsos, ficha e CSV da página filtrada; Hoje/Ontem/7d/30d/1 ano e período personalizado, busca, ordenação e recuperação de falhas verificados. 22 testes aprovados; sem vendas reais para conciliação ponta a ponta e sem movimentações financeiras.
- [x] Sellers: lista paginada com ranking e filtros por período/vendas/MED/chargeback/reembolsos, ficha estável e navegação nas onze opções verificadas; opções da reserva visíveis, confirmação financeira e recuperação de falha testadas, sem movimentar dinheiro. 18 testes aprovados e sem erros de navegação; operações reais e históricos com vendas dependem de autorização/dados.
- [x] Analytics: agregados por período, atividade diária de sellers/clientes/cadastros, riscos, pendências atuais e lista paginada por seller; busca, ordenação, filtro de vendas, ficha, período de um ano e recuperação de falha verificados. 60 testes aprovados; sem vendas reais para validação financeira de ponta a ponta.

- [x] Centro de comando: agregados exatos, busca validada, oito atalhos, período, atualização e recuperação de falha verificados; 102 testes aprovados. Reduzidas consultas recorrentes, adicionados índices e corrigida chamada autenticada dentro do listener. Registros históricos preservados: ausência de reprodução atual não comprova correção de todas as causas; pagamentos reais continuam sem adquirente configurado.

- [x] Dashboard admin: totais financeiros consistentes, MED/chargeback separados, cadastros/KYC, filtros longos e personalizados, gráficos diários e por hora utilizáveis; testes de modelo, calendário, atalhos e troca rápida verificados. Lucro contábil completo depende de despesas/impostos registrados e validação com vendas reais.
- [x] Ampliar e refinar suporte: ocupa toda a área disponível, controles enxutos e tipografia legível; verificado em 1183×680 e celular, com novo chamado, navegação e 3 testes aprovados.

- [x] Motor de saldo, disputas reais, central de disputas, visão 360, auditoria financeira, IA de risco
- [x] Reembolso (seller/suporte) e MED PIX com congelamento exato
- [x] Modo manual (padrão): reembolso desconta do seller na hora e cai em "Pendentes de aprovação" (efetivada / não efetivada devolve saldo)
- [x] Interruptores de aprovação manual (só dono, com senha); MED da adquirente só gera alerta até você ligar
- [ ] Métricas financeiras separadas (taxa %, fixa, adquirente, saque, por método, MED, reembolso, chargeback) + conciliação
- [ ] Transações em abas + filtros (adquirente, código Pix, CPF, IP)
- [ ] Adquirentes: padrão + fallback, por seller, histórico de trocas, conversão por adquirente
- [ ] Ficha do seller: validação financeira ponta a ponta de recusa de saques, disputas e premiações com históricos reais (bloqueado: autorização para mutações e dados reais; navegação das onze abas já validada).
- [ ] Blindagem de formulários do seller
- [ ] Saques: comprovante e lote; exportação; busca geral; relatórios; e-mails; saúde; menu enxuto; permissões aba por aba
- [ ] Testes com venda real (bloqueado: sem adquirente e sem vendas)
- [x] Base segura do checkout: validação compartilhada, CEP cancelável e entrega auditável/idempotente
- [ ] Ativar PIX/cartão com tokenização e webhook assinado (bloqueado: adquirente e documentação ainda não definidos)
- [x] Tema light por padrão salvo na conta; checkout continua com tema próprio
- [x] Chaves PIX completas para o próprio seller e revelação admin auditada
- [x] Logos de integrações com superfície legível, dimensões estáveis e fallback
- [ ] Tornar permissões de staff/gerente efetivas nas rotinas antigas fora de carteira, taxas, notas, saques e transações; estes fluxos críticos já estão temporalmente protegidos.
- [x] Migrar segredos de integrações para armazenamento criptografado e leitura mascarada no navegador
- [ ] Paginar cargas globais e históricos restantes do admin

- [ ] Revisão aba por aba do admin (Etapa 2 do plano) — em lotes, a fazer

- [x] Novo popup de verificação de documentos (KYC)
- [ ] Código de 4 números no cadastro com login automático — aguardando o domínio de e-mail ser conectado
