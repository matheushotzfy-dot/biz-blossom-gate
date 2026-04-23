import {
  CheckCircle2,
  Copy,
  Edit,
  Eye,
  EyeOff,
  ExternalLink,
  Layers,
  Link as LinkIcon,
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

interface ContentCourseCardProps {
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

export function ContentCourseCard({
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
}: ContentCourseCardProps) {
  const isLive = !!course.is_published;
  const initial = course.title.charAt(0).toUpperCase();

  return (
    <article
      onClick={onOpenBuilder}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-200 hover:border-primary/30 hover:bg-card-elevated"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border/60 bg-card-inset">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-secondary">
            <span className="font-display text-4xl font-black text-primary/70">{initial}</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur",
            isLive ? "border-success/20 bg-success/10 text-success" : "border-border/70 bg-card/85 text-muted-foreground",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-success" : "bg-muted-foreground/50")} />
            {isLive ? "Live" : "Draft"}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => event.stopPropagation()}
                className="h-8 w-8 rounded-full border border-border/70 bg-card/90 text-muted-foreground backdrop-blur hover:bg-card hover:text-foreground"
              >
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

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/75 backdrop-blur">
            <Layers className="h-3 w-3" /> {stats.modules} mod · {stats.lessons} aulas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/75 backdrop-blur">
            <Users className="h-3 w-3" /> {students}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">
          <h3 className="line-clamp-1 text-[14px] font-bold text-foreground">{course.title}</h3>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/85">
            {course.description || "Sem descrição definida."}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {productName ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <LinkIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{productName}</span>
            </span>
          ) : null}
          {course.category ? (
            <span className="inline-flex rounded-md border border-border/70 bg-card-inset px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {course.category}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/60 pt-4">
          <div>
            <div className="font-numbers text-lg font-black tabular-nums text-success">{revenueLabel}</div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">receita vinculada</p>
          </div>

          <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onOpenBuilder} className="h-8 rounded-lg border border-border/70 bg-card px-3 text-[11px] font-semibold hover:bg-accent">
              Builder
            </Button>
            {isLive ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopyLink}
                className={cn(
                  "h-8 w-8 rounded-lg border border-border/70 bg-card text-muted-foreground",
                  copied ? "border-success/30 bg-success/10 text-success" : "hover:bg-accent hover:text-foreground",
                )}
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}