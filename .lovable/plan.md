# Landing VENXPAY — reconstrução total (nível TriboPay / Hotfy / Cakto, porém superior)

Apagar 100% da landing atual (`LandingPage.tsx` e os componentes em `src/components/landing/`) e reconstruir do zero, com direção de arte autoral, cenas animadas e performance alta. Nada de layout genérico, nada de "métricas de vaidade" em blocos de números.

## O que cada referência entrega (e o que vamos superar)
- TriboPay: densidade comercial e clareza de oferta — pegamos a objetividade, descartamos o visual plano.
- Hotfy: estética escura e produto em destaque — pegamos o clima cinematográfico, descartamos a repetição de cards.
- Cakto: fluidez, microinterações e polimento de marca — pegamos o ritmo de scroll, descartamos o tom "startup padrão".

Nossa síntese: uma landing que se comporta como um produto vivo, não como uma página.

## Estrutura de cena (ordem de scroll)

1. **Abertura — "O dinheiro em movimento"**
   Hero de tela cheia, fundo com campo de luz volumétrico e malha reativa ao cursor (canvas leve, não WebGL pesado). Título em revelação por máscara linha a linha, sublinhado por um filete que se desenha. À direita, o produto real em perspectiva flutuante (não um mockup genérico): tela do painel VENXPAY com dados se atualizando de verdade em loop.

2. **Motor de pagamento — cena sticky**
   Seção que trava no scroll enquanto uma venda percorre o caminho: checkout → antifraude → autorização → split → liquidação. Cada etapa acende, mostra latência real em fonte mono e passa o pulso adiante por uma trilha luminosa. Sai da seção quando o ciclo termina.

3. **Checkout que converte**
   Checkout interativo de verdade na página: o visitante troca método (PIX, cartão, boleto), vê o layout responder, o QR se montar e o "aprovado" acontecer. Sem screenshot estático.

4. **Painel em operação**
   Composição em camadas com parallax: gráfico de faturamento desenhando, lista de vendas entrando em stagger, saldo contando. Tudo em movimento contínuo, 60fps, sem imagem congelada.

5. **Infraestrutura e confiança**
   Faixa técnica: criptografia, antifraude, LGPD, redundância e liquidação — apresentados como diagrama vivo com linhas conectando nós, não como grid de ícones.

6. **Ecossistema**
   Integrações e área de membros em carrossel horizontal controlado pelo scroll vertical.

7. **Prova real**
   Depoimentos em formato editorial (retrato grande, citação em destaque, transição por corte), sem carrossel de cartõezinhos.

8. **Planos e taxa**
   Bloco de oferta com comparação clara e destaque físico no plano principal.

9. **Perguntas frequentes**
   Acordeão com abertura suave e tipografia grande.

10. **Fechamento**
    CTA final em tela cheia com o mesmo campo de luz da abertura, fechando o ciclo visual. Rodapé completo (institucional, legal, contato).

## Direção visual travada
- Base ultra-escura com profundidade real (camadas, não sombra falsa), acento esmeralda VENXPAY e um secundário azul-aço frio para contraste técnico.
- Sora nos títulos, Manrope no corpo, mono tabular em qualquer dado numérico.
- Superfícies sólidas, bordas precisas de 1px, detalhes técnicos (coordenadas, timestamps, IDs) como textura visual.
- Imagens e banners gerados em alta resolução especificamente para as cenas — nada de banco de imagem genérico.
- Sem blocos do tipo "+10.000 clientes / R$ X bilhões processados".

## Movimento e performance
- Motion for React com scroll progress; tudo animado em `transform` e `opacity` apenas.
- `will-change` pontual, `content-visibility` nas seções fora da viewport, canvas com `requestAnimationFrame` pausado quando fora de tela.
- Cenas pesadas simplificadas em telas pequenas (versão estática equivalente, sem perda de hierarquia).
- Respeito total a `prefers-reduced-motion`.
- Meta de fluidez: 60fps constante no desktop, sem travar o scroll do mobile.

## Detalhes técnicos
- Novo diretório `src/components/landing/` reescrito em cenas pequenas e focadas (uma por seção), com `LandingPage.tsx` apenas como composição.
- Tokens da landing isolados em escopo próprio no CSS para não afetar painel, admin ou área de membros.
- Assets novos gerados para hero, retratos dos depoimentos e texturas de fundo.
- SEO: título e descrição próprios, H1 único, JSON-LD de Organization, imagens com alt.
- Validação com Playwright em desktop e mobile: scroll livre, console limpo, cenas rendendo e CTAs navegando corretamente.

## Fora do escopo
Nenhuma alteração em painel do seller, admin, checkout real, banco de dados ou regra de negócio. Trabalho exclusivamente de frontend da landing.
