# Projeto de execução — Saques, vendas, cupons, integrações, perfil e checkout

## Objetivo
Corrigir os fluxos solicitados sem alterar regras financeiras no escuro: primeiro consolidar a experiência visual, depois fechar dados/exportação e, por fim, corrigir produtos e checkout com validação de segurança ponta a ponta.

## 1. Saques, contas bancárias e chaves PIX
- Subir o resumo “valor, taxa e líquido” no diálogo de saque, removendo o espaçamento artificial e mantendo valor e impacto financeiro visíveis juntos.
- Padronizar agência, conta, dígito, CPF/CNPJ e telefone com máscaras brasileiras, `inputMode`, limites e mensagens por campo.
- Normalizar os valores antes de enviá-los; manter a validação equivalente no servidor para impedir bypass do navegador.
- Detectar automaticamente CPF, CNPJ, e-mail, telefone e chave aleatória conforme a digitação, sem impedir correção manual quando o valor ainda estiver incompleto ou ambíguo.
- Unificar cartões, ícones, rótulos e valores mascarados das chaves no cadastro, seletor de saque e saque automático.
- Preservar reautenticação, KYC, limites, idempotência e validação atômica de saldo; adicionar testes para tentativa de saque acima do disponível e payload manipulado.

## 2. Exportação completa de vendas
- Transformar “Exportar” em uma janela ampla com filtros de período, status, produto, cliente, e-mail e busca textual.
- Aplicar exatamente os mesmos filtros à consulta e ao arquivo, percorrendo todas as páginas do vendedor em lotes — não apenas as 25 linhas visíveis.
- Oferecer XLSX e CSV com colunas úteis, datas e moeda brasileiras, nome de arquivo previsível, progresso e cancelamento/erro claros.
- Neutralizar fórmulas em CSV/XLSX (`=`, `+`, `-`, `@`) e manter isolamento por seller/RLS.
- Cobrir exportação vazia, mais de 1.000 registros, combinação de filtros e caracteres perigosos.

## 3. Cupons
- Ampliar a criação de cupom e reorganizar o conteúdo em uma única área rolável com cabeçalho e ações fixos, evitando o formato estreito.
- Padronizar Todos/Ativos/Pausados/Expirados no mesmo seletor acessível usado nas demais listas, com contagens e busca combinável.
- Corrigir a tela administrativa para oferecer os mesmos filtros; hoje ela calcula ativos/expirados, mas não permite filtrá-los.
- Separar cabeçalho/KPIs da rolagem da tabela no detalhe administrativo e validar criar, editar, pausar, excluir, limites, expiração e aplicação no checkout.

## 4. Integrações e janelas do seller
- Aplicar o padrão largo e limpo às janelas de Apps: cerca de 660–680 px no desktop, largura segura no mobile, cabeçalho/rodapé fixos e somente o corpo rolável.
- Remover rolagens aninhadas na seleção de eventos e usar grade responsiva quando houver espaço.
- Preservar a animação global já existente, que nasce e retorna ao botão de origem, inclusive `prefers-reduced-motion`; corrigir somente exceções programáticas que não registrem a origem.
- Validar salvar, editar, testar e remover integrações, mantendo credenciais fora de respostas, logs e componentes visuais.

## 5. Meu Perfil
- Reconstruir a área intermediária como grade simétrica 2×2: dados pessoais, identificação da conta, segurança/PIX e taxas.
- Distribuir os seis detalhes atuais sem excluir conteúdo e manter cartões com mesma altura, espaçamento e alinhamento.
- Preservar KYC, bloqueios de campos, busca de CEP, endereço e permissões de métodos de pagamento.
- Corrigir o aviso React de chave duplicada observado na busca global, que aparece na árvore da rota Perfil.

## 6. Produtos e links de checkout
- Usar um gerador canônico de slug/URL em criação, duplicação, edição, cópia e abertura; suportar temporariamente URLs antigas em `/pay`, `/checkout` e slug legado.
- Mostrar estado real: rascunho/em análise/inativo não deve parecer link público quebrado; o botão de abrir será bloqueado com orientação para publicar/aprovar.
- Confirmar sincronização automática do catálogo público para todo produto ativo e adicionar teste de regressão por slug.
- Diferenciar no checkout “não existe”, “inativo/em análise” e falha de rede, com reintento seguro e sem revelar dados privados.

## 7. Checkout e segurança ponta a ponta
- Remover prova social aleatória/fabricada; usar somente informação real ou ocultar o bloco.
- Centralizar validação de nome, e-mail, CPF/CNPJ, telefone, cupom, bump e método no backend; o valor final será recalculado no servidor a partir do produto público.
- Garantir interseção obrigatória entre métodos liberados pelo admin, pelo seller e pelo produto/link.
- Nunca enviar credenciais de adquirente ao navegador; aplicar timeout, idempotência, rate limit, CORS restrito, respostas sanitizadas e polling por status mínimo.
- Como as gateways foram removidas, manter o checkout explicitamente indisponível até existir um processador seguro. Não simular venda nem reativar integração antiga. O fluxo visual e os links serão corrigidos agora; cobrança real exige uma adquirente futura aprovada.
- Revisar RLS/RPC, catálogo público, uploads, cupons, pixels e order bumps; validar que seller A não lê/altera recursos do seller B e que visitante recebe apenas o catálogo mínimo.

## 8. Validação e aceite
- Unitários: máscaras/detecção PIX, normalização bancária, filtros/exportação, slug e neutralização de planilhas.
- Integração: saldo concorrente, ownership, catálogo público, cupom/bump, métodos e transições de status.
- Navegador autenticado: saques, contas, vendas/exportação, cupons, Apps, Perfil, Produtos e checkout em desktop/mobile e temas claro/escuro.
- Segurança: scanner do banco sem novos achados, credenciais ausentes de bundle/logs, tentativas cross-seller negadas e checkout fail-closed.
- Critério final: sem erros de console/tipagem, testes existentes e novos aprovados, e nenhum link ativo retornando “inexistente”.

## Ordem de implementação
1. Utilitários e testes de máscaras, PIX, slug e exportação.
2. Saques/Dados bancários/saque automático.
3. Exportação de vendas.
4. Cupons e Apps.
5. Perfil e correção da busca global.
6. Produtos, catálogo e checkout fail-closed.
7. Testes completos, scanner e revisão visual final.
