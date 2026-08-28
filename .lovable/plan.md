# Correção ponta a ponta do financeiro e painel admin

## Objetivo
Garantir que vendas, saldos, taxas, saques, reembolsos, MEDs/chargebacks e ajustes financeiros usem a mesma fonte de verdade, apareçam corretamente no admin e atualizem sem recarregar a página.

## Problemas confirmados
- O painel admin carrega no máximo 5.000 transações do período; hoje há mais de 10 mil. KPIs, listas e gráficos calculados desse recorte ficam incompletos.
- Partes do frontend ainda tratam somente `completed`, embora o backend aceite `approved`, `paid` e `completed`; isso oculta vendas e valores.
- O saldo da lista de sellers é recalculado por uma fórmula paralela, diferente do ledger oficial, e inclui vendas simuladas; pode divergir do saldo real.
- O fluxo de reembolso atual altera o status antes da resposta da adquirente, não registra corretamente o valor parcial e ainda cria um ajuste de saldo adicional. Isso pode debitar duas vezes e deixar lançamentos incorretos quando a adquirente falha.
- MEDs, reembolsos e chargebacks dependem de transações presentes no recorte carregado para exibir detalhes, mesmo quando a disputa existe fora do período.
- O admin atualiza por intervalo de 60 segundos e só a visão geral possui assinatura parcial; as demais abas financeiras podem permanecer desatualizadas.
- Consultas de histórico sem paginação e filtros por status estritos estão causando lentidão e dados incompletos.

## Implementação
1. **Unificar regras financeiras no banco**
   - Centralizar os estados pagos em `approved`, `paid` e `completed`.
   - Tornar o ledger a fonte canônica para saldo do seller e saldo exibido no admin.
   - Corrigir reembolso total/parcial com lançamento idempotente único, valor líquido proporcional e reversão segura de splits.
   - Evitar qualquer alteração financeira antes da confirmação da adquirente e impedir débito duplicado por `balance_adjustments`.
   - Preservar vendas simuladas apenas nos indicadores, nunca no saldo sacável.

2. **Corrigir MEDs, chargebacks e reembolsos**
   - Validar vínculo seller/transação, valor máximo e estado elegível.
   - Garantir bloqueio, liberação ou perda no ledger exatamente uma vez.
   - Exibir os detalhes da transação vinculada mesmo fora do filtro atual.
   - Harmonizar status e valores entre transação, disputa, timeline e indicadores.

3. **Reestruturar dados do painel admin**
   - Separar agregados do dashboard das listas: KPIs e gráficos serão calculados no servidor sobre todo o período, sem limite de 5.000.
   - Implementar listagem paginada e filtrada no servidor para transações, saques e disputas, mantendo busca por ID, seller, cliente, CPF/e-mail e status.
   - Fazer a aba de sellers consumir o saldo canônico do ledger.
   - Manter pendências operacionais visíveis mesmo quando estão fora do filtro de data.

4. **Atualização em tempo real e desempenho**
   - Assinar alterações de transações, saques, disputas, ledger e ajustes no admin com invalidação agrupada.
   - Adicionar reconciliação por foco e polling leve como fallback.
   - Remover prefetch sem limite e consultas redundantes de transações.
   - Adicionar/ajustar índices necessários para seller, status e data após conferir os planos das consultas.

5. **Corrigir telas seller relacionadas**
   - Substituir comparações isoladas com `completed` pelo helper canônico onde afetam faturamento, saques, retenções, produtos, premiações e conteúdo.
   - Fazer barras/resumos móveis consumirem agregados do servidor em vez dos primeiros 1.000 registros.
   - Invalidar saldo e extrato imediatamente após saque, reembolso, MED ou ajuste.

## Validação
- Conferir invariantes no banco: venda real paga tem um único crédito; simulação não gera saldo; reembolso/chargeback/MED não duplica débito; saque pendente reserva uma vez e rejeição devolve uma vez.
- Comparar contagens e valores do admin com consultas diretas para hoje, 7 dias e período amplo.
- Testar transição pendente → paga, reembolso parcial/total, MED ganho/perdido, saque aprovado/rejeitado e ajuste manual.
- Testar atualização ao vivo em seller e admin, incluindo fallback após perda de canal.
- Executar testes das funções afetadas, linter, build e verificação visual desktop/mobile das abas financeiras.

## Detalhes técnicos
- Mudanças estruturais e funções serão aplicadas por migration aprovada; correções de código seguirão depois da atualização automática dos tipos.
- As 52 advertências existentes de funções `SECURITY DEFINER` serão revisadas somente quando relacionadas aos fluxos alterados; não será ampliado acesso para resolver visibilidade.
- Nenhum dado financeiro existente será apagado. Correções históricas serão precedidas por consultas de reconciliação e limitadas a inconsistências comprovadas.
