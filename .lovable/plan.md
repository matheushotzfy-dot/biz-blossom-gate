# Premiações VENXPAY — reconstrução total

Apagar a página atual de Premiações e refazê-la do zero, com um novo conjunto de troféus gerados especialmente para a marca VENXPAY (as placas atuais ainda são "HOTZFY" e serão descartadas).

## Novo conjunto de prêmios

Seis marcos, um objeto físico por marco:

| Marco | Prêmio | Material / direção visual |
|---|---|---|
| R$ 10K | Pulseira + cartão VENXPAY | couro negro costurado, fecho em aço, cartão metálico numerado |
| R$ 100K | Placa Bronze | mármore negro + chapa bronze escovado |
| R$ 500K | Placa Prata | prata platinada, bisel espelhado |
| R$ 1M | Placa Ouro 24K | ouro polido com filete esmeralda |
| R$ 5M | Placa Diamante | cravejada, base em obsidiana |
| R$ 10M | Placa Lenda | peça única, ouro negro + esmeralda, numerada |

Todas com o monograma V da VENXPAY em relevo, valor gravado em destaque, fundo escuro e luz esmeralda — inspiradas nas referências enviadas, mas com composição, acabamento e iluminação próprios (nada copiado).

## A página

Estrutura nova, no padrão limpo/denso que já usamos no Dashboard e em Vendas:

1. **Topo de progresso** — faturamento atual, próximo marco, quanto falta e barra fina em gradiente. Sem card gigante.
2. **Peça em destaque** — o próximo troféu a conquistar em tamanho grande, com leve paralaxe no mouse, selo do tier, número de série e a frase do marco. Bloqueado = tratamento fosco; conquistado = luz viva.
3. **Trilha de marcos** — os seis prêmios em linha, cada um com miniatura real do objeto, valor, tier e estado (conquistado / em progresso / bloqueado). Clique troca a peça em destaque.
4. **Resgate** — quando o marco está liberado, botão de resgate abre o formulário de endereço e mostra o status da entrega (solicitado, produção, enviado, entregue) numa linha do tempo enxuta.
5. **Celebração de desbloqueio** — animação curta e elegante ao atingir um novo marco, exibida uma única vez.

Mobile tratado como app: peça em destaque em card cheio, trilha em carrossel deslizante, botões de toque confortáveis.

## Detalhes técnicos

- `src/pages/Premiacoes.tsx` reescrito do zero; a lógica de leitura de faturamento e de resgate (tabelas de claim já existentes) é preservada e reconectada — nada de backend muda.
- Novos assets em `src/assets/awards/`: `venx-bracelet-10k`, `venx-plaque-100k`, `venx-plaque-500k`, `venx-plaque-1m`, `venx-plaque-5m`, `venx-plaque-10m`. Os PNGs antigos com marca HOTZFY são removidos.
- Componentes de apoio extraídos (peça em destaque, item da trilha, painel de resgate) para manter arquivos curtos.
- Tokens semânticos apenas; sem blur pesado ou sombra custosa, transições de 220–360ms, imagens com `loading="lazy"` e dimensões fixas para evitar CLS.
- A aba "Corrida de Faturamento" e o `PremiacoesHub` continuam como estão.
