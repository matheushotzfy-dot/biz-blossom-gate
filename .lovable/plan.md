# Admin completo — disputas reais, saldo dos sellers e ficha 360

Trabalho longo, dividido em fases. Cada fase termina testada antes da próxima. Pagamentos reais seguem dependentes de uma adquirente (que ainda não existe), mas tudo que é interno (saldo, bloqueio, estorno no livro-caixa, auditoria) passa a funcionar de verdade.

## Fase 1 — Motor financeiro único (base de tudo)
- Uma única função no servidor para mexer no saldo: todo crédito ou débito entra no livro-caixa com motivo, autor, vínculo (venda, disputa, saque, ajuste) e chave anti-duplicidade.
- Saldo do seller separado em: disponível, pendente (em liberação), reservado (garantia), bloqueado (disputas) e negativo (devendo).
- Ajuste manual de saldo (crédito ou débito) com motivo obrigatório; acima de um valor configurável exige aprovação de um segundo admin.
- Reserva de garantia por seller (% e dias) e liberação automática diária.
- Relatório de integridade: recalcula o saldo pelo livro-caixa e aponta qualquer divergência.

## Fase 2 — Reembolso, MED e Chargeback de verdade
Uma única central de "Disputas" com filtro por tipo (substitui as 4 abas separadas).

```text
Aberta -> Em análise -> (aguardando defesa do seller) -> Ganha pelo seller | Perdida
```
- **Abrir disputa:** bloqueia na hora o valor da venda no saldo do seller (se faltar saldo, fica negativo e trava saques).
- **Seller se defende:** envia provas e texto pelo painel dele, com prazo; recebe aviso.
- **Ganha pelo seller:** desbloqueia o valor.
- **Perdida:** debita a venda + taxa de disputa configurável, marca a venda como reembolsada/contestada, remove o acesso do comprador e estorna comissões de afiliado, coprodutor e equipe.
- **Reembolso:** pedido do seller ou do admin, total ou parcial, com os mesmos estornos.
- Tudo atômico (ou faz tudo, ou nada) e registrado na auditoria e na linha do tempo da venda.
- Alerta automático quando o índice de chargeback/MED do seller passa de 1%.

## Fase 3 — Saques
- Aprovar, recusar ou "marcar como pago" com comprovante; recusa devolve o saldo na hora.
- Aprovação e pagamento em lote.
- Travas: seller negativo, com disputa aberta acima do saldo ou congelado não consegue sacar.

## Fase 4 — Ficha 360 do seller
Página completa por seller, com abas:
- Resumo: saldos (os 5 tipos), faturamento, ticket médio, taxa de aprovação, índice de disputa, nota de risco.
- Vendas, Saques, Disputas, Livro-caixa (extrato completo), Produtos e links, KYC e documentos, Taxas e limites, Métodos de pagamento, Notas internas, Linha do tempo de tudo que aconteceu na conta.
- Ações num lugar só: congelar, banir, ajustar saldo, reserva, limites, taxas, reenviar KYC, entrar como seller.
- Nota de risco automática (chargeback, reembolsos, idade da conta, velocidade de vendas).

## Fase 5 — Operação do dia a dia
- Exportar planilha em Transações, Saques, Sellers, Disputas e Auditoria (com filtros).
- Ações em lote: KYC, saques, bloqueio de sellers e links.
- Busca geral do admin por e-mail, CPF, número da venda ou link.
- Relatório de receita da plataforma (taxas ganhas por dia/mês) e relatório mensal para contador.
- Cupons e assinaturas: filtros e ações (pausar, cancelar).
- Permissões da equipe aba por aba.

## Fase 6 — Comunicação e saúde
- Avisos para o seller dentro do painel e por e-mail (KYC, saque, disputa, bloqueio), com público escolhido.
- Painel de saúde: falhas de webhook, erros por hora, tarefas agendadas com falha.
- Menu enxuto: juntar Top/Inativos, Premiações/Corridas/Metas e as abas de disputa.

## Fase 7 — Validação final
- Testes de cada fluxo de dinheiro: disputa ganha/perdida, reembolso parcial, saldo negativo, saque bloqueado, ajuste com dupla aprovação, tentativas duplicadas e simultâneas.
- Teste de isolamento: seller nunca vê nem altera dados de outro.
- Scanner de segurança limpo e revisão visual em computador e celular.

## Detalhes técnicos
- Tabelas existentes aproveitadas: `disputes`, `financial_ledger`, `balance_adjustments`, `withdrawals`.
- Novas colunas/tabelas: `disputes` (deadline, seller_response, fee_amount, refund_amount, partial), `seller_reserves`, `balance_adjustment_approvals`, `dispute_events`, `seller_risk_scores`, `refunds`.
- RPCs SECURITY DEFINER em `app_private` com wrappers `public` (padrão do AGENTS.md): `admin_open_dispute`, `admin_resolve_dispute`, `admin_refund_transaction`, `admin_adjust_balance`, `approve_balance_adjustment`, `admin_mark_withdrawal_paid`, `get_seller_360`, `get_seller_balance_breakdown`, `release_reserves` (cron).
- Todas com `FOR UPDATE` no saldo, idempotency_key, checagem `has_role`, gravação de auditoria na mesma transação.
- Front: `SellerDetail360` dividido em subcomponentes, `DisputesCenter` único, React Query com paginação server-side.
