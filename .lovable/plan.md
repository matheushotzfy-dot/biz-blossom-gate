# Checkout público seguro e preparado para produção

## Objetivo
Reconstruir o checkout de produto com melhor experiência em celular, tablet e computador; validações completas; busca de CEP; seleção clara entre PIX e cartão; entrega segura na área de membros; e uma base de pagamentos pronta para receber a futura adquirente sem simular aprovação ou saldo.

## Estado confirmado
- O checkout público está visível, mas o envio está deliberadamente bloqueado: o botão está desativado e não existe processador ativo de PIX/cartão.
- Não há adquirente cadastrada, configuração de seller ou venda real no banco. Portanto, não é possível ativar cobrança, tokenização de cartão ou teste financeiro real agora.
- CPF/CNPJ possuem máscara, mas a validação existente não é usada no envio; confirmação de e-mail, telefone, validade do cartão e dupla submissão também estão incompletos.
- A busca ViaCEP existe, porém não tem cancelamento de resposta antiga, mensagem junto ao campo nem recuperação refinada.
- A confirmação pública consulta somente o status da transação, o que limita exposição de dados.
- O saldo possui ledger e chaves de idempotência, mas o caminho de criação/confirmação da cobrança foi removido.
- A entrega atual depende de localizar uma conta pelo e-mail após o pagamento; quando não encontra, falha silenciosamente. Não existe e-mail transacional de acesso.
- Há zero adquirentes, zero configurações ativas por seller e zero transações para uma prova com dinheiro real.

## 1. Reconstruir o formulário e o layout
- Separar a página monolítica em blocos pequenos: produto/resumo, identificação, endereço, método, cartão, PIX pendente e estados finais.
- Usar os temas configuráveis do produto sem misturar cores fixas que quebram o modo escuro.
- Reorganizar a página em fluxo vertical no celular e resumo estável no desktop, sem campos comprimidos, sobreposição ou rolagem horizontal.
- Manter fonte mínima de 16px nos campos para impedir zoom automático no iPhone.
- Melhorar PIX/cartão com seletor acessível, estado selecionado inequívoco, teclado, foco e áreas de toque adequadas.
- Remover alegações técnicas enganosas como “SSL 256-bit” e manter apenas mensagens verificáveis de segurança.
- Preservar zoom do navegador, redução de movimento e contraste nos três temas.

## 2. Máscaras, validação e CEP
- Centralizar em Zod as regras de nome, e-mail normalizado, confirmação de e-mail, CPF/CNPJ, telefone brasileiro, CEP e endereço.
- Reutilizar o validador fiscal compartilhado, eliminando a cópia local que hoje pode divergir.
- Aplicar máscaras sem atrapalhar colar, apagar, seleção de texto, autofill ou teclado móvel.
- Mostrar erros curtos junto ao campo, ligar rótulos corretamente e focar o primeiro erro no envio.
- Buscar CEP ao completar oito dígitos, cancelar consulta anterior, limpar endereço obsoleto, tratar CEP inexistente/offline e permitir preenchimento manual.
- Validar cartão somente no cliente como apoio de UX: Luhn, validade futura, nome e CVV. Número completo e CVV nunca serão armazenados nem enviados ao banco da VENXPAY.

## 3. Contrato seguro de pagamento, sem adquirente falsa
- Criar uma interface única de processador para que a futura adquirente implemente PIX e tokenização incorporada sem alterar as regras financeiras centrais.
- Manter o checkout em modo indisponível enquanto nenhum processador estiver configurado; não criar venda, QR Code, aprovação ou saldo fictício.
- Quando houver adquirente, o navegador enviará apenas dados normalizados, IDs de itens, chave de idempotência e token de cartão emitido pelos campos seguros da própria adquirente.
- O servidor recalculará produto ativo, seller, métodos permitidos, cupom, bumps, parcelas, taxa e total. Nenhum valor financeiro ou seller vindo do navegador será confiado.
- Fixar o seller a partir do dono do produto e gravar a adquirente realmente usada na própria transação.
- Usar uma única sessão idempotente por tentativa, trava contra duplo clique, limite por IP/sessão e resposta reaproveitável para retries.
- Falhar fechado se não houver adquirente ativa, método permitido, token válido ou configuração completa.

## 4. Confirmação, saldo e antifraude
- Criar a máquina de estados única: criada → aguardando pagamento/processando → paga ou falha/expirada; reembolso/MED permanecem nos fluxos financeiros já separados.
- Aceitar aprovação somente por webhook autenticado da futura adquirente, com assinatura, janela anti-replay, ID externo único e consulta canônica quando o provedor permitir.
- Exigir coincidência de moeda, valor em centavos, transação, produto e adquirente antes de aprovar.
- Remover qualquer correlação heurística por e-mail+valor; sem ID externo exato, encaminhar para conciliação manual.
- Atualizar transação, ledger, taxas, splits e fila de entrega na mesma operação idempotente, com travas de concorrência por seller.
- Garantir que repetição e concorrência de webhook produzam uma aprovação, um crédito e uma entrega.
- Expirar cobranças pendentes por rotina do servidor, preservando pagamento tardio comprovado pela adquirente para análise/reconciliação.
- Registrar tentativas recusadas e divergências sem armazenar cartão, CVV ou dados secretos.

## 5. Entrega pela área de membros
- Vincular a compra ao e-mail normalizado e manter uma identidade de comprador explícita quando houver conta.
- Após pagamento confirmado, conceder acesso apenas aos cursos/produtos realmente comprados e aos bumps validados do mesmo seller.
- Se o comprador ainda não tiver conta, criar uma entrega pendente auditável e liberar quando ele concluir o acesso pelo mesmo e-mail; nunca conceder silenciosamente a outra conta.
- Registrar sucesso, falha, tentativas e motivo por transação, com reprocessamento seguro pelo admin.
- Preparar e-mail transacional com link de acesso e retry. A ativação dependerá da escolha/configuração do serviço de e-mail.
- Revogar ou ajustar acesso somente pelos estados financeiros autorizados de reembolso/chargeback.

## 6. Observabilidade e operação
- Exibir ao admin: cobrança sem confirmação, pagamento confirmado sem ledger, ledger sem entrega, entrega pendente/falha e divergência de valor/adquirente.
- Criar reconciliação por período e adquirente, com IDs externos, valores e estados — sem revelar dados de cartão.
- Registrar toda mudança financeira com responsável, origem, horário e correlação da transação.
- Manter a marca pública como VENXPAY; nome técnico da adquirente não aparece para o comprador.

## 7. Testes e validação
- Unitários: CPF/CNPJ, telefone, e-mail, CEP, cartão, dinheiro em centavos, cupom, bumps e máquina de estados.
- Integração: produto/seller correto, método bloqueado, dupla submissão, idempotência, valor adulterado, cupom concorrente e expiração.
- Segurança: RLS, chamadas anônimas, webhook sem assinatura/replay, seller adulterado, valor divergente, token inválido e tentativa de liberar acesso sem pagamento.
- Contabilidade: crédito único, taxas e splits fechando com o total, reversões sem duplicação e concorrência por seller.
- Entrega: conta existente, conta inexistente, e-mail normalizado, bump de outro seller bloqueado e retry sem acesso duplicado.
- Navegador: Chrome/Safari/Firefox; 360px, 390px, tablet e desktop; teclado, autofill, colar/apagar máscaras, zoom, CEP, tema claro/escuro e conexão instável.
- Após conectar uma adquirente: executar sandbox de PIX e cartão, webhook repetido/fora de ordem, recusa, expiração e conciliação. Só depois realizar uma venda real pequena e conferir o extrato da adquirente contra transação, taxas, ledger, saldo e acesso.

## Ordem de execução
1. Formulário, validações, CEP, acessibilidade e layout responsivo.
2. Contratos internos, estados, idempotência e proteção do saldo, mantendo pagamentos bloqueados.
3. Entrega auditável na área de membros e painel de falhas/reprocesso.
4. Testes automatizados e testes visuais sem cobrança.
5. Quando você abrir conta em uma adquirente: implementar o adaptador, campos tokenizados e webhook conforme a documentação real.
6. Sandbox completo e, por último, teste real de baixo valor com conciliação manual.

## Limite honesto desta etapa
Sem uma adquirente e suas credenciais/documentação, não existe tokenização incorporada, QR PIX válido, confirmação bancária ou teste financeiro real. Esta execução deixará toda a base, interface, validações, entrega e proteções prontas, mas manterá a cobrança desativada até a integração real existir.

## Critérios de aceite
- Formulário correto, acessível e sem quebra nos quatro tamanhos-alvo.
- CEP, CPF/CNPJ, e-mail e telefone com máscara e validação confiáveis.
- PIX/cartão claramente selecionáveis, mas sem criar pagamento falso quando não há adquirente.
- Nenhuma aprovação nasce do navegador; somente confirmação autenticada pode gerar saldo e entrega.
- Seller, produto, total, taxas e adquirente são sempre resolvidos e recalculados no servidor.
- Repetição ou concorrência não duplica venda, saldo, split ou acesso.
- Compra paga concede acesso correto na área de membros; falhas ficam visíveis e reprocessáveis.
- Nenhum número completo de cartão ou CVV é armazenado.
