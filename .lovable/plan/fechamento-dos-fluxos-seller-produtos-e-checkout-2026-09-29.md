# Fechamento dos fluxos seller, produtos e checkout

## Objetivo
Corrigir os fluxos solicitados sem reintroduzir adquirentes removidas, mantendo pagamentos fechados até uma integração segura ser aprovada.

## Escopo de execução

### 1. Saques, contas bancárias e chaves PIX
- Aproximar o resumo de valor, taxa e líquido no pedido de saque.
- Formatar agência, conta, CPF/CNPJ, telefone e chaves PIX durante a digitação.
- Detectar automaticamente o tipo da chave PIX e exibir dados sensíveis mascarados.
- Repetir validação de CPF/CNPJ no servidor e manter saldo, limites e titularidade validados pelo banco.

### 2. Exportação de vendas
- Abrir uma janela ampla com filtros por status, produto, nome, e-mail e busca geral.
- Exportar todas as páginas do período escolhido, sempre isoladas pelo seller autenticado.
- Gerar CSV e Excel com valores monetários formatados, progresso e proteção contra fórmulas maliciosas.

### 3. Cupons e integrações
- Padronizar Todos, Ativos, Pausados e Expirados também no administrativo.
- Ampliar as janelas de cupom e integrações, com cabeçalho e ações fixos e conteúdo mais visível.
- Evitar rolagens internas concorrentes e preservar validações existentes.

### 4. Meu Perfil e busca global
- Reorganizar os cartões em uma grade simétrica 2×2, sem remover informações úteis.
- Separar identificação de segurança para equilibrar alturas e reduzir vazios.
- Corrigir itens duplicados na busca global e manter a animação ancorada das janelas.

### 5. Produtos e checkout público
- Tratar links de rascunhos e produtos em revisão como ainda não publicados.
- Permitir copiar e abrir o checkout somente quando o produto estiver ativo no catálogo público.
- Preservar métodos de pagamento ao duplicar produtos.
- Remover compradores, cidades, avatares e contadores fictícios do checkout.
- Não liberar pagamentos simulados: sem adquirente aprovada, o checkout continua indisponível de forma segura.

### 6. Validação final
- Executar testes de máscaras, detecção PIX, exportação e segurança.
- Verificar tipagem, estado atual da prévia e logs de compilação.
- Testar desktop e mobile nos fluxos acessíveis, incluindo abertura e fechamento das janelas.

## Ordem
1. Segurança financeira e máscaras.
2. Exportação de vendas.
3. Cupons e integrações.
4. Perfil e busca.
5. Produtos e checkout.
6. Testes ponta a ponta e correções finais.

## Limite explícito
O checkout real não será reativado sem uma adquirente autorizada. A correção atual elimina links enganosos e mantém o sistema fechado em segurança.
