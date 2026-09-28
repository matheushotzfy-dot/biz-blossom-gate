# Corrigir todos os achados da auditoria + contador de Produtos

## Contador errado de Produtos (confirmado)
O número no menu conta também os produtos apagados, e a lista de Produtos não conta. Além disso, o número só é carregado uma vez e não muda quando você cria ou apaga um produto.
- O menu passa a contar só os produtos não apagados, igual à lista.
- O número se atualiza sozinho ao criar, duplicar ou apagar.

## Graves
1. Checkout WhatsApp: mostrar o preço real (hoje ele aparece 100 vezes menor).
2. Página "Obrigado": mostrar valor, produto e nome do comprador por um caminho seguro, que devolve só o mínimo e só daquela compra.
3. Botão "Testar integração" em Apps: passa a funcionar para o seller, testando só as integrações dele.
4. Antecipação: o botão faz o pedido de verdade, e o valor mostrado vem do servidor.
5. Aba Suporte liberada para funcionário que tem permissão de suporte.
6. Entregas de webhook: a lista abre rápido, sem estourar o tempo.

## Importantes
7. Admin: paginação real ("anterior/próxima" e total) em Saques, Sellers, Auditoria, Adquirentes e Avisos. O painel geral avisa quando algum dado foi cortado.
8. Registro no histórico de auditoria para corrida/prêmios, limites de gerente, contas da equipe, cupons e metas.
9. Mensagem de erro visível em Adquirentes, Configurações e Auditoria.
10. Cursos, Indicações e Assinaturas no admin: sai o "em construção". Cada aba passa a mostrar a lista real (somente leitura), com filtro.
11. Nova aba "Links de Pagamento" no admin: lista global, pausar/bloquear com motivo obrigatório, e histórico.
12. Taxas do seller: aviso claro se a taxa personalizada falhar ao carregar, com botão para tentar de novo.
13. Checkout e link de pagamento aceitam pedidos só dos sites da plataforma.
14. Tempo limite de 15s ao falar com a adquirente no checkout e no link de pagamento.
15. O nome da adquirente não vai mais para o navegador nas respostas do checkout, do link e do Gerar Pix.
16. A função de gerenciar equipe devolve mensagens de erro genéricas.
17. Cálculo de taxa unificado num único lugar compartilhado pelas funções.
18. Reais x centavos: formatador único e a documentação da API explicando a diferença.

## Menores
19. Formatação de dinheiro única em todas as telas.
20. Aviso de erro em Premiações e Corrida; carregamento em Cupons.
21. Versão em cartões no celular para Controle de Gastos, Saques Crypto e Notas Fiscais.
22. Cores fixas trocadas pelas cores do tema no editor de produto, construtor de checkout, construtor de curso e área de membros.
23. Confirmações de apagar com a janela da plataforma, no lugar da janelinha do navegador.
24. O painel do admin recarrega com intervalo mínimo, não a cada evento.
25. A Corrida ganha um endereço próprio.
26. Limpeza de código duplicado e antigo.

## Fora do escopo
Vendas reais, usuários e configurações de adquirentes não serão alterados. O login do admin continua só com email e senha.

## Verificação
Checagem de tipos e compilação, testes no banco com conta de seller e de funcionário, e conferência na tela (desktop e celular) com a sua conta: Produtos, Checkout WhatsApp, Obrigado, Apps, Antecipação e as abas do admin.

## Detalhes técnicos
- Menu: `.is("deleted_at", null)` e invalidação ou evento após mutações de produtos.
- Obrigado: RPC SECURITY DEFINER `get_thank_you_summary(tx_id)` que devolve campos mínimos e mascara o email.
- apps-dispatcher: aceitar JWT do usuário no modo teste, limitado a integrações do próprio usuário.
- Antecipação: chamar `request_anticipation` e `get_seller_anticipation_summary`.
- `EMPLOYEE_ALLOWED_TABS` passa a incluir support quando houver a permissão.
- Webhook: índice na coluna de dono e política/consulta sem função por linha.
- `.range()` com contagem exata; `logAdminAction` nas abas citadas.
- CORS por allowlist (`_shared/security.ts`), AbortController, `_shared/fees.ts` e `formatCurrency` único.
