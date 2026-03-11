

## Plan: Header Minimalista (Referência da imagem)

### Objetivo
Redesenhar o header do `DashboardLayout.tsx` para um estilo ultra-minimalista: remover a barra de busca grande, deixar apenas o ícone de lupa, e mostrar o avatar real do usuário (foto de perfil) no canto direito. Layout limpo, sem bordas pesadas, sem texto de nome/email no header.

### Mudanças em `src/components/layout/DashboardLayout.tsx`

**Header redesenhado:**
- Lado esquerdo: `SidebarTrigger` (hambúrguer) + ícone de lupa (Search) pequeno e clicável (abre o `GlobalSearchDialog`)
- Meio: vazio (espaço livre)
- Lado direito: toggle de tema (Sun/Moon) + sino de notificações + avatar circular do usuário com foto real (`profile?.avatar_url`) ou fallback com inicial
- Remover: barra de busca larga, texto do nome/email, `ChevronDown`, borda divisória `border-l`
- Header mais fino: reduzir de `h-[78px]` para `h-14` (~56px)
- Borda inferior ultra-fina: `border-b border-border/30`
- Background: `bg-background/80 backdrop-blur-xl`
- Todos os botões de ícone: sem borda, sem background, apenas hover sutil (`hover:bg-muted/40 rounded-full`)
- Avatar: `rounded-full h-8 w-8` com `object-cover`, clicável para ir ao `/perfil`

### Resultado visual
Um header limpo estilo Linear/Vercel: lupa à esquerda, ícones pequenos + avatar redondo à direita, sem ruído visual.

