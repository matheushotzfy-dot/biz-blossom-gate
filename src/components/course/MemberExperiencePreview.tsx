import { GraduationCap, Lock, Play, Video } from "lucide-react";
import { getCategoryLabel } from "@/components/course/contentPresentation";
import { cn } from "@/lib/utils";

export type PreviewLesson = {
  id: string;
  title: string;
  video_url: string | null;
  is_free?: boolean;
  duration_minutes?: number | null;
  completed?: boolean;
};

export type PreviewModule = {
  id: string;
  title: string;
  banner_url?: string | null;
  lessonCount?: number;
  lessons?: PreviewLesson[];
};

export type PreviewCourse = {
  id?: string;
  title: string;
  description?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
  is_published?: boolean;
  productName?: string | null;
};

interface MemberExperiencePreviewProps {
  course: PreviewCourse;
  modules: PreviewModule[];
  selectedLessonId?: string | null;
  viewMode?: "desktop" | "mobile";
  className?: string;
}

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/**
 * Aproximação de como o aluno enxerga a área: capa e módulos quando nenhuma aula está aberta,
 * player e lista do módulo quando há uma aula selecionada. Usa só o conteúdo real do curso.
 * Os valores dentro da moldura ficam em escala reduzida de propósito (é uma miniatura).
 */
export function MemberExperiencePreview({ course, modules, selectedLessonId = null, viewMode = "desktop", className }: MemberExperiencePreviewProps) {
  const mobile = viewMode === "mobile";
  const selected = (() => {
    if (!selectedLessonId) return null;
    for (const m of modules) {
      const idx = (m.lessons ?? []).findIndex((l) => l.id === selectedLessonId);
      if (idx !== -1) return { module: m, lesson: (m.lessons ?? [])[idx], index: idx };
    }
    return null;
  })();
  const cover = selected?.module.banner_url || course.thumbnail_url || null;
  const category = getCategoryLabel(course.category);

  return (
    <div className={cn("mx-auto overflow-hidden rounded-[22px] border border-border bg-background", mobile ? "w-[300px] max-w-full" : "w-full", className)}>
      <div className="flex items-center gap-2.5 border-b border-border bg-card px-3.5 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-accent-foreground">{initialsOf(course.title)}</span>
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-foreground">{course.title || "Sua área de membros"}</p>
      </div>

      {selected ? (
        <div className="space-y-3.5 p-3.5">
          <div className="relative aspect-video overflow-hidden rounded-[14px] bg-accent">
            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center"><GraduationCap className="h-9 w-9 text-primary/30" /></span>}
            <span className="absolute inset-0 grid place-items-center bg-foreground/10">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-card/95 text-primary shadow-sm"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] text-muted-foreground">{selected.module.title}</p>
            <h3 className="mt-0.5 break-words font-heading text-[18px] font-extrabold leading-tight tracking-[-0.025em] text-foreground">{selected.lesson.title || "Aula sem título"}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
              {selected.lesson.duration_minutes ? <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{selected.lesson.duration_minutes} min</span> : null}
              {selected.lesson.is_free ? <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground">Aula grátis</span> : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><Lock className="h-3 w-3" />Só para quem comprou</span>}
              {!selected.lesson.video_url && <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-warning"><Video className="h-3 w-3" />Sem vídeo ainda</span>}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-foreground">Aulas deste módulo</p>
            <ul className="space-y-1">
              {(selected.module.lessons ?? []).map((l, i) => {
                const current = l.id === selected.lesson.id;
                return (
                  <li key={l.id} className={cn("flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3", current ? "bg-accent" : "bg-muted/60")}>
                    <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums", current ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{i + 1}</span>
                    <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-semibold", current ? "text-accent-foreground" : "text-foreground")}>{l.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5 p-3.5">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-accent">
            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center"><GraduationCap className="h-10 w-10 text-primary/30" /></span>}
          </div>
          <div className="min-w-0">
            <h3 className="break-words font-heading text-[18px] font-extrabold leading-tight tracking-[-0.025em] text-foreground">{course.title || "Sua área de membros"}</h3>
            {course.description ? <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-muted-foreground">{course.description}</p> : null}
            {(category || course.productName) && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
                {category && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{category}</span>}
                {course.productName && <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground">{course.productName}</span>}
              </div>
            )}
          </div>
          {modules.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border px-4 py-7 text-center">
              <p className="text-[13.5px] font-semibold text-foreground">Nada para mostrar ainda</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">Crie módulos e aulas para ver como o aluno enxerga a área.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modules.map((m, i) => {
                const lessons = m.lessons ?? [];
                return (
                  <div key={m.id} className="overflow-hidden rounded-[14px] border border-border bg-card">
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold tabular-nums text-accent-foreground">{i + 1}</span>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{m.title}</p>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{lessons.length} {lessons.length === 1 ? "aula" : "aulas"}</span>
                    </div>
                    {lessons.length > 0 && (
                      <ul className="space-y-0.5 border-t border-border px-3 py-2">
                        {lessons.map((l) => (
                          <li key={l.id} className="flex items-center gap-2 py-0.5 text-[12.5px] text-muted-foreground">
                            <Play className={cn("h-3 w-3 shrink-0", l.video_url ? "fill-current text-primary" : "text-muted-foreground/50")} />
                            <span className="truncate">{l.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
