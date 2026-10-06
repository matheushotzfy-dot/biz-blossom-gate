# Landing VENXPAY — reconstrução total, escura e tecnológica

Uma página inicial completamente nova, com fundo escuro animado, linhas de luz passando, elementos que reagem ao mouse e ao rolar a página, e uma narrativa de vendas sobre velocidade, aprovação e saque. Ela substitui toda a versão editorial branca de agora.

## Direção visual

- Fundo quase preto (#05080A / #0B1412) com feixes de luz esmeralda (#10B981) e azul-céu (#38BDF8) correndo em linhas finas. O texto principal fica em #E6FFF5.
- Uma camada animada desenhada em tempo real no navegador, com nitidez total em telas de alta resolução: linhas de dados passando, uma malha em perspectiva e pontos de luz que seguem o mouse de leve.
- Títulos em Sora com escala grande e números em JetBrains Mono. O corpo do texto fica em Manrope.
- Cartões com borda de 1px que acende onde o mouse passa, inclinação 3D leve e brilho que acompanha o cursor.
- No celular, a animação fica mais leve, sem efeitos de mouse. Quem pediu "menos movimento" no aparelho vê uma versão estática.

## Seções, na ordem

1. **Abertura.** VENXPAY monumental com as letras se montando. O título é "Aprovação acima de 75% em PIX e cartão" e a chamada é "Aqui você multiplica seus resultados". Dois botões: Começar agora e Ver como funciona. Notificações de "Venda aprovada" flutuam e somem em loop ao redor do painel.
2. **Faixa de números.** 75%+ de aprovação, saque instantâneo, PIX em segundos e R$ 0 de mensalidade. Os contadores sobem quando a seção aparece.
3. **Velocidade.** Uma linha do tempo animada pelo rolar da página: cliente paga, gateway aprova, saldo cai e saque sai. Cada etapa acende em sequência com o tempo ao lado.
4. **Adquirências exclusivas.** Rotas de pagamento desenhadas como linhas que saem do checkout e passam por adquirentes nominais exclusivas. Se uma rota falha, a linha desvia para a reserva e a aprovação se mantém. O texto destaca as adquirências 100% exclusivas que mantêm a aprovação acima de 75%.
5. **Saque instantâneo.** Um cartão grande com animação de saque via PIX, do valor ao "Recebido". Um contador de tempo acompanha.
6. **Cartão e PIX.** Um cartão de crédito 3D que gira com o mouse e um QR PIX animado, lado a lado. Embaixo aparecem parcelamento e aprovação.
7. **Painel ao vivo.** Uma réplica do painel do vendedor com gráfico desenhado ao rolar e notificações de venda chegando em tempo real (simuladas).
8. **Tudo incluso.** Grade de capacidades com cartões que acendem no mouse: checkout, links, área de membros, afiliados, webhooks e antifraude.
9. **Integrações.** Logos em carrossel contínuo, que ganham cor ao passar o mouse.
10. **Perguntas** em acordeão animado.
11. **Fechamento.** Chamada final com o fundo de linhas mais intenso e o rodapé legal.

Uma barra superior fixa, translúcida e escura, compacta ao rolar. No celular ela vira um menu acessível.

## O que muda além da página

- A página inicial deixa de seguir o tema branco e passa a ser sempre escura. O login e o painel continuam com o tema salvo na conta. O checkout continua com o tema do produto.
- As regras salvas do projeto mudam: a landing passa a ser escura e tecnológica, com animações. 75%+ e saque instantâneo ficam autorizados como textos oficiais.

## Verificação

- Capturas em computador (1280), tablet (768) e celular (390): sem cortes, sem rolagem lateral e sem zoom ao tocar.
- Conferir os botões, as âncoras do menu, as perguntas e o link para login/cadastro.
- Conferir que a animação não trava a rolagem no celular.

## Detalhes técnicos

- Substituir `src/components/landing2/*` e `src/styles/landing-v2.css` por um novo conjunto em `src/components/landing3/` com estilos isolados em `landing-v3.css`. Os tokens HSL ficam escopados no contêiner da landing, sem afetar o tema global.
- Fundo em `<canvas>` 2D com `devicePixelRatio` até 2 e `requestAnimationFrame`. A animação pausa fora da tela (IntersectionObserver e `visibilitychange`), cai para 30fps no celular e fica estática com `prefers-reduced-motion`.
- Movimento com framer-motion (já instalado): `useScroll` + `useTransform` para efeitos de rolagem, `useMotionValue` + `useSpring` para inclinação e brilho no mouse, e `whileInView` para revelar os elementos. Sem bibliotecas novas.
- Notificações de venda são simuladas com dados fixos e marcadas como ilustração, sem consultar o banco.
- `LandingPage.tsx` passa a montar as novas seções carregadas sob demanda abaixo da dobra.
- Atualizar `AGENTS.md` (regra de arquitetura da landing) e a memória de design (`landing-sophistication`, index).
- SEO de `index.html` ajustado ao novo posicionamento (velocidade, aprovação, saque).
