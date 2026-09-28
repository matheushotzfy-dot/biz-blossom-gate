# Refinamento: transações, produtos, PIX, saque e taxas

Sistema visual mantido: preto/grafite, amarelo funcional, Sora/Manrope, bordas finas. Nenhuma regra de negócio, valor ou fluxo muda — apenas apresentação.

## 1. Pop-up "Gerar PIX" (prioridade máxima)
- Reconstruir o pop-up com cantos bem arredondados (24px), mais largo (~480px) e espaçamento generoso.
- Topo com ícone PIX oficial, título e subtítulo; campo de valor grande em destaque com R$ e atalhos (R$ 50 / 100 / 250 / 500).
- Resumo claro abaixo: valor, taxa estimada, você recebe.
- Tela do QR Code: QR centralizado em moldura clara, contagem regressiva visível, botão "Copiar código" amarelo grande, status "Aguardando pagamento" com indicador pulsante e confirmação animada quando pago.
- No celular abre como folha vinda de baixo.

## 2. Pop-up "Solicitar saque" (mesma linha do PIX)
- Mesmo formato: arredondado, maior nas laterais, mesma hierarquia.
- Saldo disponível em destaque, campo de valor grande com botão "Máx.", chave PIX de destino em cartão, resumo (taxa / você recebe) e botão amarelo grande.

## 3. Últimas transações (Dashboard)
- Linhas mais limpas: ícone do método, nome do cliente/produto, data relativa, valor em números tabulares e selo de status colorido (Pago, Pendente, Expirado, Reembolsado).
- Movimento sutil ao passar o mouse, clique abre o detalhe já existente, estado vazio ilustrado e esqueleto de carregamento.

## 4. Novo produto + seleções de tipo
- Seleção "Infoproduto / Físico / Serviço / etc." em cartões grandes clicáveis com ícone, descrição curta e marcação amarela no escolhido.
- Categoria, garantia e tipo de pagamento no mesmo padrão de seleção refinado.
- Campos com mais respiro e agrupamentos claros.

## 5. Menu dos 3 pontos em Produtos
- Menu arredondado, mais largo, ícones em cada ação, agrupamento (Editar, Duplicar, Pixel, Link / Excluir em vermelho separado).

## 6. Taxas no Meu Perfil
- Remover o bloco largo atual e colocar as taxas exatamente no lugar e no tamanho do antigo cartão "Progresso de faturamento", centralizado na grade.
- Conteúdo refeito e compacto: taxas de Pix, cartão, boleto e saque em lista elegante, selo "Padrão/Personalizada" e prazos de liberação resumidos. Simulador vira um pequeno campo inline.

## Detalhes técnicos
- Arquivos: `src/components/QuickPixDialog.tsx`, `src/pages/financeiro/Saques.tsx` (diálogo de saque), `src/pages/Dashboard.tsx` (últimas transações), `src/pages/vendas/ProductEditor.tsx` (seleção de tipo/categoria), `src/components/products/ProductActionsMenu.tsx`, `src/pages/Perfil.tsx` (Panel "Suas taxas" volta para a célula única da grade, sem `lg:col-span-2`).
- Criar um `DialogShell` compartilhado (rounded-3xl, max-w-[480px], Drawer no mobile) usado por PIX e saque.
- Somente tokens semânticos; validação via build e checagem de tipos.
