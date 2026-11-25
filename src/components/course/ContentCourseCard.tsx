import { memo } from "react";
import { Check, Copy, ExternalLink, Link as LinkIcon, Pencil } from "lucide-react";

import { Money } from "@/components/home/Money";
import { StatusPill } from "@/components/seller-ui/tx";
import { CourseActionsMenu, type CourseMenuHandlers } from "@/components/course/CourseActionsMenu";
import { getCategoryLabel, type ContentCourse, type ContentCourseStats } from "@/components/course/contentPresentation";
import { cn } from "@/lib/utils";

export interface ContentCourseCardProps extends CourseMenuHandlers {
  course: ContentCourse;
  stats: ContentCourseStats;
  productName?: string;
  /** null = ainda não carregou ou falhou ao carregar. */
  students: number | null;
  revenue: number;
  copied: boolean;
}

const orb = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export const ContentCourseCard = memo(function ContentCourseCard({ course, stats, productName, students, revenue, copied, ...handlers }: ContentCourseCardProps) {
  const isLive = !!course.is_published;
  const initial = (course.title || "?").charAt(0).toUpperCase();
  const category = getCategoryLabel(course.category);

  return (
    <article className="vp-sheet group flex h-full flex-col overflow-hidden transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <button
        type="button"
        onClick={handlers.onOpenBuilder}
        aria-label={`Editar o conteúdo de ${course.title}`}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-accent text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <span aria-hidden className="font-heading text-[64px] font-extrabold leading-none tracking-[-0.05em] text-primary/35">{initial}</span>
          </span>
        )}
        <StatusPill label={isLive ? "Publicada" : "Rascunho"} tone={isLive ? "ok" : "idle"} className="absolute left-3.5 top-3.5 bg-card/95 shadow-sm backdrop-blur-sm" />
      </button>

      <div className="flex flex-1 flex-col p-5">
        <h3 title={course.title} className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{course.title}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.8em] text-[13.5px] leading-snug text-muted-foreground">{course.description || "Sem descrição."}</p>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
          <div className="flex items-baseline gap-1.5"><dt className="sr-only">Módulos</dt><dd className="font-bold tabular-nums text-foreground">{stats.modules}</dd><span className="text-muted-foreground">{stats.modules === 1 ? "módulo" : "módulos"}</span></div>
          <div className="flex items-baseline gap-1.5"><dt className="sr-only">Aulas</dt><dd className="font-bold tabular-nums text-foreground">{stats.lessons}</dd><span className="text-muted-foreground">{stats.lessons === 1 ? "aula" : "aulas"}</span></div>
          <div className="flex items-baseline gap-1.5"><dt className="sr-only">Alunos</dt><dd className="font-bold tabular-nums text-foreground">{students ?? "—"}</dd><span className="text-muted-foreground">{students === 1 ? "aluno" : "alunos"}</span></div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {productName ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[12.5px] font-semibold text-accent-foreground">
              <LinkIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{productName}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[12.5px] font-semibold text-warning">Sem produto vinculado</span>
          )}
          {category && <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground">{category}</span>}
        </div>

        <div className="mt-auto pt-5">
          <div className="border-t border-border pt-4">
            <p className="text-[12.5px] text-muted-foreground">Receita do produto vinculado</p>
            <Money value={revenue} className="mt-1 block text-[24px] font-extrabold leading-none tracking-[-0.04em] text-foreground" centsClassName="opacity-65" />
          </div>
          <div className="mt-4 flex items-center gap-1">
            <button type="button" onClick={handlers.onOpenBuilder} className="vp-cta h-10 px-4 text-[13.5px]">
              <Pencil className="h-4 w-4" strokeWidth={2.3} />
              Editar conteúdo
            </button>
            <div className="ml-auto flex items-center">
              {isLive && (
                <>
                  <button type="button" onClick={handlers.onCopyLink} className={cn(orb, copied && "text-primary")} title="Copiar link da área" aria-label={copied ? "Link copiado" : "Copiar link da área"}>
                    {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2} />}
                  </button>
                  <button type="button" onClick={handlers.onOpenPreview} className={orb} title="Ver como aluno" aria-label="Ver como aluno">
                    <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                </>
              )}
              <CourseActionsMenu title={course.title} isLive={isLive} handlers={handlers} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
