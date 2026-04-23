import { ArrowRight, BarChart3, Flame, Play, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { type CourseWithProgress, getCourseProgress } from "./memberHomePresentation";

type MemberHomeHeroProps = {
  greeting: string;
  displayName: string;
  coursesCount: number;
  overallPct: number;
  totalCompleted: number;
  totalLessons: number;
  inProgressCount: number;
  featuredCourse: CourseWithProgress | null;
};

export function MemberHomeHero({
  greeting,
  displayName,
  coursesCount,
  overallPct,
  totalCompleted,
  totalLessons,
  inProgressCount,
  featuredCourse,
}: MemberHomeHeroProps) {
  const featuredPct = featuredCourse ? getCourseProgress(featuredCourse) : 0;

  return (
    <section className="overflow-hidden rounded-[28px] border border-border/60 bg-card">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="relative overflow-hidden border-b border-border/50 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 opacity-60">
            {featuredCourse?.thumbnail_url ? (
              <img src={featuredCourse.thumbnail_url} alt={featuredCourse.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-card-inset" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/70" />
          </div>

          <div className="relative z-10 max-w-[720px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> biblioteca premium
            </div>
            <h1 className="mt-4 font-display text-[30px] font-black tracking-[-0.04em] text-foreground sm:text-[42px]">
              {greeting}, {displayName}
            </h1>
            <p className="mt-2 max-w-[520px] text-sm leading-relaxed text-muted-foreground/72">
              Continue rápido, sem ruído visual, com foco no que importa assistir agora.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {featuredCourse && (
                <Link
                  to={`/membros-area/curso/${featuredCourse.id}`}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {featuredPct > 0 ? "Continuar aula" : "Começar agora"}
                </Link>
              )}
              <a href="#member-catalog" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border/60 bg-card px-5 text-sm font-semibold text-foreground hover:border-primary/30">
                Ver catálogo <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {featuredCourse && (
              <div className="mt-6 rounded-2xl border border-border/60 bg-background/86 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Em destaque</p>
                    <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground">{featuredCourse.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground/68">
                      {featuredCourse.completedLessons}/{featuredCourse.totalLessons} aulas · {featuredCourse.modules.length} módulos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Progresso</p>
                    <p className="mt-2 font-numbers text-[28px] font-black tracking-[-0.05em] text-foreground tabular-nums">{featuredPct}%</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${featuredPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border/50">
          {[
            { label: "Cursos", value: coursesCount, meta: "acessos liberados", icon: Sparkles, tone: "text-primary" },
            { label: "Progresso", value: `${overallPct}%`, meta: `${totalCompleted}/${totalLessons || 0} aulas`, icon: BarChart3, tone: "text-foreground" },
            { label: "Ativos", value: inProgressCount, meta: "em andamento", icon: Flame, tone: "text-warning" },
            { label: "Foco", value: featuredCourse ? featuredCourse.category : "geral", meta: "trilha atual", icon: Play, tone: "text-success" },
          ].map((item) => (
            <div key={item.label} className="bg-card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">{item.label}</p>
                <item.icon className={cn("h-4 w-4", item.tone)} />
              </div>
              <p className={cn("mt-4 font-display text-[26px] font-black tracking-[-0.04em]", item.tone)}>{item.value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/65">{item.meta}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}