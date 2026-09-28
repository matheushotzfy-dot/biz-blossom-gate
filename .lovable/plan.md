# Projeto completo — Links de Pagamento VENXPAY

## Objetivo

Reconstruir a área de Links de Pagamento como um produto próprio da VENXPAY para cobranças simples, totalmente separado de Produtos.

O seller poderá criar, publicar, compartilhar, acompanhar e administrar:

- cobrança única;
- cobrança recorrente automática no cartão;
- cobrança recorrente por PIX a cada vencimento;
- valor fixo;
- valor livre, com mínimo, máximo e valor sugerido;
- valor fixo com opções de quantidade e acréscimos configuráveis, sem transformar o link em um catálogo de produtos;
- cobrança com ou sem imagem.

O pagador informará nome, e-mail e CPF/CNPJ. O admin terá supervisão e controle total, com auditoria de todas as ações sensíveis.

## Separação obrigatória entre Link e Produto

### Link de pagamento

É um recebível direto. Deve conter apenas a cobrança, sua apresentação, regras de pagamento, recorrência e identificação do pagador.

Não terá:

- produto vinculado obrigatório;
- área de membros ou entrega digital;
- estoque de produto;
- order bump, upsell ou coprodução;
- estrutura de curso;
- checkout-builder de Produtos.

### Produto

Continua sendo a estrutura comercial completa já existente, com entrega, checkout e demais recursos próprios. Transações manterão origem explícita para que relatórios distingam Produto, Link de Pagamento, API e outras fontes.

## Diagnóstico confirmado

A área atual é apenas uma base inicial:

- cria link com título, descrição, valor, capa e seletores de meios de pagamento;
- permite copiar, abrir, pausar e excluir;
- não permite editar, duplicar, pesquisar, filtrar ou abrir uma visão detalhada;
- possui limite de usos e expiração no banco, mas esses recursos não estão disponíveis no painel;
- o checkout público processa somente PIX, embora a criação mostre opções de cartão e boleto;
- Links de Pagamento não estão conectados à estrutura existente de recorrência;
- o admin consegue ler os registros pelo banco, mas não possui uma área operacional para gerenciá-los;
- a área administrativa de assinaturas ainda é uma tela sem operação real;
- algumas métricas do link podem ser alteradas pelo próprio seller por acesso direto, o que precisa ser bloqueado;
- a criação pública de PIX não possui idempotência completa, valida somente o tamanho do CPF/CNPJ e pode ultrapassar limite de usos em pagamentos concorrentes;
- excluir um link fisicamente pode remover o vínculo histórico visível das transações.

## Experiência do seller

### 1. Painel principal de Links

Construir uma página operacional em tela cheia, alinhada ao visual preto/amarelo da VENXPAY, com contraste correto em claro e escuro.

Cabeçalho:

- título e ação principal “Criar link”;
- resumo de receita aprovada, cobranças pagas, cobranças pendentes, conversão e recorrência ativa;
- alternância entre visão geral, links únicos, links recorrentes e arquivados.

Ferramentas de gestão:

- busca por nome, slug ou referência;
- filtros por tipo, status, método, período e vencimento;
- ordenação por criação, receita, conversão e último pagamento;
- paginação real;
- estados de carregamento, vazio, erro e ausência de resultados;
- atualização sem travar ou recarregar a página inteira.

Cada link mostrará:

- imagem ou identidade visual padrão;
- nome, URL e referência interna;
- tipo: único ou recorrente;
- regra de valor;
- periodicidade, quando recorrente;
- métodos realmente disponíveis;
- status efetivo: ativo, pausado, expirado, esgotado, bloqueado pelo admin ou arquivado;
- visitas, pagamentos, conversão, receita bruta e receita líquida;
- último pagamento e data de criação.

Ações:

- copiar URL;
- gerar e baixar QR Code do link;
- abrir checkout;
- editar;
- duplicar;
- pausar ou reativar;
- arquivar;
- abrir detalhes;
- excluir somente quando não houver histórico financeiro; caso exista, arquivar preservando auditoria.

### 2. Criação e edição

Usar um fluxo dedicado, não um formulário apertado dentro de uma janela pequena.

Etapas:

1. Tipo da cobrança
   - única;
   - recorrente no cartão;
   - recorrente por PIX.

2. Identificação
   - nome da cobrança;
   - descrição curta;
   - imagem opcional;
   - referência interna opcional;
   - endereço personalizado do link com validação de disponibilidade.

3. Valor
   - fixo;
   - livre, com mínimo, máximo e sugestão;
   - fixo com quantidade permitida;
   - opções adicionais de cobrança com nome e acréscimo, limitadas e simples;
   - resumo automático do valor final.

4. Recorrência
   - semanal, mensal, trimestral, semestral ou anual;
   - intervalo personalizado quando compatível;
   - quantidade determinada de ciclos ou até cancelamento;
   - primeiro vencimento;
   - período de teste opcional;
   - política de cancelamento;
   - cartão: autorização inicial e renovações automáticas;
   - PIX: nova cobrança por ciclo, com status de vencimento e histórico.

5. Pagamento e validade
   - mostrar apenas métodos realmente processados pelo backend;
   - validade do link;
   - limite total de pagamentos;
   - instrução opcional ao pagador;
   - redirecionamento seguro após confirmação;
   - expiração da cobrança PIX.

6. Revisão e publicação
   - prévia desktop e mobile;
   - resumo completo das regras;
   - confirmação antes de publicar;
   - URL e QR Code prontos para compartilhar.

Validação:

- validação imediata em cada campo;
- valores monetários tratados em centavos para evitar erro de arredondamento;
- pelo menos um método válido;
- regras coerentes de mínimo, máximo, quantidade, expiração e recorrência;
- imagem com tipo, tamanho, dimensões e propriedade do arquivo validados;
- slug normalizado, reservado e único sem diferenciação por maiúsculas.

### 3. Detalhe e gestão de um link

Criar uma página própria por link com:

- visão geral e estado atual;
- URL, QR Code e atalhos de compartilhamento;
- funil: visitas, início de pagamento, cobrança gerada, aprovação e falha;
- receita bruta, taxas, receita líquida e ticket médio;
- lista paginada das cobranças e pagamentos originados pelo link;
- pagador, método, status, valor, vencimento e identificador;
- linha do tempo de eventos;
- assinaturas ativas, inadimplentes e canceladas, quando recorrente;
- edição com histórico de alterações;
- ações de pausa, arquivamento e cancelamento de recorrência.

## Checkout público

### Direção visual

Criar uma experiência própria de cobrança VENXPAY, rápida e confiável, sem aparência de página genérica ou de checkout de produto.

Estrutura:

- identidade do recebedor sem expor adquirente;
- imagem opcional da cobrança;
- título, descrição e referência;
- valor destacado;
- frequência e próximos vencimentos em links recorrentes;
- seleção clara do método disponível;
- formulário enxuto com nome, e-mail e CPF/CNPJ;
- resumo final sempre visível;
- indicação de ambiente seguro e processamento VENXPAY;
- experiência completa em celular, teclado e leitor de tela.

Estados obrigatórios:

- carregando;
- link inexistente;
- pausado pelo seller;
- bloqueado pelo admin;
- expirado;
- limite atingido;
- formulário inválido;
- processamento;
- PIX gerado com QR Code, Copia e Cola, contador e opção de regenerar após expiração;
- cartão autorizado/recusado, quando disponível;
- pagamento aprovado;
- cobrança pendente;
- recorrência ativada;
- falha recuperável e falha definitiva.

A página nunca exibirá nomes internos de adquirentes ao cliente ou ao seller; a marca operacional será VENXPAY.

## Recorrência

### Cartão automático

- consentimento claro do pagador;
- autorização e tokenização exclusivamente pelo provedor, sem armazenar número completo ou código de segurança;
- criação da assinatura somente após confirmação da primeira cobrança/autorização;
- agenda de renovação;
- tentativas controladas em falhas temporárias;
- prevenção de cobrança duplicada;
- cancelamento e término ao fim do ciclo conforme a regra escolhida;
- atualização de status por webhook validado;
- histórico de cada ciclo ligado ao link e à assinatura.

### PIX periódico

- criação de uma obrigação por ciclo;
- geração de novo PIX no vencimento;
- página segura para abrir a cobrança vigente;
- controle de pendente, pago, vencido, atrasado e cancelado;
- nenhuma renovação marcada como paga sem confirmação do provedor;
- histórico imutável dos ciclos anteriores.

Não será simulada recorrência de cartão se a adquirente ativa não oferecer tokenização e cobrança recorrente segura. Durante a implementação, a capacidade real do provedor será validada antes de liberar essa opção; meios indisponíveis ficarão desativados com mensagem correta, nunca como seletor sem efeito.

## Painel administrativo

Criar uma área completa “Links de Pagamento” no admin.

### Visão geral

- volume bruto e líquido por links;
- pagamentos aprovados, pendentes, falhos, estornados e em disputa;
- conversão global;
- links ativos, pausados, expirados e bloqueados;
- recorrência ativa, MRR, renovações, inadimplência e cancelamentos;
- sellers e links com maior volume;
- alertas de abuso e falhas operacionais.

### Gestão global

- busca por seller, título, slug, ID, pagador e transação;
- filtros avançados e paginação;
- detalhe completo do link, seller, configurações, pagamentos, recorrências e eventos;
- bloquear/desbloquear link com motivo obrigatório;
- pausar processamento de um seller sem derrubar toda a plataforma;
- encerrar recorrência em caso de suporte ou risco;
- ver tentativas, falhas, estornos e disputas;
- nunca editar silenciosamente o conteúdo comercial do seller;
- ações privilegiadas feitas por função segura, não por alteração direta no navegador.

### Auditoria e suporte

Registrar:

- criação, edição, publicação, pausa, reativação, duplicação, arquivamento e tentativa de exclusão;
- bloqueio e desbloqueio administrativo com ator e motivo;
- criação de cobrança, aprovação, falha, expiração, estorno, disputa e cancelamento;
- criação, renovação, inadimplência e cancelamento de assinatura;
- valores antigos e novos nos campos relevantes, sem registrar dados sensíveis completos.

O suporte poderá localizar um caso pelo link, transação, e-mail mascarado ou documento mascarado e consultar a linha do tempo sem expor segredos ou dados desnecessários.

## Arquitetura de dados

Evoluir `payment_links` para representar a cobrança, sem vínculo obrigatório com `products`:

- tipo da cobrança;
- regra de valor;
- limites mínimo/máximo/sugerido;
- quantidade e opções simples;
- periodicidade, ciclos e teste;
- status operacional e status administrativo separados;
- motivo e data de bloqueio;
- referência interna;
- configurações de expiração e redirecionamento;
- arquivamento lógico;
- versão para controle de alterações concorrentes.

Criar estruturas específicas para:

- opções adicionais do link;
- sessões/intentos públicos idempotentes;
- ciclos de cobrança recorrente;
- eventos e auditoria do link;
- agregados confiáveis do funil, quando não puderem ser derivados com bom desempenho.

Reaproveitar as tabelas de assinaturas existentes apenas depois de ajustar sua ligação com o link e garantir isolamento por seller. Cada transação originada pelo fluxo manterá `payment_link_id`, origem explícita, valor congelado no momento da cobrança e vínculo com assinatura/ciclo quando aplicável.

Todas as alterações de estrutura serão feitas por migração, com permissões explícitas, RLS ativa, índices e políticas por proprietário, admin e serviço interno.

## Segurança ponta a ponta

### Autorização e isolamento

- seller só lê e administra os próprios links, pagamentos e assinaturas;
- admin e staff recebem apenas as capacidades previstas para sua função;
- nenhum ID de seller vindo do navegador define propriedade;
- propriedade é derivada da sessão autenticada;
- operações públicas recebem apenas dados mínimos do link;
- métricas financeiras são somente leitura para o seller e atualizadas por rotinas internas;
- toda ação administrativa sensível exige validação no servidor e gera auditoria.

### Entrada e integridade

- validação compartilhada no navegador e repetida no servidor;
- CPF/CNPJ com dígitos verificadores;
- e-mail normalizado;
- limites de tamanho e caracteres em todos os campos;
- URL de redirecionamento restrita a protocolos e destinos seguros;
- valores calculados no servidor a partir das regras persistidas, nunca aceitos do navegador;
- proteção contra alteração de preço, intervalo, seller, taxas e status;
- soft delete para preservar histórico financeiro;
- bloqueio atômico de limite de usos para evitar pagamentos além do permitido.

### Abuso, fraude e disponibilidade

- idempotência por tentativa de pagamento;
- rate limit por IP, link, documento mascarado e combinação de sinais;
- rate limit deve falhar de forma segura em operações financeiras;
- integração com blacklist, velocidade, KYC do seller, conta bloqueada e kill switches existentes;
- detecção de múltiplas tentativas, documentos inválidos e comportamento automatizado;
- mensagens públicas sem revelar regras internas;
- logs sanitizados, sem CPF, e-mail, token, chave ou payload de pagamento completos.

### Pagamentos e webhooks

- assinatura criptográfica e proteção contra replay em todos os webhooks;
- idempotência por evento do provedor;
- transições de status permitidas e monotônicas;
- reconciliação de valor, moeda, seller, link e identificador externo antes de aprovar;
- estorno e chargeback corrigem métricas sem apagar histórico;
- segredos somente no servidor;
- adquirente nunca aparece para seller ou pagador;
- consultas públicas de status usam token público opaco da tentativa, não apenas o ID interno da transação.

### Imagens

- bucket com propriedade por pasta e vínculo exato ao link;
- formatos permitidos, limite de tamanho e validação de conteúdo;
- remoção segura de arquivo substituído;
- acesso público somente à imagem vinculada a link publicável.

## Implementação por etapas

### Etapa 1 — Base segura

- corrigir políticas e métricas adulteráveis;
- adicionar modelo de link completo, soft delete, status administrativo e auditoria;
- criar idempotência, token público de status, limites atômicos e índices;
- preservar o link existente e suas transações durante a migração.

### Etapa 2 — Painel seller

- reconstruir listagem, filtros, métricas e estados;
- criar fluxo dedicado de criação/edição;
- implementar detalhe, pagamentos, QR Code, duplicação, pausa e arquivamento;
- garantir contraste claro/escuro e comportamento mobile.

### Etapa 3 — Checkout público único

- reconstruir `/pl/:slug`;
- implementar valor fixo, livre e opções;
- entregar PIX único completo;
- adicionar cartão e outros métodos somente quando o processamento real estiver validado;
- eliminar seletores sem funcionalidade.

### Etapa 4 — Recorrência

- conectar link recorrente às assinaturas e ciclos;
- implementar cartão automático com tokenização segura quando suportado;
- implementar PIX periódico;
- adicionar renovação, falha, atraso e cancelamento;
- construir visão do seller e do pagador.

### Etapa 5 — Admin

- criar gestão global dos links;
- substituir a tela vazia de assinaturas por operação real;
- adicionar métricas, busca, bloqueio, suporte e auditoria;
- vincular links às transações e à ficha do seller.

### Etapa 6 — Blindagem e qualidade

- executar scanner de segurança e revisar apenas riscos relacionados ao novo fluxo;
- testar RLS com seller A, seller B, admin, staff e visitante;
- testar adulteração de valor, owner, métricas, status e recorrência;
- testar concorrência no último uso disponível;
- testar duplo clique, repetição de webhook e replay;
- testar aprovação, expiração, falha, estorno, disputa e cancelamento;
- testar cobrança única e todos os ciclos recorrentes;
- validar ponta a ponta com sessão real em desktop e mobile;
- validar modos claro e escuro, teclado, foco, contraste e leitores de tela;
- conferir logs e estado final do banco sem alterar vendas reais, usuários ou configurações de adquirentes.

## Critérios de aceite

A entrega será considerada completa somente quando:

- Link de Pagamento estiver claramente separado de Produto em dados, navegação e linguagem;
- seller conseguir criar, editar, duplicar, compartilhar, pausar, arquivar e acompanhar links;
- valor fixo, livre e opções funcionarem com cálculo no servidor;
- cobrança única por PIX funcionar ponta a ponta;
- recorrência por cartão e PIX tiver estados e histórico coerentes, respeitando a capacidade real do provedor;
- checkout público não mostrar controles sem implementação;
- admin visualizar e controlar links e assinaturas com auditoria;
- seller não conseguir adulterar métricas ou acessar dados de outro seller;
- limite de uso, idempotência, rate limit, antifraude e webhooks resistirem aos testes previstos;
- estornos e disputas atualizarem métricas corretamente sem apagar histórico;
- nenhuma adquirente interna aparecer para seller ou pagador;
- telas estiverem verificadas em desktop/mobile e claro/escuro;
- build, tipos, testes e scanner não apresentarem regressão relacionada à entrega.

## Fora do escopo

- transformar Links de Pagamento em catálogo ou loja;
- migrar Produtos existentes para Links;
- alterar vendas reais, usuários existentes ou configuração das adquirentes;
- criar meios de pagamento fictícios quando não houver suporte real do provedor;
- remover funcionalidades atuais de Produtos.
