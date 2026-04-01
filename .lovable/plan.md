
## Análise do que JÁ existe:
- ✅ **CourseBuilder** (952 linhas) — editor de cursos com módulos, aulas, vídeo, attachments, drag-and-drop, drip content
- ✅ **Conteúdo** (756 linhas) — listagem de cursos, criação, thumbnails, KPIs
- ✅ **MemberHome** (423 linhas) — dashboard Netflix-like com hero banner, progresso, continuar assistindo
- ✅ **MemberCourse** (492 linhas) — player de vídeo, sidebar com módulos, tracking de progresso
- ✅ **MemberLayout** — navbar com auth
- ✅ **DB** — tabelas courses, modules, lessons, user_access, user_progress, lesson_attachments

## Etapas sugeridas (em ordem de prioridade):

### Etapa 1 — Melhorias no Builder do Seller (CourseBuilder)
- Melhorar UX mobile do builder (atualmente é muito desktop-centric)
- Adicionar configuração de cores/tema da área de membros por curso
- Preview "como aluno" direto do builder
- Estatísticas de engajamento por aula (quem assistiu, tempo médio)

### Etapa 2 — Melhorias na Área de Membros (Aluno)
- Melhorar o player de vídeo (controles mais modernos, qualidade adaptativa)
- Adicionar "lista de favoritos" / bookmark
- Melhorar mobile layout (sidebar responsiva, player fullscreen)
- Certificado de conclusão (PDF gerado automaticamente)
- Notificações de novas aulas

### Etapa 3 — Recursos Avançados
- Quiz/questionários dentro das aulas
- Duplicação rápida de cursos/módulos
- Relatórios detalhados de engajamento no painel do seller
- Configuração WYSIWYG de cores e layout da área de membros
- Limitar acessos/expiração de conteúdo

### Etapa 4 — Infra/Backend
- URLs temporárias para streaming seguro (já existe bucket privado)
- Otimização de queries para 1000+ alunos ativos
- Webhooks de progresso para integrações externas

## Recomendação:
Começar pela **Etapa 1** (melhorias no Builder do Seller) pois é onde o seller cria a experiência. Quer que eu comece por qual etapa?
