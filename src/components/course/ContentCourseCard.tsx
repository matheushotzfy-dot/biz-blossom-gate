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
  Settings2,
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
  const completionPct = stats.lessons > 0 ? Math.round((stats.lessons / Math.max(stats.lessons, 1)) * 100) : 0;

  return (
    <article
      onClick={onOpenBuilder}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-all duration-200 hover:border-primary/40"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-card-elevated">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-card-elevated">
            <span className="font-display text-5xl font-black text-primary/20">{initial}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent pointer-events-none"
        />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
              isLive
                ? "bg-success text-success-foreground"
                : "bg-muted border border-border text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isLive ? "bg-success-foreground animate-pulse" : "bg-muted-foreground/60"
              )}
            />
            {isLive ? "Live" : "Draft"}
          </span>
        </div>

        {/* Actions */}
        <div className="absolute top-3 right-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => event.stopPropagation()}
                className="h-8 w-8 rounded-none border border-border/60 bg-background/60 backdrop-blur-sm text-foreground hover:bg-background/80"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-48 rounded-none border-border p-1">
              <DropdownMenuItem
                onClick={onOpenBuilder}
                className="gap-2.5 rounded-none px-3 py-2.5 text-[12px] font-semibold"
              >
                <Settings2 className="h-3.5 w-3.5 text-primary" /> Abrir Builder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onOpenEdit}
                className="gap-2.5 rounded-none px-3 py-2.5 text-[12px] font-semibold"
              >
                <Edit className="h-3.5 w-3.5 text-primary" /> Editar detalhes
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onTogglePublish}
                className="gap-2.5 rounded-none px-3 py-2.5 text-[12px] font-semibold"
              >
                {isLive ? (
                  <EyeOff className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-primary" />
                )}
                {isLive ? "Despublicar" : "Publicar"}
              </DropdownMenuItem>
              {isLive && (
                <DropdownMenuItem
                  onClick={onOpenPreview}
                  className="gap-2.5 rounded-none px-3 py-2.5 text-[12px] font-semibold"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-primary" /> Abrir área
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="mx-1 my-1" />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2.5 rounded-none px-3 py-2.5 text-[12px] font-semibold text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Bottom stats overlay */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
          <span className="inline-flex items-center gap-1.5 border border-foreground/15 bg-background/70 backdrop-blur-sm px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/90">
            <Layers className="h-2.5 w-2.5" /> {stats.modules} mod · {stats.lessons} aulas
          </span>
          <span className="inline-flex items-center gap-1.5 border border-foreground/15 bg-background/70 backdrop-blur-sm px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/90">
            <Users className="h-2.5 w-2.5" /> {students}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1 min-w-0">
          <h3 className="line-clamp-1 font-display text-[15px] font-black tracking-[-0.02em] text-foreground leading-tight">
            {course.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground/75">
            {course.description || "Sem descrição definida."}
          </p>
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {productName && (
            <span className="inline-flex max-w-full items-center gap-1.5 border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-bold text-primary">
              <LinkIcon className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{productName}</span>
            </span>
          )}
          {course.category && (
            <span className="inline-flex border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
              {course.category}
            </span>
          )}
        </div>

        {/* Revenue + actions */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
          <div>
            <div className="font-numbers text-[18px] font-black tabular-nums text-success leading-none">
              {revenueLabel}
            </div>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
              receita vinculada
            </p>
          </div>

          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenBuilder}
              className="h-8 rounded-none border border-border bg-card px-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
            >
              <Settings2 className="h-3 w-3 mr-1" /> Builder
            </Button>
            {isLive && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopyLink}
                className={cn(
                  "h-8 w-8 rounded-none border",
                  copied
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                {copied ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
