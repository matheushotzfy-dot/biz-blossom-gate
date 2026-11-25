import { BarChart3, Copy, ExternalLink, Eye, EyeOff, MoreHorizontal, Pencil, Settings2, Trash2, type LucideIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface CourseMenuHandlers {
  onOpenBuilder: () => void;
  onOpenEdit: () => void;
  onOpenAnalytics: () => void;
  onTogglePublish: () => void;
  onCopyLink: () => void;
  onOpenPreview: () => void;
  onDelete: () => void;
}

type Row = { icon: LucideIcon; label: string; action: () => void; destructive?: boolean };

/** Menu de três pontos de uma área de membros (usado no cartão e na linha da lista). */
export function CourseActionsMenu({ title, isLive, held = false, handlers, triggerClassName }: { title: string; isLive: boolean; held?: boolean; handlers: CourseMenuHandlers; triggerClassName?: string }) {
  const manage: Row[] = [
    { icon: Settings2, label: "Editar conteúdo", action: handlers.onOpenBuilder },
    { icon: Pencil, label: "Editar detalhes", action: handlers.onOpenEdit },
    { icon: BarChart3, label: "Ver análises", action: handlers.onOpenAnalytics },
    { icon: isLive ? EyeOff : Eye, label: isLive ? "Despublicar" : "Publicar", action: handlers.onTogglePublish },
  ];
  const share: Row[] = isLive
    ? [
        { icon: Copy, label: "Copiar link da área", action: handlers.onCopyLink },
        { icon: ExternalLink, label: "Ver como aluno", action: handlers.onOpenPreview },
      ]
    : [];

  const renderRow = (row: Row) => (
    <DropdownMenuItem
      key={row.label}
      onClick={row.action}
      className={cn(
        "group flex h-12 cursor-pointer items-center gap-3 rounded-[16px] px-2.5 text-[14.5px] font-semibold outline-none transition-colors",
        row.destructive ? "text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10" : "text-foreground/85 focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted",
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors", row.destructive ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground group-data-[highlighted]:bg-primary group-data-[highlighted]:text-primary-foreground")}>
        <row.icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="truncate">{row.label}</span>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Mais ações de ${title}`}
          className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", triggerClassName)}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-72 overflow-y-auto rounded-[22px] border border-border bg-popover p-2 shadow-[0_24px_48px_-24px_hsl(222_47%_11%/.35)]"
      >
        <div className="px-3 pb-2 pt-2">
          <p className="truncate font-heading text-[16px] font-extrabold tracking-[-0.02em] text-foreground">{title}</p>
          <p className="text-[13px] text-muted-foreground">{held ? "Tirada do ar pela equipe" : isLive ? "Publicada para os alunos" : "Rascunho, só você vê"}</p>
        </div>
        <DropdownMenuSeparator className="my-1 bg-border" />
        {manage.map(renderRow)}
        {share.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border" />
            {share.map(renderRow)}
          </>
        )}
        <DropdownMenuSeparator className="my-1 bg-border" />
        {renderRow({ icon: Trash2, label: "Excluir área", action: handlers.onDelete, destructive: true })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
