# Correção e refinamento: KYC, Integrações, Webhooks, Premiações e Suporte

## Resultado
- Corrigir Identidade/KYC usando exclusivamente o status aprovado do perfil; após aprovação, ocultar progresso, pendências e envio de documentos, mantendo apenas a confirmação e os dados da conta.
- Garantir contraste dos logos e controles de Integrações no modo claro, sem alterar configurações já salvas.
- Remover “Entregas recentes” da tela de Webhooks e reorganizar endpoints, segurança e ações em uma composição mais limpa.
- Expandir Premiações para ocupar toda a área útil, reforçando tipografia, leitura das metas, galeria, artefato e acompanhamento de resgates.
- Reconstruir Suporte para melhor leitura em claro/escuro, com lista e conversa mais organizadas, estados consistentes e vínculo em tempo real com o atendimento administrativo.

## Implementação
1. **Identidade e KYC**
   - Consumir `useKycStatus` como fonte única.
   - Não consultar nem mostrar documentos/progresso quando a conta estiver aprovada.
   - Exibir uma confirmação compacta de conta verificada no lugar das pendências.
2. **Integrações e Webhooks**
   - Dar aos logos uma superfície clara/contrastante própria, preservando cores originais em ambos os temas.
   - Remover consulta, indicadores e painel de entregas recentes da interface de Webhooks.
   - Ampliar a lista de endpoints e manter criar, editar, testar, pausar e excluir.
3. **Premiações**
   - Remover a aparência de painel encaixotado e usar largura/altura disponível.
   - Melhorar escala tipográfica, palco, seletor de marcos e rastreio de resgates em desktop e celular.
4. **Suporte seller + admin**
   - Unificar os dois lados da conversa sobre os mesmos tickets e mensagens existentes.
   - Melhorar cabeçalho, filtros, lista, conversa, anexos, estados vazios e contraste claro/escuro.
   - Corrigir feedbacks de erro e manter atualização em tempo real e contadores de não lidas.
5. **Validação**
   - Checar tipos, formatação do código e resultado da compilação.
   - Validar visual público possível; telas autenticadas serão verificadas com sessão disponível.

## Limites
- Nenhuma regra financeira, permissão, usuário ou dado existente será alterado.
- A remoção de “Entregas recentes” é somente visual; o envio e o teste de webhooks continuam funcionando.
