# Correções: listas de opções, login lento, chave PIX, Dados pessoais e Suporte

## 1. Listas de opções invisíveis (cadastro e produtos)
Afeta "De onde veio", "Segmento", "Faturamento" no cadastro e "Garantia", "Visibilidade" etc. no produto. Todas usam a mesma lista suspensa do sistema, então a correção é única e vale para o site inteiro.
- Primeiro reproduzir no navegador (tema branco e escuro) para confirmar a causa exata.
- Suspeitas a confirmar: a área interna da lista está travada na altura do campo (só cabe ~1 item e o resto é cortado) e o recorte de pintura do popup esconde o conteúdo.
- Corrigir a lista para sempre mostrar todas as opções com rolagem, contraste legível nos dois temas e acima de janelas/modais.

## 2. Login e cadastro lentos
- Medir o tempo real de cada etapa (função de login, criação de sessão, carregamento do painel).
- Hoje o login passa por uma função do servidor e depois o painel carrega muitos dados de uma vez; reduzir o que bloqueia a entrada (carregar perfil/painel em paralelo, mostrar o painel já com esqueletos), e manter as proteções contra tentativas.
- No cadastro, mostrar progresso claro e evitar esperas duplicadas.

## 3. Chave PIX aleatória mudando de tipo
- Quando o tipo "Aleatória" estiver selecionado, nunca mais trocar automaticamente para celular/CPF.
- Detecção automática só quando nenhum tipo foi escolhido, e chaves no formato UUID (com hífens) sempre reconhecidas como aleatórias antes de qualquer outra regra.
- Colar ou digitar a chave mantém o formato original (minúsculas, hífens), sem máscara de telefone.
- Testes cobrindo colar UUID, digitar parcialmente, e chaves de 32+ caracteres.

## 4. Conta > Dados pessoais
- Os campos são somente leitura (vêm do cadastro/KYC), então remover o botão "Salvar alterações" dessa seção e mostrar uma nota discreta: "Para alterar seus dados, fale com o suporte".

## 5. Aba de Suporte redesenhada
- Visual no padrão do site (bordas finas, tipografia Sora/Manrope, cores do tema, claro e escuro).
- Topo com resumo: chamados abertos, aguardando você, resolvidos, tempo médio de resposta.
- Lista de chamados à esquerda com busca, filtros por status e prioridade e indicador de não lidas; conversa à direita estilo chat, com anexos, "digitando...", status e histórico.
- Novo chamado em janela guiada (categoria, assunto, mensagem, anexo) com perguntas frequentes sugeridas.
- Celular: lista e conversa em telas separadas, sem zoom ao digitar.
- Sem mudar regras de acesso — cada seller continua vendo só os próprios chamados.

## Verificação
- Capturas no navegador em computador, tablet e celular de cada item, tema claro e escuro.
- Testes automatizados para a chave PIX; build e tipagem sem erros.

## Detalhes técnicos
- Lista: `src/components/ui/select.tsx` (Viewport `h-[var(--radix-select-trigger-height)]` com `overflow-hidden`; `.overlay-surface` com `contain: paint` em `src/index.css`).
- Login: `src/pages/Auth.tsx` (`gated-login` + `setSession`), `useAuth`/`useProfile`, carregamento do Dashboard.
- PIX: `detectPixKeyType`/`formatPixKey` em `src/lib/financial-input.ts`, `DadosBancarios.tsx`, `src/test/validation.test.ts`.
- Perfil: `src/pages/Perfil.tsx` (botão na linha ~432).
- Suporte: `src/pages/Suporte.tsx` dividido em componentes menores em `src/components/support/`.
