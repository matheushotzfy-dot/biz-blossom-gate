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
      className="group flex h-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-colors duration-200 hover:border-primary/50"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-card-elevated">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-card-elevated">
            <span className="font-display text-5xl font-black text-primary/60">{initial}</span>
          </div>
        )}

        {/* Bottom gradient overlay for legibility */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
            isLive
              ? "bg-success text-success-foreground"
              : "bg-card border border-border text-muted-foreground",
          )}>
            <span className={cn("h-1.5 w-1.5", isLive ? "bg-success-foreground" : "bg-muted-foreground/60")} />
            {isLive ? "Live" : "Draft"}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => event.stopPropagation()}
                className="h-8 w-8 rounded-none border border-border bg-card text-muted-foreground hover:bg-card-elevated hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-52 rounded-none border-border p-1">
              <DropdownMenuItem onClick={onOpenBuilder} className="gap-2.5 rounded-none px-2.5 py-2 text-[12px] font-semibold">
                <Edit className="h-3.5 w-3.5 text-primary" /> Builder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenEdit} className="gap-2.5 rounded-none px-2.5 py-2 text-[12px] font-semibold">
                <Edit className="h-3.5 w-3.5 text-primary" /> Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePublish} className="gap-2.5 rounded-none px-2.5 py-2 text-[12px] font-semibold">
                {isLive ? <EyeOff className="h-3.5 w-3.5 text-primary" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                {isLive ? "Despublicar" : "Publicar"}
              </DropdownMenuItem>
              {isLive ? (
                <DropdownMenuItem onClick={onOpenPreview} className="gap-2.5 rounded-none px-2.5 py-2 text-[12px] font-semibold">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" /> Abrir área
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator className="mx-1 my-1" />
              <DropdownMenuItem onClick={onDelete} className="gap-2.5 rounded-none px-2.5 py-2 text-[12px] font-semibold text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-3">
          <span className="inline-flex items-center gap-1 border border-white/20 bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/90">
            <Layers className="h-3 w-3" /> {stats.modules} mod · {stats.lessons} aulas
          </span>
          <span className="inline-flex items-center gap-1 border border-white/20 bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/90">
            <Users className="h-3 w-3" /> {students}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <h3 className="line-clamp-1 font-display text-[16px] font-black tracking-[-0.02em] text-foreground">{course.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/80">
            {course.description || "Sem descrição definida."}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {productName ? (
            <span className="inline-flex max-w-full items-center gap-1.5 border border-primary/30 bg-primary/[0.08] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <LinkIcon className="h-3 w-3 shrink-0" />
              <span className="truncate normal-case tracking-normal">{productName}</span>
            </span>
          ) : null}
          {course.category ? (
            <span className="inline-flex border border-border bg-card-elevated px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              {course.category}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="font-numbers text-[20px] font-black tabular-nums text-success leading-none">{revenueLabel}</div>
            <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">receita vinculada</p>
          </div>

          <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onOpenBuilder} className="h-8 rounded-none border border-border bg-card px-3 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-card-elevated">
              Builder
            </Button>
            {isLive ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopyLink}
                className={cn(
                  "h-8 w-8 rounded-none border border-border bg-card text-muted-foreground",
                  copied ? "border-success bg-success text-success-foreground" : "hover:bg-card-elevated hover:text-foreground",
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