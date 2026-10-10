# Painel do login — "V" 3D da marca

## Direção
O lado direito vira um palco escuro e limpo, sem cards, listas nem quadros de interface. A peça única é o "V" da VENXPAY em 3D: vidro escuro com bordas metálicas, iluminado como foto de produto, girando devagar e inclinando suavemente na direção do mouse.

## Cena
- **Objeto:** o "V" extrudado com bordas chanfradas. O material é vidro fumê com refração, e o reflexo das luzes cria filetes esmeralda e azul nas arestas.
- **Luz de estúdio:** três faixas de luz suaves (verde, azul e branca) refletindo no objeto, como numa fotografia de produto Apple, sem efeito neon.
- **Chão:** um reflexo sutil embaixo do V, que se dissolve no fundo.
- **Fundo:** navy profundo com um leve vinco de luz atrás do objeto e grão fino de filme.
- **Movimento:** flutua em cerca de 2cm e gira lentamente. Ao mover o mouse no painel, o V inclina na direção do cursor com amortecimento suave e volta ao centro quando o mouse sai.

## Tipografia (pouca e elegante)
- Canto inferior esquerdo: frase curta em duas linhas, por exemplo "Pagamentos que não param.", com uma linha menor embaixo: "PIX · Cartão · Saque instantâneo".
- Canto superior direito: só "VENXPAY", espaçado e discreto.
- Nada mais. O objeto é o protagonista.

## Qualidade e desempenho
- O 3D só é carregado no computador. No celular o painel já não aparece, então nada pesa lá.
- Enquanto carrega, aparece o fundo navy com um V desenhado em traço, sem tela preta.
- Em computadores sem aceleração 3D, ou para quem prefere menos movimento, o V fica parado (renderiza uma vez).
- Resolução limitada para manter a fluidez, e a animação pausa fora da aba.

## Verificação
- Prints em 1366x678 e 1440x900, conferindo o objeto nítido e iluminado, o texto legível e a página sem rolagem.
- Console sem erros.

## Detalhes técnicos
- Dependências: `three`, `@react-three/fiber@^8.18`, `@react-three/drei@^9.122` (React 18).
- `src/components/auth/aside/BrandV3D.tsx`: Canvas (dpr [1, 1.75]), `ExtrudeGeometry` a partir de um `Shape` do V com bevel, `MeshTransmissionMaterial`, `Environment` com `Lightformer` locais (sem preset de CDN), `ContactShadows`, tilt por ponteiro com damping `Math.exp(-k*dt)`.
- Carregado com `React.lazy` + `Suspense` dentro do `AuthAside`; fallback em SVG.
- `AuthAside.tsx` reescrito; os componentes do painel anterior (canvas 2D, eventos, relógio, métricas) e as suas classes CSS são removidos.
