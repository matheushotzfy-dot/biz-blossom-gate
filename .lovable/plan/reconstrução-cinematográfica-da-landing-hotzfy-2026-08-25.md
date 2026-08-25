# Reconstrução cinematográfica da landing HOTZFY

## Objetivo
Substituir integralmente a landing atual por uma experiência fintech autoral, com acabamento de campanha premium, narrativa visual de scroll e foco explícito no produto real.

## O que será construído
- Hero monumental e assimétrico com linguagem HOTZFY, navegação refinada e uma composição de produto exclusiva — sem o mockup genérico de dashboard em cartões.
- Cena central “Payment Engine”: fluxo vivo de uma venda atravessando checkout, antifraude, aprovação, split e liquidação, com dados técnicos e animação contínua.
- Storytelling no scroll: textos revelados por máscara, camadas em parallax, anéis técnicos rotativos, linhas de conexão animadas, cenas sticky e números progressivos.
- Seções completas para conversão, orquestração de pagamentos, operação, segurança, prova social, planos, FAQ e CTA final, todas com ritmos e composições próprias.
- Responsividade real para desktop, tablet e celular, com versão simplificada das cenas complexas sem perda de hierarquia.
- Correção do bloqueio de scroll vertical e suporte a `prefers-reduced-motion`.

## Direção visual travada
- Paleta: `#070B0D`, `#10191A`, `#20E6A2`, `#EAFDF7` transformada em tokens semânticos.
- Tipografia: Sora em títulos e Manrope em conteúdo.
- Bordas precisas, superfícies sólidas, detalhes técnicos e contraste editorial; sem roxo, blobs, glassmorphism genérico ou estética de template.
- Inspiração de qualidade e ritmo na Cakto, sem copiar identidade, textos ou componentes.

## Implementação técnica
- Reestruturar `LandingPage.tsx` em componentes pequenos e focados.
- Substituir o `ProductMock` por cenas autorais de produto e um motor de pagamentos visual.
- Usar Motion for React (`useScroll`, `useTransform`, `whileInView`) para animações vinculadas ao scroll.
- Isolar os novos tokens e keyframes no escopo da landing para não alterar os painéis internos.
- Validar scroll, interações, console e composição visual com Playwright em desktop e mobile.
