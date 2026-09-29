# Refinamento integral: suporte, perfil, pagamentos, janelas, cupons e premiações

## Objetivo
Corrigir os pontos visuais relatados e fechar as regras no banco e nas telas, sem criar controles apenas decorativos. A entrega será feita em blocos verificáveis, com tema claro/escuro, desktop/mobile, acessibilidade e testes dos fluxos reais.

## Estado confirmado
- O botão “Novo Ticket” usa os tokens globais de ação; o arquivo de tema contém definições concorrentes de cores, tornando o contraste do tema claro frágil.
- O Perfil calcula e exibe o tier “Iniciante”, consulta o ticket máximo e mostra vários limites como textos fixos. “Chaves API — Até 5” corresponde a um bloqueio real de 5 chaves no banco.
- “Suas taxas” possui simulador próprio e repete parte da lógica da página de taxas.
- Boleto está habilitado nas 2 contas atuais. Produtos antigos também aceitam boleto por padrão; links de pagamento já nascem com boleto desligado.
- O admin já controla cartão e boleto por seller, mas não controla Pix. Esses bloqueios hoje não cobrem integralmente produtos existentes, links e todas as respostas públicas.
- Os pop-ups usam uma animação central genérica. Saque e saque automático já preservam foco pelo componente acessível atual, mas não conhecem a posição do botão de origem.
- Cupons usa um seletor visual diferente do padrão refinado e não distingue corretamente erro de lista vazia.
- Premiações empilha cabeçalho, progresso e um visor com altura mínima de 620px; por isso a coleção fica abaixo da primeira tela.

## 1. Suporte no tema claro
- Consolidar os tokens finais de tema para eliminar definições conflitantes sem usar correções locais ou cores fixas.
- Garantir contraste AA no botão “Novo Ticket” e nas demais ações primárias do suporte, inclusive hover, foco e estado desabilitado.
- Validar abertura, envio, anexos, filtros, conversa e retorno visual nos dois temas.

## 2. Perfil mais limpo e alinhado
- Remover o card de tier e todo cálculo/importação de milestones usado apenas nessa página.
- Manter três indicadores superiores de largura e altura iguais: tempo de conta, vendas e status.
- Remover “Ticket máximo por transação” e “Chaves API — Até 5” do Perfil.
- Remover também os textos estáticos que não representam dados reais (“limite diário ilimitado”, “3 saques pendentes” e similares), deixando apenas informações operacionais comprovadas ou removendo o bloco se ele ficar vazio.
- Equalizar os cards das duas colunas por grade e altura mínima coerente, sem conteúdo esticado artificialmente.
- Em “Suas taxas”, remover o simulador e manter somente Pix, cartão, boleto e saque, com estado “Disponível/Desabilitado” conforme as permissões reais da conta.
- Unificar a resolução das taxas em uma única fonte compartilhada para Perfil e página de Taxas, eliminando divergências.

## 3. Métodos de pagamento realmente controlados pelo admin
### Regra aprovada
- Pix, cartão e boleto terão permissão individual por seller.
- Boleto ficará desativado para todas as contas existentes e será desativado por padrão para novas contas.
- Desativar um método no admin deve impedir seu uso em qualquer produto, link e checkout; não apenas esconder um botão.

### Banco e segurança
- Adicionar `pix_enabled` ao perfil com padrão ativo; manter cartão ativo por padrão; alterar boleto para padrão inativo.
- Migrar todas as contas atuais para `boleto_enabled = false`.
- Desligar boleto também nos produtos e links existentes.
- Criar validação central no banco para impedir que sellers gravem Pix/cartão/boleto como ativo quando a conta não possui permissão.
- Ao admin bloquear um método, desligá-lo nos produtos e links existentes do seller de forma atômica. Ao liberar, manter os itens desligados até o seller optar por ligá-los novamente.
- Fazer as consultas públicas retornarem a interseção entre permissão da conta e configuração do produto/link, fechando inclusive registros antigos.
- Manter as operações financeiras em modo seguro e indisponível enquanto não houver nova integração de pagamentos; os controles serão funcionais, mas não fingirão processar cobranças.
- Registrar toda alteração feita pelo admin na auditoria, com método, estado anterior, estado novo, seller e administrador.

### Admin e seller
- Substituir os botões atuais do seller no admin por um controle claro dos três métodos, com salvamento, carregamento, erro e confirmação visual.
- Aplicar a permissão no editor de produto, criação/edição de link, checkout de produto e checkout de link.
- Um método bloqueado pelo admin aparece como indisponível para o seller, sem possibilidade de adulteração pelo navegador.

## 4. Chaves API sem limite de quantidade
- Remover o trigger que bloqueia a sexta chave e a função de limite de quantidade associada.
- Manter as proteções importantes: autenticação, isolamento por dono, segredo exibido uma única vez, hash seguro, rate limit de criação e auditoria.
- Remover qualquer texto de limite no Perfil e mensagens de erro específicas de “limite de 5”.
- Testar criação de mais de cinco chaves, renomeação, revogação/exclusão e isolamento entre sellers.

## 5. Animação compartilhada para todas as janelas acionadas por opções
- Criar uma variante reutilizável sobre o componente acessível existente, capturando a posição e o tamanho do botão que abriu a janela.
- A janela abrirá com transformação suave a partir desse botão e fechará retornando visualmente a ele, com curva elástica curta, sem distorcer o conteúdo.
- Preservar foco preso na janela, fechamento por Esc/clique externo, retorno de foco ao acionador e bloqueio de rolagem.
- Para quem usa redução de movimento, trocar o efeito por fade curto.
- Aplicar de forma sistemática às janelas do seller: solicitar saque, saque automático, reautenticação, dados bancários/nova conta, cupons, integrações, novo endpoint/webhook, chaves API, links, checkout e demais ações encontradas no inventário.
- Não aplicar a menus pequenos, tooltips ou painéis laterais cuja interação não é modal.
- “Gerar Pix” permanecerá indisponível enquanto não houver processador; a animação ficará pronta para o diálogo voltar sem reativar uma operação removida.
- Testar janelas empilhadas, especialmente saque → confirmação de senha, evitando overlays duplicados ou reanimação da janela anterior.

## 6. Cupons
- Trocar Todos/Ativos/Pausados/Expirados pelo mesmo seletor refinado usado nas demais abas: indicador ativo forte, contadores legíveis, tamanhos estáveis e rolagem clara no celular.
- Adicionar semântica de abas, foco visível e navegação por teclado.
- Manter filtros e contagens atuais, mas separar carregamento, erro, vazio geral e vazio por filtro.
- Levar “Novo cupom” para a nova animação ancorada e validar criação, pausa, expiração, busca, cópia e exclusão.

## 7. Premiações na primeira tela
- Reduzir o espaço superior do hub, cabeçalho e progresso sem perder o acabamento cinematográfico.
- Trocar alturas mínimas fixas por uma composição baseada na altura disponível: cabeçalho e progresso compactos, artefato flexível e coleção visível na primeira tela em notebooks.
- Redimensionar imagem, textos e ações por altura disponível, sem escalonar tipografia pela largura da tela.
- No celular, priorizar artefato, meta e coleção; detalhes secundários ficam compactos, sem sobreposição.
- Manter “Seus resgates” abaixo da primeira tela e preservar seleção, setas, teclado, compartilhamento e resgate.

## 8. Validação e qualidade
- Criar testes para permissões Pix/cartão/boleto, incluindo tentativa direta de burlar o bloqueio e regressão de registros antigos.
- Testar boleto desligado em todas as contas e como padrão em uma conta nova.
- Testar mais de cinco chaves API e confirmar que segurança e rate limit continuam ativos.
- Testar todos os pop-ups por mouse e teclado, fechamento/retorno ao acionador, janelas empilhadas e `prefers-reduced-motion`.
- Revisar suporte, perfil, taxas, cupons, premiações, produtos, links, integrações, dados bancários e saques em claro/escuro, desktop e celular.
- Rodar testes focados, checagem de tipos, build e inspeção dos logs de execução antes de concluir.

## Ordem de implementação
1. Migração e regras de métodos de pagamento + remoção do limite de chaves API.
2. Controles admin e propagação segura para produtos, links e checkouts.
3. Limpeza do Perfil e unificação das taxas.
4. Componente de animação ancorada e migração das janelas inventariadas.
5. Suporte, Cupons e Premiações.
6. Testes funcionais, segurança, acessibilidade e revisão visual completa.

## Critérios de aceite
- “Novo Ticket” legível no tema claro.
- Perfil sem tier, ticket máximo, limite de API e simulador; cards alinhados.
- Boleto desligado em todas as contas e novas contas; admin controla Pix/cartão/boleto por seller e o bloqueio vale até o checkout público.
- Seller consegue possuir mais de cinco chaves API.
- Todas as janelas modais do seller abrem e fecham a partir de seu acionador com movimento suave e alternativa reduzida.
- Cupons usa o seletor padrão e trata erro corretamente.
- Premiações e coleção aparecem na primeira tela em desktop comum, sem quebrar mobile.
- Nenhuma operação de pagamento removida é reativada acidentalmente.
