# Código de verificação no cadastro + novo popup de verificação

## Parte 1 — Código de 4 números depois do cadastro

### Como fica para a pessoa
1. Ela preenche as etapas e clica em "Criar conta".
2. Na mesma tela aparece a etapa "Confirme seu e-mail": 4 caixas grandes para os números, o e-mail mascarado (h***@gmail.com) e o botão "Reenviar código" com contagem de 60s.
3. Ao digitar o 4º número, o código é conferido sozinho. Se estiver certo, ela entra direto no painel, sem digitar e-mail e senha de novo.
4. Se errar, as caixas tremem com a mensagem "Código incorreto. Restam X tentativas".
5. O campo aceita colar o código e o preenchimento automático do celular.

### Segurança
- O código vale 10 minutos e permite no máximo 5 tentativas. Depois disso é preciso pedir outro.
- No máximo 5 reenvios por hora por e-mail, além do limite por IP.
- O código é guardado embaralhado, nunca em texto puro, e cada código só pode ser usado uma vez.
- A conta só fica ativa depois do código certo. Quem tentar entrar antes recebe a tela do código de novo, com um novo envio.
- O login automático é feito no servidor depois da validação. A senha não fica guardada no navegador.

### Requisito obrigatório (depende de você)
Para mandar um e-mail próprio com um código de 4 números, é preciso conectar um domínio de e-mail (por exemplo, hotzfy.com.br). O e-mail padrão do sistema só manda link, ou código de 6 dígitos, e não permite mudar o layout. Ao aprovar, abro a configuração do domínio. Depois que você adicionar os registros DNS, os e-mails saem com a marca VENXPAY.

## Parte 2 — Novo popup de verificação de conta (documentos)
Reconstrução completa no estilo da marca (sólido, bordas finas, sem desfoque nem sombras pesadas):
- **Layout em duas colunas:** à esquerda, a lista das etapas (Frente, Verso, Selfie e, para CNPJ, Cartão CNPJ) com status de cada uma. À direita, a área de envio da etapa atual.
- **Área de envio:** permite arrastar e soltar, mostra uma prévia da foto antes de enviar e oferece "Trocar foto" e "Usar câmera" no celular.
- **Validações claras:** formato e tamanho, com mensagens específicas.
- **Barra de progresso** fina, contador "2 de 3" e dica contextual curta.
- **Tela final:** resumo com os documentos enviados e o prazo de análise.
- **"Fazer depois":** fecha e lembra a escolha na conta (não no navegador). Volta a aparecer após 3 dias se ainda faltar documento.
- **Celular:** abre como uma folha que sobe de baixo, em tela cheia, com botões grandes.
- O funcionamento atual continua igual: envio para a mesma pasta segura, a regra para CNPJ e a aprovação pela equipe.

## Detalhes técnicos
- Configuração de e-mail: `setup_email_infra` + `scaffold_transactional_email`, template `signup-code` com a marca.
- Migration: tabela `signup_verification_codes` (user_id, code_hash sha256+salt, expires_at, attempts, consumed_at, sent_count, created_at). RLS ativa e acesso só pelo servidor. Campo `kyc_popup_snoozed_until` em profiles.
- `secure-signup`: cria o usuário sem confirmar, gera o código (crypto), envia pelo `send-transactional-email` e retorna `{ requireCode: true }`.
- Nova função `verify-signup-code`: limita tentativas e taxa, confirma o e-mail (`email_confirm: true`), consome o código e emite a sessão com `signInWithPassword`, usando a senha enviada só nessa chamada via HTTPS e sem guardá-la. Retorna os tokens para `setSession`.
- Nova função `resend-signup-code`. O `gated-login` passa a responder `email_not_confirmed` e a UI abre a etapa do código.
- Componente `OtpCodeInput` com 4 caixas, `inputMode="numeric"` e `autocomplete="one-time-code"`.
- `KycOnboardingPopup` dividido em `KycStepList`, `KycUploadZone` e `KycDone`.
- Testes: código expirado, excesso de tentativas, código reutilizado e reenvio limitado.
