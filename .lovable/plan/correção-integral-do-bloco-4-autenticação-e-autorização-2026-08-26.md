# Correção integral do Bloco 4 — autenticação e autorização

## Objetivo
Fechar os riscos críticos de autenticação sem interromper login, painel administrativo, cadastro, recuperação de senha, saques ou gestão de dados bancários.

## Alterações
1. **2FA obrigatório no painel administrativo**
   - Manter a validação inicial de e-mail e senha no backend.
   - Após credenciais válidas e confirmação da role no banco, enviar código de uso único por e-mail e devolver apenas um identificador temporário — nunca a sessão final.
   - No verificador, validar código, expiração, limite de tentativas, identidade e role novamente antes de liberar a sessão.
   - Remover tokens de acesso/refresh armazenados na tabela de desafios e invalidar desafios anteriores.

2. **Step-up obrigatório para movimentações financeiras sensíveis**
   - Criar uma função backend única e autenticada para cadastrar/remover chave PIX, cadastrar/remover conta bancária e solicitar saque PIX/crypto.
   - Exigir senha atual em cada confirmação sensível; validar o JWT e derivar o proprietário exclusivamente do usuário autenticado.
   - Validar todos os payloads no servidor, aplicar limites de tamanho/formato e ignorar qualquer `user_id` enviado pelo cliente.
   - Migrar as telas para o novo fluxo de confirmação, com modal de senha e mensagens genéricas.

3. **Bloqueio de bypass direto no banco**
   - Remover policies que permitem ao seller inserir/remover diretamente chaves, contas e saques.
   - Preservar leitura do próprio usuário e operações administrativas explicitamente autorizadas.
   - Manter as validações financeiras existentes (saldo, taxas, limites, kill switch e serialização) no banco como segunda barreira.

4. **Recuperação de senha sem enumeração**
   - Sempre exibir a mesma resposta após solicitar recuperação, exista ou não a conta.
   - Não expor erros internos do provedor de autenticação nessa etapa.
   - Preservar código temporário, expiração e uso único fornecidos pelo backend de autenticação.

5. **Impersonação administrativa limitada**
   - Emitir sessão de impersonação com validade operacional curta no cliente, registrar início e encerramento e encerrar automaticamente ao expirar.
   - Revalidar admin e alvo no backend; proibir auto-impersonação e impersonação de admin.
   - Remover o refresh token do canal entre abas para impedir renovação indefinida; a sessão temporária não poderá ultrapassar a janela definida.

## Validação
- Testar login admin: senha inválida, role inválida, OTP inválido, expirado, repetido e válido.
- Testar cada ação financeira sem autenticação, sem senha, com senha errada e com senha correta.
- Confirmar que `user_id` alternativo enviado pelo cliente nunca é aplicado.
- Confirmar que inserts diretos nas tabelas sensíveis são bloqueados para seller.
- Testar recuperação com e-mail existente e inexistente, verificando resposta indistinguível.
- Testar início e expiração da impersonação separadamente.
- Rodar testes frontend/Edge Functions, linter e scanner de segurança.

## Detalhes técnicos
- A alteração de policies será aplicada por migration no Lovable Cloud.
- As funções validarão o bearer token com Auth antes de qualquer operação privilegiada.
- Senhas e tokens nunca serão gravados em logs; desafios serão single-use e rate-limited.
- A sessão SPA normal continua usando o mecanismo oficial do cliente; mover JWT para cookie `httpOnly` exigiria uma arquitetura SSR, indisponível neste app Vite. A mitigação aplicável aqui será CSP, ausência de HTML inseguro e redução de tokens temporários.
