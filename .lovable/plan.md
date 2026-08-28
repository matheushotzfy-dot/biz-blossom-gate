# Correção ponta a ponta: vendas, saldo e realtime

## Objetivo
Corrigir o fluxo de confirmação de pagamentos reais até o saldo disponível e tornar o dashboard autoatualizável, com reconciliação mesmo quando o canal em tempo real perder eventos. Dados simulados continuarão claramente isolados e não poderão ser sacados.

## Implementação
1. **Normalizar o status financeiro**
   - Atualizar o gatilho do ledger para reconhecer `approved`, `paid` e `completed` como estados pagos canônicos.
   - Manter idempotência por transação para impedir créditos duplicados quando uma venda muda entre estados pagos.
   - Ajustar reembolso e chargeback para funcionar independentemente de qual estado pago anterior foi usado pela adquirente.
   - Preservar a regra de segurança: transações com `is_simulated=true` não geram saldo real.

2. **Corrigir e controlar a simulação ao vivo**
   - Manter as vendas simuladas visíveis nas métricas e atividades do dashboard.
   - Fazer a simulação transitar entre pendente e aprovada em execuções distintas, criando atualização visual real ao longo do tempo.
   - Não criar lançamentos no ledger nem saldo sacável para dados fictícios.
   - Validar cron, volume, ticket médio e identificação do lote de demonstração.

3. **Fortalecer a atualização em tempo real**
   - Agrupar eventos em rajada para evitar dezenas de consultas simultâneas.
   - Tratar erro/timeout do canal e reconciliar automaticamente os caches.
   - Assinar também alterações de disputas para atualizar MEDs/reembolsos.
   - Adicionar polling leve e refetch ao recuperar foco como rede de segurança, sem depender de F5.

4. **Performance e consistência do dashboard**
   - Preservar agregação no banco para o lote de 100 mil vendas e limitar a lista recente.
   - Garantir que cards, gráfico, atividade, saldo e disputas usem chaves de cache compatíveis.
   - Evitar tempestade de consultas durante lotes ou callbacks em sequência.

5. **Validação ponta a ponta**
   - Testar transição pendente → paga → ledger → saldo para uma transação real controlada e reversível.
   - Confirmar que uma transação simulada aparece no dashboard, mas não altera saldo.
   - Verificar eventos ao vivo no navegador, fallback de reconciliação, erros de console e estado do build.
   - Rodar a verificação de segurança das funções alteradas e registrar quaisquer achados não relacionados sem ampliar o escopo silenciosamente.

## Detalhes técnicos
- Mudanças de banco serão aplicadas por migração aprovada, com `SECURITY DEFINER`, `search_path`, grants/revokes e idempotência revisados.
- Nenhum saldo fictício será disponibilizado para saque.
- O lote já existente permanece marcado por `is_simulated`/`metadata.batch`, permitindo limpeza posterior sem atingir vendas reais.
