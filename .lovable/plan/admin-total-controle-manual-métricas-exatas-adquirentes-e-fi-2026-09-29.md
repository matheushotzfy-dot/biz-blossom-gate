# Admin total — controle manual, métricas exatas, adquirentes e ficha completa do seller

Princípio: nada que mexa em dinheiro de verdade acontece sozinho. Tudo começa manual e só vira automático se o dono ligar um interruptor específico.

## Fase 0 — Auditoria antes de aplicar
- Conferir no banco e no código tudo o que já existe (reembolsos, MED, adquirentes, saques, premiações, taxas) e listar divergências reais antes de mudar qualquer coisa.
- Nada é dado como "faltando" sem essa checagem.

## Fase 1 — Modo manual e fila de aprovação
- Interruptor geral "Aprovação manual" (ligado por padrão) para: reembolsos, MED, chargebacks, saques, entrada automática da adquirente.
- Reembolso pedido pelo seller ou suporte: desconta do saldo do seller na hora e cai numa aba **Pendentes de aprovação**. O dono marca "Devolução efetivada" (com comprovante/ID opcional) ou "Não efetivada" (devolve o saldo ao seller com motivo).
- Aviso da adquirente sobre MED: só entra como "pendente de confirmação"; congela a venda, mas a decisão (estornar do seller ou liberar) é sempre do dono.
- Tudo registrado na auditoria financeira com responsável, horário, motivo e saldo antes/depois.

## Fase 2 — Métricas financeiras sem divergência
- Painel de receita por período (hoje, 7d, 30d, personalizado): volume total, aprovado, líquido dos sellers.
- Separação completa: taxa da plataforma (% e fixa), taxa da adquirente, taxa de saque, por método (Pix, cartão, boleto), MED, reembolsos, chargebacks.
- Lucro real da plataforma = taxas cobradas − custo da adquirente.
- Números vindos de uma única fonte no servidor (livro-caixa), com relatório de conciliação que aponta qualquer diferença entre vendas, livro-caixa e saldos.

## Fase 3 — Transações organizadas
- Separação clara em abas: Vendas, Reembolsos, MED, Chargebacks, Saques, Pendentes de aprovação.
- Filtros: seller, adquirente, método, status, período, ID da venda, código Pix, e-mail/CPF do comprador.
- Detalhe da venda com comprador, IP, adquirente usada, taxas quebradas e linha do tempo.

## Fase 4 — Adquirentes
- Adquirente padrão + backup (fallback) em ordem.
- Adquirente por seller, com histórico de trocas (a antiga continua marcada nas vendas feitas nela).
- Cada venda grava a adquirente usada; filtros por adquirente só mostram vendas dela.
- Conversão geral e por adquirente.

## Fase 5 — Ficha completa do seller
Abas: Resumo, Vendas, Saques, Reembolsos/MED/Chargebacks, Livro-caixa, Taxas pagas, Adquirentes (atual e histórico), Chaves Pix e contas, KYC e documentos, IPs e acessos, Premiações, Notas internas, Linha do tempo.
- Resumo: faturamento, vendas por dia, ticket médio, conversão, taxas pagas por tipo (Pix, cartão, fixa, %, saque), quantidade de saques.
- Saques: ver chave Pix e valor, aprovar, recusar com motivo (saldo volta na hora), marcar pago com comprovante.
- Premiações: ver pedidos e mudar status (solicitada, em preparo, enviada, a caminho, entregue) com código de rastreio.

## Fase 6 — Blindagem da conta do seller
- Revisar validação de todos os formulários do seller (cadastro, KYC, contas bancárias, chaves Pix, produtos, links, saques) no navegador e no servidor.
- Garantir que o seller só vê e altera os próprios dados; ações financeiras só pelo servidor.

## Fase 7 — Testes finais
- Reembolso pendente efetivado/não efetivado, MED ganho/perdido, saque recusado, troca de adquirente, filtros por adquirente, conciliação sem diferença, isolamento entre sellers, visual em computador e celular.

## Limitação
Sem adquirente conectada, dinheiro não sai de fato; o sistema registra e o dono confirma manualmente.

## Detalhes técnicos
- Tabela `platform_settings`: flags `manual_refunds`, `manual_med`, `manual_withdrawals`, `acquirer_auto_intake` (default manual).
- `refund_requests` (status pending_confirmation/confirmed/reverted, proof, decided_by) com RPCs `app_private` + wrappers `public`, `FOR UPDATE` no saldo, idempotência e reauth para decisões.
- `acquirer-med-webhook` passa a criar disputa em estado pendente de confirmação quando `acquirer_auto_intake` estiver desligado.
- `transactions.acquirer_id` obrigatório para novas vendas; `seller_acquirer_history` para trocas; ordem de fallback em `acquirers.priority`.
- RPC `get_platform_revenue_breakdown(_from,_to,_acquirer)` e `get_reconciliation_report` baseados no `financial_ledger`.
- `reward_claims`: status e rastreio editáveis só pelo admin, com auditoria.
- Front: ficha do seller dividida em subcomponentes em `src/features/admin-finance/`, React Query, paginação server-side.
