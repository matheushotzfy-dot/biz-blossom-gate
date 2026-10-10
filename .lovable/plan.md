# Painel do login — versão tecnológica

## Direção
O painel da direita vira uma "central de operação" da gateway: escuro, com linhas finas, um mapa de rede animado e dados técnicos ao vivo, no mesmo clima da landing (esmeralda + azul sobre o navy). O formulário da esquerda continua igual, já que ficou aprovado e fixo na tela.

## Composição (de cima para baixo)
1. **Barra superior estilo terminal:** logo VENXPAY à esquerda; à direita, um selo "Sistema operacional" com ponto pulsando e um relógio em tempo real (horário de Brasília), em fonte monoespaçada.
2. **Título:** "Pagamentos em velocidade de rede." Uma linha de destaque em degradê esmeralda→azul passa por baixo da palavra "rede".
3. **Mapa de rede animado (peça central):** malha de pontos e conexões em um quadro com bordas finas e cantos marcados (como mira). Pulsos de luz percorrem as linhas entre os "nós" PIX, Cartão, Antifraude, Adquirente e Saque, e o nó central é o "V" da marca. Desenhado no próprio navegador, leve, pausa quando a aba não está visível e fica estático para quem prefere menos movimento.
4. **Fluxo de eventos ilustrativo:** uma lista curta em fonte monoespaçada que entra linha por linha, como um log do sistema. Exemplos: "PIX · aprovado · 182ms", "Cartão · antifraude ok", "Saque · liquidado". Não aparece valor em reais nem saldo, e um pequeno rótulo "demonstração" deixa claro que é ilustrativo.
5. **Rodapé técnico:** três indicadores em células com borda: Aprovação 75%+, Saque instantâneo e Disponível 24/7, com uma mini barra animada em cada um.

## Acabamento
- Bordas de 1px e cantos marcados nos quadros, sem sombras nem desfoque (segue a identidade).
- Uma camada de ruído sutil e uma "linha de varredura" muito discreta passando pelo mapa.
- Entrada orquestrada: os blocos aparecem em sequência em cerca de 0,8s.
- Tudo cabe em 678px de altura (notebook) sem cortar. Em telas mais altas, o mapa ganha espaço.

## Cuidados
- Nenhum dado real do banco: tudo é ilustrativo, como na landing.
- Só cores do sistema de tema, com o painel em navy fixo nos dois temas.
- Desempenho: uma única animação desenhada, que para fora da aba.
- Verificação com prints em 1366x678 e 1440x900.

## Detalhes técnicos
- `src/components/auth/AuthAside.tsx`: compõe os subcomponentes.
- Novos arquivos em `src/components/auth/aside/`: `NetworkCanvas.tsx` (canvas 2D, DPR limitado a 2, requestAnimationFrame com visibilitychange e prefers-reduced-motion), `EventFeed.tsx`, `LiveClock.tsx` e `MetricCells.tsx`, cada um com menos de 150 linhas.
- `src/index.css`: tokens HSL do painel (accent esmeralda, accent azul, line) e as classes `auth-aside-corners` e `auth-aside-scan`.
