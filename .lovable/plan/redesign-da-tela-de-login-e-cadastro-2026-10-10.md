# Redesign da tela de login e cadastro

## Problemas atuais
- A tela inteira rola: a coluna do formulário tem altura mínima de 100% e muito espaço vertical (logo em cima, rodapé embaixo, margens grandes). Com isso o formulário fica "caído" e no notebook (cerca de 680px de altura) precisa rolar.
- O painel da direita mostra um "cartão de saldo" inclinado com números de exemplo (R$ 42.890,00, conversão 87,4%), selo flutuante e brilhos. Parece maquete genérica, não um produto financeiro sério.

## 1. Layout fixo (sem a página rolar)
- A tela ocupa exatamente a altura da janela, e as duas colunas ficam travadas (sem rolagem da página no computador).
- Formulário centralizado na vertical. Logo e rodapé de segurança ficam compactos nas bordas.
- Espaços reduzidos: campos com 44px de altura (antes 48–54px), espaço entre campos menor e título com 26px.
- Cadastro em etapas: se uma etapa for mais alta que a tela (janelas baixas), só a área do formulário rola por dentro. Logo, título, indicador de etapas e botões ficam fixos.
- No celular: uma coluna, rolagem natural e nenhum zoom ao tocar nos campos (texto com 16px).

## 2. Painel direito novo — "editorial institucional"
Sai o cartão de maquete. Entra uma composição sóbria e de marca, no padrão de empresa financeira grande:
- Fundo navy sólido (Navy Trust), com uma malha fina de linhas e um "V" da marca em traço, grande e discreto, ao fundo. Sem desfoque, sem sombra e sem brilho, como definido na identidade.
- No topo: logo VENXPAY e o indicador "Sistema operacional".
- No centro: uma frase forte (por exemplo, "A infraestrutura de pagamentos para quem vende online.") e três pilares em lista, com ícone fino e linha divisória:
  - PIX e cartão com aprovação acima de 75%
  - Saque instantâneo
  - Antifraude e dados protegidos (LGPD)
- Embaixo: uma faixa com três indicadores institucionais (aprovação 75%+, saque instantâneo, disponível 24/7). Todos já foram autorizados por você e nenhum mostra saldo ou valor inventado.
- Animação curta só na entrada (o texto aparece em sequência), desligada para quem prefere menos movimento.
- O painel acompanha o tema: no tema claro fica navy com texto claro, e no escuro também, para manter a identidade.

## 3. Cuidados
- Nada muda no funcionamento: validações, etapas do cadastro, recuperação de senha e limite de tentativas continuam iguais.
- Só são usadas cores do sistema de tema (nenhuma cor fixa no código).
- Verificação no navegador em 1366x678, 1440x900, tablet e celular, conferindo que não aparece barra de rolagem no computador e que o formulário fica centralizado.

## Detalhes técnicos
- `src/pages/Auth.tsx`: container `h-[100dvh] overflow-hidden` no desktop (`lg:`), coluna do formulário `flex flex-col` com área central `flex-1 min-h-0 overflow-y-auto` e conteúdo `my-auto`. Tokens de input/label/botão compactados.
- `src/components/auth/AuthAside.tsx`: reescrito (até cerca de 150 linhas) com subcomponentes `AsidePillars` e `AsideMetrics`, e o "V" em SVG inline.
- `src/index.css`: remover as classes `auth-aurora`, `auth-preview` e `auth-secure-float`; adicionar os tokens `--auth-aside-bg` e `--auth-aside-fg` (HSL).
