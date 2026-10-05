# Tema por conta, PIX visível, integrações rápidas e revisão total do admin

## Objetivo
Deixar landing, login, área do seller e painel administrativo claros por padrão; manter o checkout no tema escolhido para cada produto. A escolha light/dark de usuários autenticados será salva na própria conta, sem cookie e sem `localStorage` como fonte permanente.

Também serão corrigidas a exibição das chaves PIX, a legibilidade e velocidade dos ícones de integrações, a proteção real dos dados e os problemas confirmados nas 36 áreas administrativas.

## Limites de segurança
Não é tecnicamente possível esconder rotas, URLs, chamadas ou o código enviado ao navegador de quem usa DevTools, proxy ou ferramentas de rede. Bloquear F12 ou “Inspect” não protege dados e prejudica usuários legítimos.

A proteção será feita na origem: o navegador receberá somente os campos necessários; dados privados serão protegidos por autenticação, permissões no banco, funções do servidor, criptografia, auditoria e limitação de uso. Nenhum segredo administrativo ou credencial de integração deverá chegar a uma sessão sem autorização.

## Fase 1 — Tema claro por padrão e preferência por conta
- Adicionar ao perfil uma preferência restrita a `light` ou `dark`, com `light` como padrão.
- Fazer landing e login iniciarem claros; manter o checkout independente e obedecendo ao tema configurado no produto.
- Ao autenticar, carregar a preferência da conta antes de estabilizar a interface e aplicar mudanças de forma otimista.
- Remover a persistência de tema em cookies e `localStorage`; sessões sem login ficam em light e não persistem escolha.
- Sincronizar a preferência entre abas/dispositivos da mesma conta e corrigir notificações que hoje ficam sempre escuras.
- Validar transições sem flash incorreto nos logins de seller, admin, gerente, sócio e membros.

## Fase 2 — Chaves PIX integralmente visíveis para os autorizados
- Mostrar a chave completa e corretamente formatada nos cartões, seletor de saque, resumo do saque, identidade e saque automático do próprio seller.
- Mostrar a chave completa no painel admin, na fila de saques e na ficha 360 do seller, com botão de copiar e identificação clara do tipo.
- Preservar criptografia no banco e revelação somente por funções autorizadas; nunca expor a chave para visitantes, outros sellers, funcionários sem permissão ou consultas públicas.
- Manter registro auditável de revelações administrativas e revisar expiração/limitação dessa ação.
- Unificar CPF, CNPJ, telefone, e-mail e chave aleatória em um único formatador, removendo máscaras contraditórias.

## Fase 3 — Apps e integrações rápidas e legíveis
- Corrigir cada logo para ter contraste previsível em light e dark, usando uma superfície neutra própria e variantes somente quando necessárias.
- Converter/otimizar imagens grandes, definir dimensões estáveis e eliminar a animação escalonada que atrasa a percepção dos últimos cards.
- Usar carregamento adequado por prioridade, placeholder visual e fallback quando uma imagem falhar.
- Manter os módulos carregados sob demanda sem atrasar a primeira tela e testar todos os logos nos dois temas.
- Corrigir a navegação antiga das integrações para usar uma única origem de aba/URL.

## Fase 4 — Fechar vazamentos reais
- Separar dados internos hoje misturados ao perfil público do próprio seller, especialmente observações administrativas e sinais internos de risco/IP.
- Substituir leituras amplas de perfil por contratos mínimos por tela.
- Migrar credenciais de apps hoje gravadas/lidas diretamente para armazenamento criptografado no servidor; a interface receberá apenas estado configurado e valor mascarado, com atualização sem devolver o segredo anterior.
- Auditar policies vigentes, permissões de funções, arquivos privados, buckets, logs, exports e funções de login. O estado atual já confirmou RLS ativo em todas as tabelas públicas e rate limit nos logins admin/gerente; essas proteções serão preservadas.
- Revisar assets temporários `ignore*`, remover do pacote público o que não for usado e verificar se contêm dados reais.
- Endurecer CSP de produção removendo permissões desnecessárias quando compatível, validar headers reais do domínio e executar linter/scanner após as mudanças.
- Manter chaves públicas necessárias ao aplicativo como públicas por design; nenhum segredo de servidor será movido ao frontend.

## Fase 5 — Painel admin: correções prioritárias confirmadas
### Operação e permissões
- Fazer as permissões configuradas para funcionário e gerente controlarem de verdade a visibilidade das abas e as operações no servidor. Hoje quase todas são apenas opções visuais; somente um subconjunto fixo e suporte têm efeito.
- Centralizar a autorização por ação sensível, exigir reautenticação onde houver dinheiro ou dados pessoais e manter o dono como aprovador final.
- Remover código antigo de disputas que não é mais usado, evitando duas implementações divergentes.

### Saques e finanças
- Manter aprovação de saque bloqueada enquanto não houver adquirente real configurada; a interface deixará explícito o motivo e não simulará pagamento.
- Trocar o `prompt` de recusa em lote por confirmação estruturada, com motivo, responsável, horário e resultado por item.
- Retirar ajustes diretos de saldo do navegador e encaminhá-los exclusivamente pela operação financeira protegida, com reautenticação e ledger auditável.
- Revisar reembolso, MED PIX, chargeback, conciliação, taxas, reservas e saldo por adquirente para que toda alteração financeira seja idempotente e server-side.

### Escala e estabilidade
- Substituir cargas globais de até milhares de perfis, transações, produtos e saques por consultas paginadas e agregações no servidor.
- Paginar logs de erro, auditoria, suporte, disputas, entregas, comissões e listas da ficha do seller.
- Fazer realtime atualizar somente os dados afetados, sem recarregar todo o painel a cada evento.
- Padronizar loading, vazio, erro, retry, filtros, exportação e paginação em todas as abas.

### Organização e acabamento
- Consolidar Dashboard, Centro de Comando e Analytics para evitar métricas repetidas ou divergentes.
- Revisar a ficha 360 do seller: identidade, KYC, vendas, saldos, taxas, adquirentes, saques, PIX, disputas, premiações, suporte e auditoria, com dados paginados e ações próximas do contexto.
- Uniformizar tabelas, janelas, formulários e navegação mobile sem alterar regras financeiras.
- Exibir estado de saúde operacional: adquirentes, filas, webhooks, entregas, conciliação e erros acionáveis.

## Funcionalidades que faltam ou estão incompletas
1. Aprovação e pagamento real de saque — bloqueado até existir adquirente documentada e configurada.
2. Permissões granulares reais para staff/gerentes — a configuração atual não governa a maior parte das ações.
3. Paginação server-side em vários históricos e no carregamento global do admin.
4. Conciliação financeira por adquirente e alerta de divergência com resolução acompanhada.
5. Gestão de incidentes com responsável, prioridade, prazo e vínculo ao alerta/erro original.
6. Expiração e controle de sessão para revelação de dados sensíveis.
7. Exportações administrativas assíncronas e auditadas para volumes grandes.
8. Saúde consolidada de integrações, webhooks, entregas e filas com tentativa manual segura.
9. Cobertura automatizada de permissões por função e isolamento entre sellers.
10. Teste financeiro real de ponta a ponta, dependente da adquirente e de credenciais de sandbox.

## Validação
- Testes unitários para preferência de tema, formatação PIX e contratos mínimos de dados.
- Testes de autorização para seller, funcionário, gerente, sócio e dono, incluindo tentativas diretas fora da interface.
- Testes de isolamento: um seller nunca lê chave PIX, perfil, venda, saldo ou integração de outro.
- Testes de interface em light/dark e celular/tablet/desktop para login, seller, apps e todas as áreas admin alteradas.
- Medição de carregamento dos logos e das listas administrativas antes/depois.
- Typecheck, testes existentes, linter do banco, scanner de segurança e verificação do navegador sem erros.
- Nenhuma operação financeira real será habilitada ou declarada validada sem adquirente e teste conciliado.

## Detalhes técnicos
- Migration versionada para a preferência de tema e para separar dados internos; RLS, grants e `WITH CHECK` revisados.
- Preferência de tema do perfil como fonte de verdade; light em memória para visitantes.
- Credenciais de integrações cifradas e tratadas por funções do servidor; respostas somente com metadados seguros.
- Funções privilegiadas em `app_private`, wrappers públicos invoker quando necessário e checagem de papel no servidor.
- Consultas administrativas por RPC paginada/agregada, preservando filtros e URLs das abas.
- Alterações executadas em blocos pequenos: segurança e tema, PIX/integrações, permissões/finanças, escala/admin, validação final.
