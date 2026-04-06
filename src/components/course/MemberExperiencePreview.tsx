import { type ElementType } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Layers,
  Lock,
  Play,
  Sparkles,
  TrendingUp,
  Trophy,
  Video,
} from "lucide-react";
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
  progressPct?: number;
  completedLessons?: number;
  totalLessons?: number;
};

interface MemberExperiencePreviewProps {
  course: PreviewCourse;
  modules: PreviewModule[];
  selectedLessonId?: string | null;
  viewMode?: "desktop" | "mobile";
  className?: string;
}

const METRIC_STYLES = {
  primary: {
    rail: "bg-primary",
    chip: "bg-primary/10",
    icon: "text-primary",
    value: "text-primary",
  },
  info: {
    rail: "bg-info",
    chip: "bg-info/10",
    icon: "text-info",
    value: "text-info",
  },
  success: {
    rail: "bg-success",
    chip: "bg-success/10",
    icon: "text-success",
    value: "text-success",
  },
  warning: {
    rail: "bg-warning",
    chip: "bg-warning/10",
    icon: "text-warning",
    value: "text-warning",
  },
} as const;

type Tone = keyof typeof METRIC_STYLES;

type FlattenedLesson = {
  lesson: PreviewLesson;
  module: PreviewModule;
  index: number;
};

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AM";
  return words.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function buildFallbackLessons(title: string, count: number) {
  const cleanTitle = title.trim() || "Módulo";
  const templates = [
    `Visão geral de ${cleanTitle}`,
    `${cleanTitle} na prática`,
    `Checklist de ${cleanTitle}`,
  ];

  return Array.from({ length: Math.max(count, 1) }, (_, index) => ({
    id: `${cleanTitle}-${index}`.toLowerCase().replace(/\s+/g, "-"),
    title: templates[index] ?? `${cleanTitle} • Aula ${index + 1}`,
    video_url: index === 0 ? "configured" : null,
    is_free: index === 0,
    duration_minutes: 8 + index * 4,
    completed: index === 0,
  }));
}

function getModuleLessons(module: PreviewModule) {
  if (module.lessons && module.lessons.length > 0) return module.lessons;
  return buildFallbackLessons(module.title, module.lessonCount ?? 3);
}

function getModuleLessonCount(module: PreviewModule) {
  return module.lessonCount ?? getModuleLessons(module).length;
}

function flattenLessons(modules: PreviewModule[]) {
  return modules.flatMap((module) =>
    getModuleLessons(module).map((lesson, index) => ({ lesson, module, index })),
  );
}

function computeCompletedLessons(modules: PreviewModule[]) {
  return flattenLessons(modules).filter(({ lesson }) => lesson.completed || !!lesson.video_url).length;
}

function PreviewMetric({
  icon: Icon,
  label,
  value,
  tone,
  compact,
}: {
  icon: ElementType;
  label: string;
  value: string;
  tone: Tone;
  compact: boolean;
}) {
  const styles = METRIC_STYLES[tone];

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/10 bg-card/70", compact ? "p-2" : "p-3")}> 
      <div className={cn("absolute left-0 top-0 h-full w-1", styles.rail)} />
      <div className="flex items-center gap-2">
        <div className={cn("flex items-center justify-center rounded-xl", styles.chip, compact ? "h-7 w-7" : "h-9 w-9")}>
          <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", styles.icon)} />
        </div>
        <div className="min-w-0">
          <span className={cn("block font-display font-black leading-none", styles.value, compact ? "text-[10px]" : "text-xs")}>
            {value}
          </span>
          <span className={cn("block font-display font-bold uppercase tracking-[0.16em] text-muted-foreground/40", compact ? "text-[7px]" : "text-[8px]")}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ compact, title, suffix }: { compact: boolean; title: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className={cn("flex items-center justify-center rounded-xl bg-primary/10 text-primary", compact ? "h-6 w-6" : "h-7 w-7")}>
          <Sparkles className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </div>
        <div>
          <p className={cn("font-display font-black tracking-[-0.02em] text-foreground", compact ? "text-[9px]" : "text-xs")}>{title}</p>
          {suffix && <p className={cn("text-muted-foreground/40 font-display", compact ? "text-[7px]" : "text-[8px]")}>{suffix}</p>}
        </div>
      </div>
    </div>
  );
}

export function MemberExperiencePreview({
  course,
  modules,
  selectedLessonId = null,
  viewMode = "desktop",
  className,
}: MemberExperiencePreviewProps) {
  const compact = viewMode === "mobile";
  const frameWidth = compact ? "max-w-[272px]" : "w-full";
  const allLessons = flattenLessons(modules);
  const totalLessons = course.totalLessons ?? allLessons.length;
  const completedLessons = course.completedLessons ?? computeCompletedLessons(modules);
  const progressPct = course.progressPct ?? (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0);
  const selectedEntry = allLessons.find(({ lesson }) => lesson.id === selectedLessonId) ?? null;
  const selectedLesson = selectedEntry?.lesson ?? null;
  const selectedModule = selectedEntry?.module ?? null;
  const featuredLessons = (selectedModule ? getModuleLessons(selectedModule) : allLessons.map(({ lesson }) => lesson)).slice(0, 4);
  const displayModules = modules.slice(0, 4);
  const heroImage = selectedModule?.banner_url || course.thumbnail_url;
  const browserLabel = selectedLesson ? "player / aula" : "membros / início";
  const initials = getInitials(course.title || "Área de membros");

  const metrics = [
    { label: "Cursos", value: "1", tone: "primary" as Tone, icon: GraduationCap },
    { label: "Módulos", value: String(modules.length), tone: "info" as Tone, icon: Layers },
    { label: "Aulas", value: String(totalLessons), tone: "warning" as Tone, icon: BookOpen },
    { label: "Progresso", value: `${progressPct}%`, tone: "success" as Tone, icon: TrendingUp },
  ];

  return (
    <div className={cn(
      "overflow-hidden rounded-[1.75rem] border border-border/20 bg-background shadow-[0_24px_80px_-40px_hsl(var(--foreground)/0.45)]",
      frameWidth,
      className,
    )}>
      <div className={cn("flex items-center gap-1.5 border-b border-border/10 bg-card/80 px-3", compact ? "h-8" : "h-9")}>
        <div className={cn("rounded-full bg-destructive/40", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
        <div className={cn("rounded-full bg-warning/40", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
        <div className={cn("rounded-full bg-success/40", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
        <div className="ml-2 flex-1 rounded-full bg-muted/20 px-3 py-1">
          <p className={cn("truncate font-display font-bold text-muted-foreground/45", compact ? "text-[7px]" : "text-[8px]")}>{browserLabel}</p>
        </div>
      </div>

      <div className="relative bg-background">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-info/[0.03]" />

        <div className={cn("relative border-b border-border/10", compact ? "px-3 py-2.5" : "px-4 py-3")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={cn("flex items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15", compact ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs")}>
                <span className="font-display font-black tracking-[0.12em]">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className={cn("truncate font-display font-black tracking-[-0.02em] text-foreground", compact ? "text-[10px]" : "text-xs")}>{course.title || "Sua Área Premium"}</p>
                <p className={cn("truncate text-muted-foreground/45 font-display", compact ? "text-[7px]" : "text-[8px]")}>{course.category || "Workspace do aluno"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "rounded-full border px-2 py-1 font-display font-bold uppercase tracking-[0.16em]",
                compact ? "text-[6px]" : "text-[7px]",
                course.is_published ? "border-success/15 bg-success/10 text-success" : "border-border/10 bg-card/70 text-muted-foreground/45",
              )}>
                {course.is_published ? "Live" : "Setup"}
              </span>
              <div className={cn("rounded-full border border-border/10 bg-card/80 text-foreground/70 font-display font-black", compact ? "h-7 w-7 text-[8px]" : "h-8 w-8 text-[9px]", "flex items-center justify-center")}>
                A
              </div>
            </div>
          </div>
        </div>

        {selectedLesson ? (
          <div className={cn("space-y-3", compact ? "p-3" : "p-4")}>
            <div className="overflow-hidden rounded-[1.5rem] border border-border/10 bg-card/60">
              <div className="relative" style={{ aspectRatio: compact ? "16 / 10" : "16 / 9" }}>
                {heroImage ? (
                  <img src={heroImage} alt={course.title || "Prévia do curso"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/12 via-card to-card">
                    <GraduationCap className={cn("text-primary/15", compact ? "h-8 w-8" : "h-10 w-10")} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/10" />
                <div className={cn("absolute inset-x-0 bottom-0", compact ? "p-3" : "p-4")}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={cn("rounded-full bg-primary/12 px-2 py-1 font-display font-bold uppercase tracking-[0.14em] text-primary", compact ? "text-[6px]" : "text-[7px]")}>{selectedModule?.title || "Módulo"}</span>
                    {selectedLesson.is_free && <span className={cn("rounded-full bg-success/12 px-2 py-1 font-display font-bold uppercase tracking-[0.14em] text-success", compact ? "text-[6px]" : "text-[7px]")}>Free</span>}
                  </div>
                  <h3 className={cn("font-display font-black tracking-[-0.03em] text-foreground", compact ? "text-[12px]" : "text-sm")}>{selectedLesson.title}</h3>
                  <div className={cn("mt-2 flex flex-wrap items-center gap-2 text-muted-foreground/60 font-display", compact ? "text-[7px]" : "text-[8px]")}> 
                    <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-1"><Video className="h-3 w-3 text-primary" /> Vídeo</span>
                    {selectedLesson.duration_minutes ? <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-1"><Clock className="h-3 w-3 text-info" /> {selectedLesson.duration_minutes} min</span> : null}
                    <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-1"><Trophy className="h-3 w-3 text-warning" /> Aula atual</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className={cn("inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background font-display font-black", compact ? "px-3 py-1.5 text-[8px]" : "px-4 py-2 text-[9px]")}>
                      <CheckCircle2 className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} /> Concluir
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 rounded-xl border border-border/10 bg-card/80 text-foreground/75 font-display font-bold", compact ? "px-3 py-1.5 text-[8px]" : "px-4 py-2 text-[9px]")}>
                      Próxima <ChevronRight className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-4")}>
              {metrics.map((metric) => (
                <PreviewMetric key={metric.label} compact={compact} {...metric} />
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-border/10 bg-card/60 p-3">
              <SectionLabel compact={compact} title="Fila da aula" suffix="Como o aluno percebe a trilha" />
              <div className="mt-3 space-y-2">
                {featuredLessons.map((lesson, index) => {
                  const isCurrent = lesson.id === selectedLesson.id;
                  return (
                    <div
                      key={lesson.id}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition-all",
                        isCurrent ? "border-primary/20 bg-primary/10" : "border-border/10 bg-background/80",
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center rounded-xl font-display font-black",
                        compact ? "h-8 w-8 text-[8px]" : "h-9 w-9 text-[9px]",
                        isCurrent ? "bg-primary text-primary-foreground" : lesson.video_url ? "bg-success/10 text-success" : "bg-muted/20 text-muted-foreground/60",
                      )}>
                        {lesson.video_url ? <Play className={cn(compact ? "h-3 w-3 fill-current" : "h-3.5 w-3.5 fill-current")} /> : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate font-display font-bold", compact ? "text-[8px]" : "text-[9px]", isCurrent ? "text-primary" : "text-foreground/70")}>{lesson.title}</p>
                        <p className={cn("mt-0.5 text-muted-foreground/40 font-display", compact ? "text-[7px]" : "text-[8px]")}>Conteúdo disponível na sequência</p>
                      </div>
                      {isCurrent ? <span className={cn("rounded-full bg-primary/12 px-2 py-1 font-display font-bold text-primary", compact ? "text-[6px]" : "text-[7px]")}>Agora</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("space-y-3", compact ? "p-3" : "p-4")}>
            <div className="overflow-hidden rounded-[1.5rem] border border-border/10 bg-card/60">
              <div className="relative" style={{ aspectRatio: compact ? "16 / 11" : "21 / 9" }}>
                {heroImage ? (
                  <img src={heroImage} alt={course.title || "Capa do curso"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-card to-card">
                    <GraduationCap className={cn("text-primary/15", compact ? "h-9 w-9" : "h-12 w-12")} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/10" />
                <div className={cn("absolute inset-0 bg-gradient-to-r from-background/85 via-background/35 to-transparent", compact ? "" : "")} />
                <div className={cn("absolute inset-x-0 bottom-0", compact ? "p-3" : "p-4")}>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {course.category ? <span className={cn("rounded-full bg-primary/12 px-2 py-1 font-display font-bold uppercase tracking-[0.14em] text-primary", compact ? "text-[6px]" : "text-[7px]")}>{course.category}</span> : null}
                    {course.productName ? <span className={cn("rounded-full bg-info/12 px-2 py-1 font-display font-bold uppercase tracking-[0.14em] text-info", compact ? "text-[6px]" : "text-[7px]")}>{course.productName}</span> : null}
                  </div>
                  <h3 className={cn("max-w-[80%] font-display font-black tracking-[-0.03em] text-foreground", compact ? "text-[12px]" : "text-base")}>{course.title || "Área de membros premium"}</h3>
                  <p className={cn("mt-1 max-w-[85%] text-muted-foreground/70 font-display line-clamp-2", compact ? "text-[8px]" : "text-[9px]")}>{course.description || "Configure sua promessa, banner e módulos para transformar a primeira impressão do aluno."}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className={cn("inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background font-display font-black", compact ? "px-3 py-1.5 text-[8px]" : "px-4 py-2 text-[9px]")}>
                      <Play className={cn(compact ? "h-3 w-3 fill-current" : "h-3.5 w-3.5 fill-current")} /> Continuar
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 rounded-xl border border-border/10 bg-card/80 text-foreground/75 font-display font-bold", compact ? "px-3 py-1.5 text-[8px]" : "px-4 py-2 text-[9px]")}>
                      <Lock className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} /> Conteúdos
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className={cn("font-display font-black text-primary", compact ? "text-[8px]" : "text-[9px]")}>{progressPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-4")}>
              {metrics.map((metric) => (
                <PreviewMetric key={metric.label} compact={compact} {...metric} />
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-border/10 bg-card/60 p-3">
              <SectionLabel compact={compact} title="Continue assistindo" suffix="Abertura imediata para o aluno" />
              <div className="mt-3 grid gap-2">
                {featuredLessons.slice(0, compact ? 2 : 3).map((lesson) => (
                  <div key={lesson.id} className="flex items-center gap-2 rounded-2xl border border-border/10 bg-background/80 px-2.5 py-2">
                    <div className={cn("flex items-center justify-center rounded-xl bg-primary/10 text-primary", compact ? "h-8 w-8" : "h-9 w-9")}>
                      <Play className={cn(compact ? "h-3 w-3 fill-current" : "h-3.5 w-3.5 fill-current")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-display font-bold text-foreground/80", compact ? "text-[8px]" : "text-[9px]")}>{lesson.title}</p>
                      <div className={cn("mt-0.5 flex items-center gap-2 text-muted-foreground/45 font-display", compact ? "text-[7px]" : "text-[8px]")}> 
                        {lesson.duration_minutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 text-info" /> {lesson.duration_minutes} min</span> : null}
                        {lesson.is_free ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Free</span> : null}
                      </div>
                    </div>
                    <ChevronRight className={cn("text-muted-foreground/30", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/10 bg-card/60 p-3">
              <SectionLabel compact={compact} title="Trilhos do catálogo" suffix="Módulos com leitura instantânea" />
              <div className="mt-3 space-y-2">
                {displayModules.length > 0 ? (
                  displayModules.map((module, index) => (
                    <div key={module.id} className="overflow-hidden rounded-2xl border border-border/10 bg-background/80">
                      <div className="flex items-center gap-2 px-2.5 py-2.5">
                        <div className={cn("flex items-center justify-center rounded-xl bg-primary/10 text-primary font-display font-black", compact ? "h-8 w-8 text-[8px]" : "h-9 w-9 text-[9px]")}>{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate font-display font-bold text-foreground/80", compact ? "text-[8px]" : "text-[9px]")}>{module.title}</p>
                          <p className={cn("mt-0.5 text-muted-foreground/40 font-display", compact ? "text-[7px]" : "text-[8px]")}>{getModuleLessonCount(module)} aulas organizadas</p>
                        </div>
                        <span className={cn("rounded-full bg-warning/10 px-2 py-1 font-display font-bold text-warning", compact ? "text-[6px]" : "text-[7px]")}>{index === 0 ? "Topo" : "Rail"}</span>
                      </div>
                      <div className="grid gap-1 border-t border-border/10 px-2.5 py-2">
                        {getModuleLessons(module).slice(0, 3).map((lesson) => (
                          <div key={lesson.id} className="flex items-center gap-2 rounded-xl bg-card/70 px-2 py-1.5">
                            <div className={cn("flex items-center justify-center rounded-full bg-muted/20 text-muted-foreground/60", compact ? "h-5 w-5 text-[7px]" : "h-6 w-6 text-[8px]")}>{lesson.video_url ? <Play className={cn(compact ? "h-2.5 w-2.5 fill-current" : "h-3 w-3 fill-current")} /> : index + 1}</div>
                            <span className={cn("truncate font-display font-semibold text-foreground/65", compact ? "text-[7px]" : "text-[8px]")}>{lesson.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/15 bg-background/70 px-3 py-6 text-center">
                    <GraduationCap className="mx-auto h-8 w-8 text-primary/20" />
                    <p className={cn("mt-2 font-display font-bold text-foreground/50", compact ? "text-[8px]" : "text-[9px]")}>Seu catálogo vai nascer aqui</p>
                    <p className={cn("mt-1 text-muted-foreground/35 font-display", compact ? "text-[7px]" : "text-[8px]")}>Adicione módulos para ligar o preview completo.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/10 bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className={cn("font-display font-black text-foreground/75", compact ? "text-[9px]" : "text-xs")}>Momento de retenção</p>
                  <p className={cn("mt-1 text-muted-foreground/40 font-display", compact ? "text-[7px]" : "text-[8px]")}>Uma home com cara de produto premium, não de dashboard genérico.</p>
                </div>
                <div className={cn("rounded-2xl bg-primary/10 text-primary", compact ? "p-2" : "p-2.5")}>
                  <Flame className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
