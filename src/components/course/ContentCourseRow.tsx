import { memo } from "react";
import { Check, Copy, Link as LinkIcon, Pencil } from "lucide-react";

import { Money } from "@/components/home/Money";
import { StatusPill } from "@/components/seller-ui/tx";
import { CourseActionsMenu } from "@/components/course/CourseActionsMenu";
import { getCategoryLabel, type ContentCourse } from "@/components/course/contentPresentation";
import type { ContentCourseCardProps } from "@/components/course/ContentCourseCard";
import { cn } from "@/lib/utils";

const orb = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Colunas da lista no computador; o cabeçalho em Conteudo.tsx usa a mesma grade. */
export const COURSE_ROW_GRID = "lg:grid-cols-[minmax(0,1fr)_72px_72px_136px_172px] lg:items-center lg:gap-5";

type RowProps = Omit<ContentCourseCardProps, "course"> & { course: ContentCourse };

/** Linha da visão em lista: mesma informação do cartão, em uma faixa. Deve ficar dentro de um <ul>. */
export const ContentCourseRow = memo(function ContentCourseRow({ course, stats, productName, students, revenue, copied, ...handlers }: RowProps) {
  const isLive = !!course.is_published;
  const held = !!course.admin_hold_at;
  const initial = (course.title || "?").charAt(0).toUpperCase();
  const category = getCategoryLabel(course.category);

  return (
    <li className={cn("grid grid-cols-1 gap-4 px-5 py-4 transition-colors hover:bg-accent/40 sm:px-6", COURSE_ROW_GRID)}>
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={handlers.onOpenBuilder} aria-label={`Editar o conteúdo de ${course.title}`} className="relative h-14 w-[80px] shrink-0 sm:h-16 sm:w-[100px] overflow-hidden rounded-[14px] bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-heading text-[26px] font-extrabold text-primary/45">{initial}</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <h3 title={course.title} className="truncate font-heading text-[16.5px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">{course.title}</h3>
          {held ? (
            <p className="mt-0.5 truncate text-[13.5px] font-medium text-destructive" title={course.admin_hold_reason ?? undefined}>A equipe tirou do ar{course.admin_hold_reason ? `: ${course.admin_hold_reason}` : "."}</p>
          ) : (
            <p className="mt-0.5 truncate text-[13.5px] text-muted-foreground">{course.description || "Sem descrição."}</p>
          )}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            <StatusPill label={held ? "Tirada do ar" : isLive ? "Publicada" : "Rascunho"} tone={held ? "alert" : isLive ? "ok" : "idle"} className="h-6 !px-2.5 text-[12px]" />
            {productName ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[12.5px] font-semibold text-accent-foreground">
                <LinkIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{productName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-warning/15 px-2.5 py-0.5 text-[12.5px] font-semibold text-warning">Sem produto vinculado</span>
            )}
            {category && <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[12.5px] font-medium text-muted-foreground">{category}</span>}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 lg:contents">
        <div className="lg:text-right"><dt className="text-[12.5px] text-muted-foreground lg:sr-only">{stats.lessons === 1 ? "Aula" : "Aulas"}</dt><dd className="text-[16px] font-bold tabular-nums text-foreground">{stats.lessons}</dd></div>
        <div className="lg:text-right"><dt className="text-[12.5px] text-muted-foreground lg:sr-only">Alunos</dt><dd className="text-[16px] font-bold tabular-nums text-foreground">{students ?? "—"}</dd></div>
        <div className="lg:text-right"><dt className="text-[12.5px] text-muted-foreground lg:sr-only">Receita</dt><dd><Money value={revenue} className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground" centsClassName="opacity-65" /></dd></div>
      </dl>

      <div className="flex items-center gap-1 lg:justify-end">
        <button type="button" onClick={handlers.onOpenBuilder} className="vp-ghost h-10 px-4 text-[13.5px]">
          <Pencil className="h-4 w-4" strokeWidth={2.2} />
          Editar
        </button>
        {!isLive && <span aria-hidden className="hidden h-10 w-10 shrink-0 lg:block" />}
        {isLive && (
          <button type="button" onClick={handlers.onCopyLink} className={cn(orb, copied && "text-primary")} title="Copiar link da área" aria-label={copied ? "Link copiado" : "Copiar link da área"}>
            {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2} />}
          </button>
        )}
        <CourseActionsMenu title={course.title} isLive={isLive} held={held} handlers={handlers} triggerClassName="ml-auto lg:ml-0" />
      </div>
    </li>
  );
});
