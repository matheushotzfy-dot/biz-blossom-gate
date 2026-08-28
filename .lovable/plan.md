# Ajustes visuais + correção do seletor de período

## 1. Logo V sem o círculo (barra de faturamento)
`VenxpayLogo` ganha uma prop `plate` (padrão `true`). Quando `false`, o retângulo/placa arredondada em volta do "V" não é renderizado — só a marca. Usar `plate={false}` **apenas** na barra de faturamento da sidebar (`AppSidebar.tsx`, marca d'água de 54px). Todos os outros usos ficam iguais.

## 2. Ícones da sidebar sem cápsula
Nos itens de navegação, remover a caixinha/fundo arredondado atrás do ícone. O ícone fica sozinho, verde (primary) quando ativo e cinza quando inativo, mantendo a pílula vertical esmeralda de item ativo e o alinhamento atual (inclusive no modo colapsado).

## 3. Filtro de dias duplicado no gráfico
Remover o grupo de botões `Hoje / 7d / 30d` do cabeçalho do card "Faturamento" no Dashboard. O período passa a ser controlado só pelo seletor do topo da página. O cabeçalho do gráfico passa a exibir o período ativo como texto (ex.: "Hoje", "7 dias", intervalo personalizado), sem controle clicável.

## 4. Página de taxas quebrada (404)
O banner do dashboard aponta para `/taxas`, rota que não existe. Corrigir o link em `PromoBanner.tsx` para `/financeiro/taxas` (rota real já registrada).

## 5. Seletor de data reconstruído
Refazer o painel do `PeriodPicker` do zero, dentro do padrão da plataforma e sem o calendário genérico:

- Sai o `react-day-picker`; entra uma grade de mês própria (7 colunas, células quadradas, números tabulares), com seleção de intervalo, hover-range, marcação de "hoje" e datas futuras desativadas.
- Layout desktop: largura fluida com `min-w`/`max-w` (sem `w-[560px]` fixo, que hoje corta as colunas de sábado/domingo e cria scroll horizontal); presets à esquerda em coluna, calendário à direita ocupando o restante.
- Estilo: cantos de 14-18px, bordas hairline, fundo sólido do card, sem blur; dia inicial/final do intervalo em esmeralda sólido, dias intermediários com trilho esmeralda suave; navegação de mês com setas discretas e rótulo em Sora.
- Mobile: bottom sheet com a mesma grade, células de toque 44px, presets em grade de 3 colunas e botão "Aplicar período" fixo com safe-area.
- Rodapé: resumo do intervalo (data inicial → final + contagem de dias) à esquerda, "Cancelar" e "Aplicar período" à direita.

## Detalhes técnicos
- Arquivos: `src/components/VenxpayLogo.tsx`, `src/components/layout/AppSidebar.tsx`, `src/pages/Dashboard.tsx`, `src/components/dashboard/PromoBanner.tsx`, `src/components/PeriodPicker.tsx`.
- API pública do `PeriodPicker` (`PeriodValue`, `buildPeriod`, `PERIOD_PRESETS`, `periodLabel`) permanece igual, então Dashboard, Vendas, Saques e Taxas continuam funcionando sem alteração.
- Somente tokens semânticos (primary/border/card/muted-foreground); nada de cor fixa.
- Verificação com Playwright: abrir o seletor no desktop e no mobile conferindo que nenhuma coluna é cortada, e clicar em "Ver minhas taxas" confirmando que carrega a página de taxas.
