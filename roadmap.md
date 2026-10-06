# Admin total — controle manual, métricas, adquirentes e ficha do seller
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
- [ ] Ficha completa do seller (todas as abas, saques com recusa e motivo, premiações com status/rastreio)
- [ ] Blindagem de formulários do seller
- [ ] Saques: comprovante e lote; exportação; busca geral; relatórios; e-mails; saúde; menu enxuto; permissões aba por aba
- [ ] Testes com venda real (bloqueado: sem adquirente e sem vendas)
- [x] Base segura do checkout: validação compartilhada, CEP cancelável e entrega auditável/idempotente
- [ ] Ativar PIX/cartão com tokenização e webhook assinado (bloqueado: adquirente e documentação ainda não definidos)
- [x] Tema light por padrão salvo na conta; checkout continua com tema próprio
- [x] Chaves PIX completas para o próprio seller e revelação admin auditada
- [x] Logos de integrações com superfície legível, dimensões estáveis e fallback
- [ ] Tornar permissões de staff/gerente efetivas em todas as rotinas antigas; concessão de permissões já restrita ao dono
- [x] Migrar segredos de integrações para armazenamento criptografado e leitura mascarada no navegador
- [ ] Paginar cargas globais e históricos restantes do admin
