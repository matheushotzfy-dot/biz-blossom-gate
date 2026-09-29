# Finalização operacional: Links de Pagamento e painel administrativo

## Objetivo

Levar a janela de criação de Links de Pagamento ao padrão amplo e organizado das ações financeiras e preparar o painel administrativo inteiro para a etapa final de testes, com ações confiáveis, dados consistentes entre admin e seller, carregamento rápido e falhas visíveis.

Esta execução preservará duas regras atuais: nenhuma adquirente será reintroduzida sem autorização e pagamentos/saques continuarão falhando de forma segura enquanto não houver processamento real configurado.

## Diagnóstico confirmado

- A criação de link usa uma janela estreita de uma coluna, embora a tabela já possua validade, limite de usos, preço flexível, instruções, redirecionamento e recorrência.
- O seller ainda não consegue editar um link, não enxerga corretamente bloqueios administrativos e as ações de pausar/excluir não tratam todos os erros.
- O checkout público de links está deliberadamente indisponível sem adquirente; a interface não deve prometer recebimento até existir processamento real.
- O admin possui 34 áreas. A página principal importa todas de uma vez e carrega até 5.000 transações, 2.000 perfis, 2.000 produtos e 5.000 saques mesmo quando a aba aberta não usa esses dados.
- Atualização em tempo real, foco da janela, atualização manual e ciclo de 60 segundos podem iniciar cargas globais concorrentes e permitir que uma resposta antiga substitua uma mais nova.
- Existem telas paginadas no servidor e outras que filtram grandes coleções no navegador; isso gera desempenho e números inconsistentes.
- A ficha de seller dispara muitas leituras paralelas sem proteção quando o operador troca rapidamente de seller.
- A resolução de disputa hoje altera o estado operacional, mas não executa efeito financeiro automático. Essa ação não será apresentada como reembolso concluído.
- Aprovar saques continua indisponível porque não há adquirente configurada; não será criado pagamento fictício.
- A auditoria de ações sensíveis ainda depende parcialmente do navegador e pode ficar separada da alteração principal.
- A navegação real pelas 34 áreas abriu sem erro de execução, mas revelou requisições abortadas em trocas rápidas e ausência de cobertura automatizada específica para o painel e Links de Pagamento.

## Fase 1 — Janela de criação de Links de Pagamento

- Substituir a janela estreita por uma composição ampla, fixa e responsiva, com o mesmo movimento ancorado usado nas demais janelas do seller.
- Cabeçalho claro com ícone, título, descrição e prévia curta do endereço.
- Corpo em duas áreas no desktop e uma no celular:
  - cobrança: capa, título, descrição, valor e endereço;
  - regras: métodos permitidos pelo admin, validade, limite de pagamentos, expiração PIX, instruções e redirecionamento seguro.
- Usar hierarquia semelhante à janela de saque: seções numeradas, valor em destaque, conteúdo principal visível e rodapé fixo com resumo e ação.
- Adicionar descrição acessível à janela e corrigir os avisos atuais de acessibilidade.
- Validar valor em centavos, URL permitida, datas, limites, imagem e pelo menos um método realmente liberado.
- Não exibir cartão, boleto ou recorrência como operantes quando o processamento correspondente não existir.
- Tratar upload e criação como uma operação recuperável: se o registro falhar após enviar a capa, remover o arquivo órfão.
- Mostrar erros de copiar, pausar, excluir e criar; evitar mensagens de sucesso quando a operação falhar.

## Fase 2 — Gestão dos links pelo seller e pelo admin

- Reaproveitar a mesma janela para editar links sem perder URL, métricas ou histórico.
- Mostrar status efetivo: ativo, pausado, expirado, esgotado, arquivado, em revisão ou bloqueado pelo admin.
- Bloquear exclusão física quando houver histórico financeiro; oferecer arquivamento nesses casos.
- Registrar criação, edição, pausa, reativação, arquivamento e exclusão permitida na linha do tempo.
- Tornar a listagem seller pesquisável e paginada no servidor, sem baixar todos os links de uma vez.
- No admin, manter paginação e busca, acrescentar detalhe operacional consistente, motivo de bloqueio e histórico, sem expor dados desnecessários.
- Garantir que bloqueio administrativo interrompa o checkout imediatamente e apareça ao seller com orientação clara.

## Fase 3 — Base rápida e previsível do painel admin

- Dividir as 34 áreas em carregamento sob demanda para que abrir o painel não baixe todas as telas.
- Substituir a carga monolítica por dados mínimos da área aberta:
  - visão geral usa agregados do servidor;
  - transações, sellers, produtos e saques usam paginação própria;
  - rankings e indicadores usam consultas agregadas, não listas truncadas no navegador.
- Remover cálculos repetidos por seller em cada render; criar índices em memória uma única vez apenas onde dados locais ainda forem necessários.
- Centralizar sincronização: uma mutação atualiza somente os dados afetados, em vez de recarregar o painel inteiro.
- Proteger leituras concorrentes com versão/cancelamento para impedir resposta antiga de sobrescrever a nova.
- Reconciliar tempo real, foco e atualização periódica em uma única política, sem duplicar canais ou chamadas.
- Preservar o período selecionado em todas as listas, métricas, ajustes e auditorias que afirmem respeitá-lo.

## Fase 4 — Integridade admin ↔ seller

- Inventariar cada botão e ação das 34 áreas e ligar seu resultado ao reflexo correto na conta seller.
- Para cada operação, validar: permissão no servidor, estado anterior permitido, alteração atômica, resposta de erro, atualização da tela e registro de auditoria.
- Priorizar os fluxos financeiros e de acesso: saldo, saque, disputa, KYC, bloqueio, métodos de pagamento, taxas, produtos, links, assinaturas, suporte, notificações e equipe.
- Mover ações multi-etapas para rotinas transacionais no backend, evitando alterações parciais.
- Tornar auditoria crítica inseparável da ação que ela registra; revelações de dados sensíveis também devem deixar rastro no servidor.
- Diferenciar claramente “resolver análise”, “autorizar reembolso” e “reembolso concluído”; nenhuma disputa movimentará dinheiro por atualização direta do navegador.
- Manter aprovação de saque indisponível até existir adquirente, mas apresentar estado operacional explícito e impedir filas ambíguas.

## Fase 5 — Revisão por domínio administrativo

### Operacional
- Dashboard, Centro de Comando e Analytics: métricas integrais, sem caps silenciosos ou cálculos divergentes.
- Sellers, Inativos, Staff e Gerentes: troca rápida de ficha sem mistura de dados; permissões e ações privilegiadas validadas no servidor.
- Rankings e comissões: origem financeira única, paginação e totais coerentes.

### Financeiro e risco
- Transações, Saques, Links, Anti-Fraude, Abuso, MED, chargeback, reembolsos e pré-MED: estados válidos, idempotência, concorrência e trilha completa.
- Conferir que nenhuma ação injete saldo, aprove pagamento, altere taxa ou resolva disputa sem a rotina segura correspondente.

### Conteúdo e receita
- Produtos, Cursos, Cupons, Afiliados, Assinaturas e Indicações: paginação, filtros, vínculos seller e reflexo no front público.
- Remover controles sem implementação real ou marcá-los como indisponíveis sem criar comportamento falso.

### Sistema
- Configurações, erros, notificações, suporte, premiações, corridas, metas, ferramentas e auditoria: operações idempotentes, feedback correto, limites e histórico.
- Corrigir avisos de acessibilidade e padronizar estados de carregamento, vazio, erro, confirmação e sucesso.

## Fase 6 — Testes e portão de qualidade

- Testes unitários para validações e estados da nova janela de link.
- Testes de integração das consultas, mutações, paginação, filtros e rollback de upload.
- Testes de autorização com visitante, seller A, seller B, funcionário sem permissão, funcionário autorizado e admin.
- Testes de concorrência: dois admins na mesma ação, duplo clique, respostas fora de ordem, eventos em tempo real e troca rápida de seller.
- Testes financeiros: nenhuma aprovação, ajuste, disputa ou reembolso pode duplicar ou criar saldo; falhas intermediárias não deixam estado parcial.
- Testes de segurança para alteração de proprietário, preço, métricas, métodos bloqueados, status administrativo e dados sensíveis.
- Navegação de todas as 34 áreas em desktop e celular, temas claro/escuro, sem rolagem lateral, travamentos ou avisos de acessibilidade.
- Medir abertura inicial, troca de abas, volume de requisições e tamanho carregado antes/depois.
- Executar tipagem, testes existentes, novos testes, scanner/linter do backend e inspeção dos erros da prévia.

## Ordem de entrega

1. Janela de Links de Pagamento e operações seller.
2. Paginação e arquitetura de carregamento do admin.
3. Fluxos críticos admin ↔ seller e auditoria atômica.
4. Revisão funcional por grupo de abas.
5. Testes de segurança, concorrência, desempenho e navegação completa.

## Critérios de aceite

- A janela de novo link é ampla, limpa, simétrica, acessível e funciona em desktop/mobile sem rolagem desnecessária.
- Nenhum método de pagamento indisponível é apresentado como funcional.
- Links podem ser criados e editados sem perder histórico; status administrativos são respeitados no seller e no público.
- Cada área administrativa carrega apenas o necessário e não compete com atualizações globais antigas.
- Todas as ações administrativas têm autorização no servidor, tratamento de erro, atualização coerente no seller e auditoria confiável.
- Métricas não dependem de coleções truncadas e listas volumosas são paginadas no servidor.
- Nenhuma operação financeira cria, duplica, libera ou remove saldo fora de uma rotina atômica validada.
- As 34 áreas passam pelos testes definidos, sem erro de execução, falha de compilação ou alerta novo do scanner.

## Limite explícito

O painel poderá ficar pronto para a bateria final de testes, mas pagamentos PIX/cartão/boleto e aprovação de saque não serão marcados como concluídos ponta a ponta enquanto uma adquirente real não for autorizada e configurada. Até lá, esses fluxos permanecem bloqueados de forma segura.