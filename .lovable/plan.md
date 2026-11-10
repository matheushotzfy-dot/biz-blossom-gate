# Reformulação completa: Vemprapay

Novo nome **Vemprapay**, visual de fintech séria (linha Inter / Mercado Pago / iFood), paleta **Verde dinheiro**. Abrange tudo: painel do seller, painel admin/gerente/sócio, login/cadastro e site de apresentação. Checkout mantém o tema escolhido pelo produto.

## Direção visual
- Cores: verde #00A868 (marca e ações), verde claro #E9F8F1 (fundos de destaque), navy #0F172A (textos e áreas escuras), cinza #F6F8F7 (fundo das telas), azul #2563EB (links e informação). Vermelho/âmbar só para alertas.
- Claro por padrão (salvo na conta), com modo escuro refeito nas mesmas cores.
- Tipografia nova, menos "cara de IA": títulos e números em fonte geométrica sólida (ex.: Plus Jakarta Sans), valores em reais com números alinhados.
- Estilo banco: cartões brancos com cantos 16px, borda fina, sem brilhos, gradientes roxos ou efeitos de vidro; ícones lineares consistentes; muito espaço e hierarquia clara.
- Logo nova "Vemprapay": símbolo próprio (seta/check em forma de "V" verde) + nome; favicon e ícones do app atualizados.

## Painel do seller (modelo app de banco)
- Topo: saudação, saldo disponível grande com botão de ocultar valores (olho), e atalhos redondos: Sacar, Novo produto, Link de pagamento, Extrato, Cupons.
- Cartões de resumo: Vendas hoje, A receber, Ticket médio, Aprovação.
- Gráfico de faturamento limpo (mantido como pedido antes: só o gráfico, detalhes no toque).
- "Últimas movimentações" em formato de extrato (ícone, descrição, hora, valor verde/vermelho).
- Menu lateral reorganizado em grupos (Início, Vendas, Financeiro, Produtos, Integrações, Conta); no celular, barra inferior estilo app com botão central "Pix/Sacar".
- Todas as páginas internas (vendas, financeiro, saques, produtos, cupons, integrações, perfil, suporte, premiações) recebem o mesmo cabeçalho, tabelas e cartões novos.

## Admin, gerente e sócio
- Mesma identidade, versão "mesa de operação": KPIs em linha, tabelas densas e legíveis, filtros fixos no topo, fichas laterais no novo estilo. Nenhuma regra, permissão ou cálculo muda.

## Login e cadastro
- Tela fixa (sem rolar), formulário à esquerda; à direita um painel institucional Vemprapay em verde/navy com mockup do app (saldo, Pix aprovado) — ilustrativo, sem dados reais.

## Site de apresentação
- Reconstruído no estilo fintech: claro e confiável, mockup do celular com o app, seções de Pix, cartão, saque instantâneo, segurança/LGPD, taxas e chamada para cadastro. Claims autorizados mantidos (aprovação 75%+, saque instantâneo); números ilustrativos marcados.

## Ordem de aplicação
1. Base: cores, fontes, logo, nome Vemprapay em todo o site (66 arquivos), título e metadados.
2. Menu, cabeçalho e barra inferior do celular.
3. Painel inicial do seller.
4. Demais páginas do seller.
5. Painel admin/gerente/sócio.
6. Login/cadastro.
7. Site de apresentação.
8. Revisão: abrir cada página no computador e no celular, claro e escuro, corrigir desalinhamentos; testes automáticos.

## Detalhes técnicos
- Tokens HSL novos em `src/index.css` + `tailwind.config.ts`; componentes shadcn com variantes novas (botão, cartão, badge, tabela). Nada de cor fixa nos componentes.
- Logo: novo `VemprapayLogo.tsx` substituindo `VenxpayLogo.tsx`; atualizar textos, e-mails/notificações visíveis e headers de webhook só no nome exibido (sem quebrar integrações já configuradas — header técnico antigo mantido como compatível).
- Landing antiga `landing3` substituída; a regra "landing sempre escura" e as memórias de marca/estética (navy, Sora/Manrope, sem sombras) serão atualizadas para a nova identidade.
- Domínio hotzfy.com.br continua funcionando; trocar domínio é um passo separado seu.
- Sem mudanças em banco, permissões ou lógica financeira.
