
## Identidade Visual — Estilo Flat Professional (OBRIGATÓRIO)

A plataforma adota o estilo **Flat Professional** como identidade visual definitiva. Este padrão é obrigatório em TODAS as páginas e componentes.

### Princípios:
- **Sem brilho/glow/neon**: Nunca usar `glow-primary`, `glow-value`, `text-shadow`, `box-shadow` com hsl(primary), blur decorativo
- **Sem glass/glassmorphism**: Nunca usar `glass-panel`, `ultra-glass`, `backdrop-blur` em cards/painéis
- **Sem noise/scan**: Nunca usar `noise-overlay`, `scan-line`, `dot-grid`, `mesh-gradient-hero`, `shimmer-sweep`, `animated-border`, `glass-shine`
- **Sem blobs decorativos**: Nunca usar divs `absolute` com `blur-[Npx]` e cores como `bg-primary/14` para criar manchas luminosas

### Como estilizar:
- **Cards**: `rounded-2xl border border-border/60 bg-card shadow-sm` (ou `bg-background/80`)
- **Cards com acento**: adicionar `border-t-2 border-t-{cor}` (ex: `border-t-primary`, `border-t-success`)
- **Pills/badges**: `rounded-full border border-border/60 bg-background/75 px-3 py-2`
- **Hover**: `hover:bg-muted/20` ou `hover:bg-accent/25` — sem `hover:shadow-xl`, sem `hover:scale`
- **Ícones**: fundo flat com `bg-primary/10 text-primary` (ou success/info/warning conforme contexto)
- **Números/valores**: `font-heading font-black text-foreground` sem text-shadow ou glow
- **Fundo de layout**: gradiente tonal sutil (`from-background to-secondary/20`) + grid discreto (`ambient-grid opacity-[0.1]`) + linhas horizontais finas (`h-px bg-gradient-to-r from-transparent via-border/60 to-transparent`)
- **Tooltips**: `border border-border/60 bg-card shadow-lg` — sem backdrop-blur

### Referência de cor:
Sempre usar tokens semânticos: `--primary`, `--success`, `--info`, `--warning`, `--destructive`, `--muted`, `--border`, `--card`, `--background`, `--foreground`

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
