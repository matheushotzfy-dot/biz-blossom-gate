# Blindagem total da VENXPAY — auditoria linha a linha

Objetivo: revisar todo o código (29 páginas, 32 funções do servidor, 323 migrações do banco) e fechar qualquer caminho para: injetar saldo, sacar mais do que tem, criar vendas falsas, roubar chaves das adquirentes, usar chaves vazadas, extrair dados em massa (dump) ou alterar dados de outro seller.

Nada de vendas reais, usuários ou configurações de adquirentes será apagado ou alterado. Cada fase termina com um relatório de achados (Crítico / Importante / Info) antes da próxima.

## Fase 1 — Mapa de ameaças (somente leitura)
Inventário completo: cada tabela, função do banco, função do servidor, rota, formulário e integração. Para cada um: quem pode chamar, o que muda em dinheiro e qual é a validação atual. Resultado: mapa de risco priorizado entregue a você.

## Fase 2 — Dinheiro (prioridade máxima)
- Saldo nunca é gravado direto: só calculado a partir do livro-razão (ledger) imutável, somente por funções internas do servidor.
- Bloquear qualquer UPDATE/INSERT do navegador em saldos, transações, saques, taxas e splits (políticas + gatilhos de guarda).
- Saque atômico: trava de linha, checagem de saldo disponível na mesma operação, idempotência, limites diários, congelamento em disputa, sem corrida de cliques simultâneos (teste de 50 pedidos paralelos).
- Venda só vira "aprovada" via webhook da adquirente com assinatura válida + reconsulta direta à adquirente (nunca confiar no corpo recebido). Valor conferido contra o valor original.
- Reembolso e chargeback revertem saldo corretamente, sem saldo negativo explorável.
- Reconciliação diária automática: soma do ledger x adquirente, com alerta no admin se divergir.

## Fase 3 — Chaves e segredos
- Chaves das adquirentes somente no servidor, criptografadas; nunca retornadas por nenhuma consulta, log ou erro.
- Varredura do código do site por qualquer segredo exposto.
- Chaves de API dos sellers: armazenadas só como hash, rotação, revogação, escopo e limite por chave.
- Logs sanitizados (sem CPF completo, tokens, chaves).

## Fase 4 — Banco de dados
- Revisar as políticas de acesso de 100% das tabelas: cada seller só vê o que é dele.
- Revisar as ~55 funções com privilégio elevado: remover as que não precisam, restringir quem pode executar, fixar search_path.
- Arquivos: tornar privados os que não devem ser públicos (achados atuais em race-assets e afins).
- Impedir dump: paginação máxima, sem listagens públicas amplas, funções públicas retornando só o mínimo.

## Fase 5 — Funções do servidor (32)
Para cada uma: autenticação obrigatória (ou assinatura, em webhooks), validação rígida de entrada, limite de requisições, CORS restrito aos domínios oficiais, proteção contra repetição (replay), respostas de erro genéricas, timeouts.

## Fase 6 — Contas e acesso
- Admin/staff: papéis só na tabela de papéis, checados no servidor; personificação limitada e auditada.
- Proteção contra força bruta, senhas vazadas, bloqueio progressivo, sessões revogáveis.
- Ponto de atenção: o login admin hoje é só email/senha (a pedido). Vou recomendar reativar o segundo fator só para admin — você decide.

## Fase 7 — Site (navegador)
Sem HTML injetável, cabeçalhos de segurança (CSP, anti-clickjacking), validação de todos os formulários, dependências sem vulnerabilidades conhecidas, checkout e link de pagamento sem confiar em valores vindos do navegador.

## Fase 8 — Monitoramento e prova
- Alertas no admin: saque anômalo, muitos PIX em pouco tempo, divergência de saldo, tentativas de acesso negadas.
- Testes de ataque automatizados: tentar injetar saldo, sacar em dobro, forjar webhook, ler dados de outro seller, usar chave revogada — todos devem falhar.
- Relatório final com nota por área.

## Limite honesto
Nenhum sistema é "impossível" de atacar; o objetivo é fechar todos os caminhos conhecidos, garantir que dinheiro só se mova por regras do servidor e detectar qualquer anomalia rapidamente.

## Detalhes técnicos
- Migrações idempotentes, sem DELETE de dados reais; gatilhos BEFORE UPDATE bloqueando colunas financeiras para roles não service_role.
- Funções SECURITY DEFINER: REVOKE EXECUTE FROM anon/public, SET search_path = public.
- Webhooks: HMAC + timestamp (janela 5 min) + tabela de eventos processados (unique) + GET de confirmação na PodPay.
- Saque: SELECT ... FOR UPDATE no saldo, constraint CHECK saldo >= 0, idempotency_key unique.
- Execução em ordem 2 → 3 → 4 → 5 → 6 → 7 → 8, com scanner de segurança e linter após cada fase.
