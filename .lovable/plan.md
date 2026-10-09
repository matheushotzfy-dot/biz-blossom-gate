# Restaurar ações reais no painel da equipe (gerente/funcionário)

## Problema confirmado
- O painel `/gerentes/dashboard` hoje só mostra números e lista de sellers. Permissões "Aprovar KYC", "Recusar KYC", "Alterar taxas dentro do piso" e "Editar observações" podem ser concedidas, mas não há nenhum botão para usá-las.
- O aviso "visualização de transações não concedida" aparece sempre, porque a tela procura `transactions.view`, enquanto a permissão concedida se chama `view_transactions`.
- Não existe hoje no banco uma rotina de KYC para a equipe (a antiga `manager_update_seller_kyc` não existe); só as rotinas do dono.

## O que será feito
1. **Ficha do seller no painel da equipe**: ao clicar num seller da carteira, abre uma ficha lateral fixa com as ações liberadas por permissão (botões ocultos quando a permissão não existe).
2. **Taxas**: formulário de % / fixa / saque usando `set_staff_seller_fees` (já valida vínculo ativo e piso individual no servidor). Mostra o piso configurado e a mensagem de erro do servidor se ficar abaixo.
3. **Observações**: listar e adicionar notas em `seller_notes` (RLS já restringe a vínculo ativo e período).
4. **KYC**: nova rotina protegida `staff_review_kyc(seller, aprovar/recusar, motivo)` em `app_private` com wrapper público, exigindo permissão `approve_kyc`/`reject_kyc`, vínculo ativo, seller em análise, motivo obrigatório na recusa e registro em auditoria. Fila "KYC pendente" na ficha.
5. **Transações**: corrigir a checagem para `view_transactions` e ligar a lista paginada `get_staff_portfolio_transactions`.

## Detalhes técnicos
- Componentes novos em `src/features/staff/` (ficha, taxas, notas, KYC) para manter `ManagerDashboard.tsx` pequeno.
- Migration: `app_private.staff_review_kyc` SECURITY DEFINER + `public` SECURITY INVOKER, EXECUTE só para `authenticated`; reutiliza a lógica de status do `admin_approve_kyc`/`admin_reject_kyc` sem permitir alterar outros campos.
- Testes: mapeamento de permissão → ação visível (incluindo `view_transactions`) em `src/test/staff-policy.test.ts`.
- Validação ponta a ponta autenticada continua dependente de uma conta de gerente de teste.
