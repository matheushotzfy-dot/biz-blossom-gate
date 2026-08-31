# Landing VENXPAY — reconstrução total do zero

Nada da landing atual é reaproveitado. Todos os componentes, o CSS de landing, os assets gerados e a página são apagados e escritos de novo, com outra linguagem visual, outra estrutura de seções e outra lógica de animação.

## O que é apagado

- `src/components/landing/` inteiro (todas as cenas, `parts.tsx`, `device/`)
- `src/styles/landing.css`
- Assets `src/assets/landing/*` gerados anteriormente
- `src/pages/LandingPage.tsx` reescrito do zero

Nada fora da landing é tocado: dashboard, checkout, banco de dados e regras de negócio permanecem intactos.

## Nova direção visual

Direção "sala de controle financeira à noite": fundo grafite profundo com um único halo esmeralda em movimento lento, tipografia editorial de grande escala (Sora display em tamanhos 72–120px), linhas de grade finas expostas como se fosse papel milimetrado técnico, e reserva total do verde para o que representa dinheiro aprovado.

Diferenças deliberadas em relação ao que existe hoje:

- Sem seção sticky de painel girando em perspectiva
- Sem carrossel de depoimentos com retrato grande
- Sem faixa de logos deslizante
- Sem cards de vidro empilhados em grade de 4 colunas
- Sem numeração 01/02/03 em barras laterais

## Nova estrutura de seções

1. **Abertura** — tela cheia, título em duas linhas com revelação por máscara linha a linha, subtítulo curto, um único botão. Fundo: halo esmeralda + grade técnica, sem imagem fotográfica.
2. **Prova imediata** — tira horizontal de notificações de venda aprovada em movimento contínuo suave, no estilo iOS, com a marca VENXPAY, logo abaixo do fold.
3. **Linha do tempo do dinheiro** — narrativa vertical: pagamento, antifraude, aprovação, split, liquidação. Um traço vertical que se preenche conforme o scroll, cada etapa entrando por cortes horizontais.
4. **A tela real** — janela do gateway, recriada nova, em composição frontal e estática com foco por camadas (sem rotação 3D), com legendas curtas em rodapé de imagem.
5. **Checkout** — demonstração compacta em coluna única, com etapa Pix concluída animada uma vez ao entrar na viewport.
6. **O que está incluído** — lista tipográfica densa em duas colunas, sem cards, com divisores finos e destaque em hover.
7. **Integrações** — grade estática de marcas, sem marquee, com tratamento monocromático que colore no hover.
8. **Condições** — bloco de contrato aberto em tipografia grande, valores em números tabulares.
9. **Perguntas** — acordeão minimalista de linhas.
10. **Fechamento** — bloco final de tela cheia com o halo esmeralda intensificado e CTA único.

## Detalhes técnicos

- Novo namespace CSS `.vx-land` em `src/styles/landing-v2.css`, tokens semânticos apenas (nada de cor hard-coded), importado somente pela página da landing.
- Novos componentes em `src/components/landing2/`, um arquivo por seção, cada um abaixo de 150 linhas, props tipadas.
- Animação com Framer Motion: `useScroll` por seção, `useReducedMotion` respeitado em todas as cenas, transformações apenas em `transform`/`opacity` para manter FPS alto; `content-visibility` nas seções abaixo do fold.
- Novos assets gerados especificamente para esta versão (halo, textura de grade, retratos de produtores), nomeados sob `src/assets/landing-v2/`.
- Metadados de head revisados (title, description, og, twitter) para a nova narrativa.
- Validação: typecheck, build, e verificação com Playwright em desktop e mobile (scroll completo, sem erro de console, sem travamento de scroll).
