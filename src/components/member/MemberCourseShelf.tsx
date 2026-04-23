import { BookOpen, Play, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { type CourseWithProgress, getCourseProgress, getCourseStatus } from "./memberHomePresentation";

type MemberCourseShelfProps = {
  title: string;
  subtitle?: string;
  courses: CourseWithProgress[];
};

export function MemberCourseShelf({ title, subtitle, courses }: MemberCourseShelfProps) {
  if (courses.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] font-black tracking-[-0.03em] text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-[12px] text-muted-foreground/65">{subtitle}</p>}
        </div>
        <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
          {courses.length} itens
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => {
          const progress = getCourseProgress(course);
          const status = getCourseStatus(course);

          return (
            <Link
              key={course.id}
              to={`/membros-area/curso/${course.id}`}
              className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/35"
            >
              <div className="relative aspect-[16/9] overflow-hidden border-b border-border/40 bg-card-inset">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground/25" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/92 via-background/24 to-transparent" />
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/88 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/80">
                  {status === "completed" ? <Trophy className="h-3 w-3 text-success" /> : <Play className="h-3 w-3 text-primary fill-current" />}
                  {status === "completed" ? "Concluído" : progress > 0 ? `${progress}%` : "Novo"}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-background/20">
                  <div className={cn("h-full", status === "completed" ? "bg-success" : "bg-primary")} style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-1 text-[15px] font-bold tracking-[-0.02em] text-foreground group-hover:text-primary">{course.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/68">{course.description || "Conteúdo liberado para assistir no seu ritmo."}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Aulas</p>
                    <p className="mt-1 text-[12px] font-semibold text-foreground">{course.totalLessons}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Módulos</p>
                    <p className="mt-1 text-[12px] font-semibold text-foreground">{course.modules.length}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Categoria</p>
                    <p className="mt-1 line-clamp-1 text-[12px] font-semibold capitalize text-foreground">{course.category}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}