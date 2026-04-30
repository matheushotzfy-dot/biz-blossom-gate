import {
  Calendar,
  CheckCircle2,
  Copy,
  Edit,
  Eye,
  EyeOff,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  Lock,
  MoreHorizontal,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ContentCourse, ContentCourseStats } from "@/components/course/contentPresentation";

interface ContentCourseRowProps {
  course: ContentCourse;
  stats: ContentCourseStats;
  productName?: string;
  students: number;
  revenueLabel: string;
  copied: boolean;
  onOpenBuilder: () => void;
  onOpenEdit: () => void;
  onTogglePublish: () => void;
  onCopyLink: () => void;
  onOpenPreview: () => void;
  onDelete: () => void;
}

export function ContentCourseRow({
  course,
  stats,
  productName,
  students,
  revenueLabel,
  copied,
  onOpenBuilder,
  onOpenEdit,
  onTogglePublish,
  onCopyLink,
  onOpenPreview,
  onDelete,
}: ContentCourseRowProps) {
  const isLive = !!course.is_published;
  const initial = course.title.charAt(0).toUpperCase();

  return (
    <article
      onClick={onOpenBuilder}
      className="group grid cursor-pointer grid-cols-1 gap-4 border-b border-border/70 px-4 py-3.5 transition-colors hover:bg-accent/35 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.05fr)_96px_96px_132px_112px] md:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-12 w-[84px] shrink-0 overflow-hidden border border-border bg-card-inset">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-card-elevated">
              <span className="font-display text-base font-black text-primary">{initial}</span>
            </div>
          )}
          <div className={cn(
            "absolute left-1.5 top-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
            isLive ? "bg-success text-success-foreground" : "bg-card border border-border text-muted-foreground",
          )}>
            <span className={cn("h-1 w-1", isLive ? "bg-success-foreground" : "bg-muted-foreground")} />
            {isLive ? "Live" : "Draft"}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13px] font-bold text-foreground">{course.title}</h3>
            {course.category ? (
              <span className="hidden border border-border bg-card-elevated px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:inline-flex">
                {course.category}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/85">
            {course.description || "Sem descrição definida."}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/75">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(course.created_at).toLocaleDateString("pt-BR")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {stats.modules} módulos · {stats.lessons} aulas
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        {productName ? (
          <span className="inline-flex max-w-full items-center gap-1.5 border border-primary bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
            <LinkIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{productName}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 border border-dashed border-border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <Lock className="h-3 w-3" />
            Sem produto
          </span>
        )}
      </div>

      <div className="text-right">
        <div className="font-numbers text-base font-black tabular-nums text-foreground">{stats.lessons}</div>
        <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">aulas</div>
      </div>

      <div className="text-right">
        <div className={cn("font-numbers text-base font-black tabular-nums", students > 0 ? "text-foreground" : "text-muted-foreground/40")}>{students}</div>
        <div className="inline-flex items-center justify-end gap-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          <Users className="h-2.5 w-2.5" /> ativos
        </div>
      </div>

      <div className="text-right">
        <div className="font-numbers text-sm font-black tabular-nums text-success">{revenueLabel}</div>
        <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">receita</div>
      </div>

      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
        {isLive ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyLink}
            className={cn(
              "h-8 w-8 rounded-none border border-border bg-card text-muted-foreground",
              copied ? "border-success bg-success text-success-foreground" : "hover:border-primary hover:text-primary",
            )}
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-52 rounded-xl p-1.5">
            <DropdownMenuItem onClick={onOpenBuilder} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold">
              <Edit className="h-3.5 w-3.5 text-primary" /> Builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenEdit} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold">
              <Edit className="h-3.5 w-3.5 text-primary" /> Detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePublish} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold">
              {isLive ? <EyeOff className="h-3.5 w-3.5 text-primary" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
              {isLive ? "Despublicar" : "Publicar"}
            </DropdownMenuItem>
            {isLive ? (
              <DropdownMenuItem onClick={onOpenPreview} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold">
                <ExternalLink className="h-3.5 w-3.5 text-primary" /> Abrir área
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator className="mx-1 my-1" />
            <DropdownMenuItem onClick={onDelete} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}