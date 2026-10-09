# Revisão completa do painel admin: aba por aba, linha por linha

## Como cada aba será revisada (mesmo roteiro para todas)
1. **Medição:** tempo até a aba ficar pronta, logado como admin no navegador de teste, antes e depois das correções.
2. **Leitura do código, linha por linha:** botões sem ação, chamadas para funções que não existem mais, erros engolidos sem aviso, consultas sem limite, consultas repetidas, permissões checadas só na tela, textos e números inconsistentes.
3. **Banco:** cada rotina que a aba chama precisa checar quem é admin, ter limite de período e de linhas, usar índices e não ter regras de acesso sobrando.
4. **Teste de todas as funções no navegador:** abrir, filtros, busca, paginação, abrir ficha, exportar, estado vazio e estado de falha (simulando queda da consulta). Ações que movem dinheiro (reembolso, saque, ajuste, MED) são testadas até a confirmação, **sem executar**.
5. **Correção, testes e relatório** do lote: o que foi encontrado, o que foi corrigido e o que ficou pendente.

## Lotes (nesta ordem)
1. **Visão geral, Centro de comando, Analytics, Métricas financeiras**
2. **Sellers, Top sellers, Inativos, Top produtos, Risco/Compliance, Abuso**
3. **Financeiro:** Transações, Saques, Disputas/MED, Reembolsos, Auditoria financeira, Adquirentes, Entregas do checkout
4. **Equipe:** Staff/Funcionários, Gerentes, Comissões, Pedidos da equipe
5. **Catálogo e vendas:** Produtos, Cupons, Links de pagamento, Cursos, Assinaturas, Afiliados, Indicações
6. **Relacionamento:** Suporte, Notificações, Premiações, Corridas, Metas
7. **Sistema:** Configurações, Ferramentas, Logs de erro, Auditoria geral, e a navegação e carregamento do próprio painel

Cada lote é entregue completo antes do próximo, com uma mensagem de progresso.

## Regras durante a revisão
- Nenhuma movimentação financeira real e nenhuma conta apagada.
- Sem mudar visual ou regras de negócio que você já aprovou. Só correções, desempenho e pontas soltas.
- Quando aparecer uma decisão de negócio (por exemplo, um número que pode ter duas leituras), eu pergunto antes de mudar.

## Limites honestos
- Sem vendas reais, os totais financeiros são conferidos pela lógica e por dados de teste controlados, não por conciliação real.
- Sem conta de gerente/funcionário de teste, o painel da equipe é validado pelas regras do banco. Se você quiser, eu crio uma conta de teste e removo depois.

## Detalhes técnicos
- Script Playwright em /tmp/browser/admin-audit com sessão admin, mede `domcontentloaded` até o fim do skeleton e captura console/rede por aba.
- `slow_queries` e `EXPLAIN ANALYZE` por RPC; índices via migration.
- Checagem com `rg` de `.rpc(`/`.from(` por aba contra as funções e tabelas existentes; `supabase--linter` ao fim de cada lote.
- Testes vitest para regras corrigidas; build e suíte completa por lote.
