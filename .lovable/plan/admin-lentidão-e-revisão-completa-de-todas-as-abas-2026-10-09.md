# Admin: lentidão e revisão completa de todas as abas

## O que já foi verificado
- O banco está saudável (memória 35%, conexões 23/120), então a lentidão não é falta de capacidade.
- A consulta mais pesada do sistema é a **contagem de notificações não lidas**: 11 mil chamadas, média de 0,7 s e picos de 8 s. Ela roda no topo de todas as telas, inclusive no admin, e não tem índice para "não lidas por usuário".
- Outros pontos caros: atualização do IP do usuário a cada acesso (média de 116 ms, picos de 7 s), lista de transações do seller sem filtro de simuladas (média de 0,9 s) e 810 mil atualizações de webhooks em fila.
- As 38 abas do admin já carregam sob demanda, mas cada aba ainda dispara as próprias consultas e várias ficam acima de 700 linhas (Sellers tem 1.430).

## Etapa 1: velocidade (maior impacto primeiro)
1. Índice parcial para notificações não lidas por usuário, contagem estimada no sininho e intervalo de atualização maior. Limpeza agendada das notificações antigas já lidas.
2. IP do usuário: gravar só quando mudar, no máximo uma vez a cada 30 min.
3. Webhooks: revisar a fila para não reprocessar entregas mortas indefinidamente (limite de tentativas e pausa progressiva).
4. Medir o tempo de abertura de cada aba (Playwright, logado como admin), registrar as mais lentas e otimizar uma por uma: consultas agregadas, paginação, cache curto e sem consultas duplicadas na troca de aba.

## Etapa 2: revisão aba por aba (código e funções)
Para cada uma das 38 abas e das rotinas de banco que ela chama:
- Teste em navegador: abre sem erro, filtros, paginação, estado vazio e estado de falha.
- Leitura de código: botões sem ação, chamadas para funções removidas, tipos forçados, consultas sem limite, permissões checadas só na tela.
- Banco: rotinas sem checagem de admin, políticas de acesso sobrando, índices faltando.
- Correção dos achados em lotes por área: Visão geral/Comando/Analytics; Sellers/Inativos/Top; Financeiro (transações, saques, disputas, reembolsos, auditoria, adquirentes); Equipe (staff, gerentes, comissões, pedidos); Produtos/Cupons/Links/Cursos/Assinaturas; Suporte/Notificações/Premiações/Corridas/Metas; Configurações/Ferramentas/Logs/Risco.
- Ao fim de cada lote: testes, verificação do banco e um relatório curto do que foi encontrado e corrigido.

## Limites honestos
- Sem vendas reais nem conta de gerente de teste, os fluxos financeiros ponta a ponta continuam sem validação completa. Nenhuma movimentação de dinheiro real será executada.
- É um trabalho grande: vou entregar em lotes, informando o progresso a cada um.

## Detalhes técnicos
- Migration: `CREATE INDEX ... ON notifications(user_id) WHERE is_read = false`; trocar `count: exact` por `planned`/`head`; job de limpeza via pg_cron.
- `track-user-ip` / atualização de `last_ip`: comparar antes de gravar e aplicar throttle.
- `webhook_deliveries`: máximo de tentativas, backoff e status final `dead`.
- Benchmark: script Playwright em /tmp que mede o tempo até a aba ficar pronta, além de `slow_queries` antes e depois.
