import { useState } from "react";
import {
  Eye, EyeOff, Play, BookOpen, Lock, CheckCircle2, Clock,
  GraduationCap, Layers, ChevronRight, Smartphone, Monitor,
  Flame, Trophy, BarChart3, ArrowRight, Home, Video, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

interface Module {
  id: string;
  title: string;
  lessons: { id: string; title: string; video_url: string | null; is_free: boolean; duration_minutes: number | null }[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
}

interface Props {
  course: Course;
  modules: Module[];
  selectedLessonId: string | null;
}

export default function StudentPreviewPanel({ course, modules, selectedLessonId }: Props) {
  const [open, setOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
  const lessonsWithVideo = modules.reduce((a, m) => a + m.lessons.filter(l => l.video_url).length, 0);
  const progressPct = totalLessons > 0 ? Math.round((lessonsWithVideo / totalLessons) * 100) : 0;
  const isMobile = viewMode === "mobile";

  const selectedLesson = modules.flatMap(m => m.lessons).find(l => l.id === selectedLessonId);
  const selectedModule = modules.find(m => m.lessons.some(l => l.id === selectedLessonId));

  return (
    <>
      {/* Toggle Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={() => setOpen(true)}
            className="absolute right-3 top-3 z-40 h-9 px-3.5 rounded-xl bg-card/90 backdrop-blur-xl border border-border/20 flex items-center gap-2 hover:bg-primary/5 hover:border-primary/20 transition-all shadow-lg shadow-foreground/[0.03] active:scale-[0.985] text-xs font-display font-bold text-muted-foreground/50 hover:text-primary/70"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="bg-card/30 backdrop-blur-xl border-l border-border/15 flex flex-col overflow-hidden shrink-0"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/15 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                  <Eye className="h-3.5 w-3.5 text-primary/50" />
                </div>
                <div>
                  <span className="text-xs font-display font-black text-foreground/60">Visão do Aluno</span>
                  <span className="text-[9px] text-muted-foreground/30 font-display block">Atualiza em tempo real</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Device toggle */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/10 border border-border/10">
                  {[
                    { id: "desktop" as const, icon: Monitor },
                    { id: "mobile" as const, icon: Smartphone },
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => setViewMode(v.id)}
                      className={cn(
                        "relative h-6 w-6 rounded-md flex items-center justify-center transition-all",
                        viewMode === v.id ? "text-primary bg-card shadow-sm" : "text-muted-foreground/20 hover:text-muted-foreground/40"
                      )}
                    >
                      <v.icon className="h-3 w-3" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/10 text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className={cn(
                "rounded-2xl border border-border/20 bg-background overflow-hidden shadow-xl mx-auto transition-all duration-500",
                isMobile ? "max-w-[220px]" : "w-full"
              )}>
                {/* Browser chrome */}
                <div className={cn("bg-card/80 border-b border-border/15 flex items-center gap-1.5 px-2.5", isMobile ? "h-5" : "h-6")}>
                  <div className={cn("rounded-full bg-destructive/30", isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
                  <div className={cn("rounded-full bg-warning/30", isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
                  <div className={cn("rounded-full bg-success/30", isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
                  <div className={cn("ml-2 flex-1 max-w-[120px] rounded-sm bg-muted/10 flex items-center justify-center", isMobile ? "h-3" : "h-3.5")}>
                    <span className={cn("text-muted-foreground/25 truncate px-1", isMobile ? "text-[4px]" : "text-[6px]")}>
                      {selectedLesson ? "curso / aula" : "área de membros"}
                    </span>
                  </div>
                </div>

                {/* ─── Preview Mode: Player or Home ─── */}
                {selectedLesson ? (
                  /* Player View */
                  <div className="space-y-0">
                    {/* Video area */}
                    <div className={cn("bg-foreground/5 flex items-center justify-center relative", isMobile ? "aspect-video" : "aspect-video")}>
                      {selectedLesson.video_url ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center">
                          <div className={cn("rounded-full bg-foreground/80 flex items-center justify-center shadow-xl", isMobile ? "h-6 w-6" : "h-8 w-8")}>
                            <Play className={cn("text-background fill-current ml-[1px]", isMobile ? "h-2.5 w-2.5" : "h-3 w-3")} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center p-2">
                          <FileText className={cn("text-muted-foreground/10", isMobile ? "h-4 w-4" : "h-6 w-6")} />
                          <span className={cn("text-muted-foreground/20 font-display", isMobile ? "text-[4px]" : "text-[6px]")}>Conteúdo texto</span>
                        </div>
                      )}
                    </div>

                    {/* Lesson info */}
                    <div className={cn("border-b border-border/10", isMobile ? "p-1.5" : "p-2.5")}>
                      {selectedModule && (
                        <div className="flex items-center gap-1 mb-1">
                          <Layers className={cn("text-primary/30", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
                          <span className={cn("text-muted-foreground/30 font-display font-bold uppercase tracking-wider", isMobile ? "text-[4px]" : "text-[5px]")}>{selectedModule.title}</span>
                        </div>
                      )}
                      <p className={cn("font-display font-black text-foreground leading-tight", isMobile ? "text-[7px]" : "text-[9px]")}>{selectedLesson.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={cn("rounded-md font-display font-bold flex items-center gap-1", isMobile ? "text-[4px]" : "text-[6px]")}>
                          {selectedLesson.video_url ? (
                            <span className="text-primary/40 flex items-center gap-0.5 bg-primary/5 px-1.5 py-0.5 rounded"><Video className={cn(isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} /> Vídeo</span>
                          ) : (
                            <span className="text-primary/40 flex items-center gap-0.5 bg-primary/5 px-1.5 py-0.5 rounded"><FileText className={cn(isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} /> Texto</span>
                          )}
                        </div>
                        {selectedLesson.duration_minutes && (
                          <span className={cn("text-muted-foreground/20 font-display tabular-nums flex items-center gap-0.5", isMobile ? "text-[4px]" : "text-[5px]")}>
                            <Clock className={cn(isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} /> {selectedLesson.duration_minutes}min
                          </span>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={cn("rounded bg-foreground text-background font-display font-black flex items-center gap-0.5", isMobile ? "text-[4px] px-1.5 py-0.5" : "text-[6px] px-2 py-0.5")}>
                          <CheckCircle2 className={cn(isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} /> Concluir
                        </div>
                        <div className={cn("rounded bg-foreground/5 text-foreground/40 font-display font-bold flex items-center gap-0.5", isMobile ? "text-[4px] px-1.5 py-0.5" : "text-[6px] px-2 py-0.5")}>
                          Próxima <ArrowRight className={cn(isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
                        </div>
                      </div>
                    </div>

                    {/* Sidebar modules mini */}
                    <div className={cn("space-y-1", isMobile ? "p-1.5" : "p-2")}>
                      {modules.map((mod, mi) => (
                        <div key={mod.id} className="rounded-lg border border-border/8 overflow-hidden bg-card/20">
                          <div className="flex items-center gap-1.5 px-2 py-1">
                            <div className={cn("rounded bg-primary/8 flex items-center justify-center font-display font-black text-primary/50", isMobile ? "h-3 w-3 text-[5px]" : "h-4 w-4 text-[6px]")}>{mi + 1}</div>
                            <span className={cn("font-display font-bold text-foreground/50 truncate flex-1", isMobile ? "text-[5px]" : "text-[7px]")}>{mod.title}</span>
                          </div>
                          <div className="border-t border-border/5">
                            {mod.lessons.slice(0, 4).map((lesson, li) => {
                              const isSelected = lesson.id === selectedLessonId;
                              return (
                                <div
                                  key={lesson.id}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-0.5 transition-all",
                                    isSelected ? "bg-primary/8" : ""
                                  )}
                                >
                                  {lesson.video_url ? (
                                    <CheckCircle2 className={cn("text-success/40 shrink-0", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
                                  ) : isSelected ? (
                                    <Play className={cn("text-primary fill-current shrink-0", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
                                  ) : (
                                    <div className={cn("rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground/20 font-display font-bold shrink-0", isMobile ? "h-2 w-2 text-[3px]" : "h-2.5 w-2.5 text-[4px]")}>{li + 1}</div>
                                  )}
                                  <span className={cn("font-display truncate flex-1", isSelected ? "font-bold text-primary/80" : "font-semibold text-foreground/30", isMobile ? "text-[4px]" : "text-[6px]")}>{lesson.title}</span>
                                </div>
                              );
                            })}
                            {mod.lessons.length > 4 && (
                              <p className={cn("px-2 py-0.5 text-muted-foreground/15 font-display", isMobile ? "text-[4px]" : "text-[5px]")}>+{mod.lessons.length - 4} mais</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Home / Catalog View */
                  <div className="space-y-0">
                    {/* Hero */}
                    <div className="relative overflow-hidden" style={{ aspectRatio: isMobile ? "16/10" : "21/9" }}>
                      <div className="w-full h-full bg-gradient-to-br from-primary/12 via-background to-background flex items-center justify-center relative">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
                        <GraduationCap className={cn("text-primary/10", isMobile ? "h-5 w-5" : "h-8 w-8")} />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className={cn("font-display font-black text-foreground truncate", isMobile ? "text-[7px]" : "text-[10px]")}>{course.title}</p>
                        {course.description && <p className={cn("text-muted-foreground/40 line-clamp-1 mt-0.5 font-display", isMobile ? "text-[5px]" : "text-[6px]")}>{course.description}</p>}
                        {/* Progress bar */}
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className={cn("rounded-full bg-foreground/10 overflow-hidden flex-1", isMobile ? "h-0.5" : "h-[3px]")}>
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                          </div>
                          <span className={cn("text-foreground/30 font-display font-bold tabular-nums", isMobile ? "text-[4px]" : "text-[5px]")}>{progressPct}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className={cn("rounded bg-foreground text-background font-display font-black flex items-center gap-0.5", isMobile ? "text-[4px] px-1.5 py-0.5" : "text-[6px] px-2 py-0.5")}>
                            <Play className={cn("fill-current", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} /> Assistir
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPI Stats */}
                    <div className={cn("grid gap-1 px-2 mt-1.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                      {[
                        { icon: BookOpen, label: "Cursos", value: "1", color: "primary" },
                        { icon: BarChart3, label: "Progresso", value: `${progressPct}%`, color: "info" },
                        ...(isMobile ? [] : [
                          { icon: Flame, label: "Aulas", value: String(lessonsWithVideo), color: "warning" },
                          { icon: Trophy, label: "Completos", value: "0", color: "success" },
                        ]),
                      ].map(kpi => (
                        <div key={kpi.label} className={cn("rounded-lg bg-card/60 border border-border/10 relative overflow-hidden", isMobile ? "p-1" : "p-1.5")}>
                          <div className={cn("absolute left-0 top-0 bottom-0 w-[1px]", `bg-${kpi.color}`)} />
                          <div className="flex items-center gap-1">
                            <div className={cn("rounded flex items-center justify-center", `bg-${kpi.color}/10`, isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5")}>
                              <kpi.icon className={cn(`text-${kpi.color}`, isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
                            </div>
                            <div>
                              <span className={cn(`text-${kpi.color} font-display font-black tabular-nums block leading-none`, isMobile ? "text-[5px]" : "text-[7px]")}>{kpi.value}</span>
                              <span className={cn("text-muted-foreground/25 font-display font-bold uppercase tracking-wider", isMobile ? "text-[3px]" : "text-[4px]")}>{kpi.label}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Modules & Lessons */}
                    <div className="p-2 space-y-1.5 mt-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={cn("rounded bg-card flex items-center justify-center", isMobile ? "h-3 w-3" : "h-4 w-4")}>
                          <Layers className={cn("text-foreground/40", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
                        </div>
                        <span className={cn("font-display font-black text-foreground tracking-tight", isMobile ? "text-[6px]" : "text-[8px]")}>Conteúdo</span>
                        <span className={cn("text-muted-foreground/25 font-display font-bold tabular-nums", isMobile ? "text-[4px]" : "text-[5px]")}>{totalLessons} aulas</span>
                      </div>
                      {modules.map((mod, mi) => (
                        <div key={mod.id} className="rounded-lg border border-border/10 overflow-hidden bg-card/30">
                          <div className="flex items-center gap-1.5 px-2 py-1.5">
                            <div className={cn("rounded-md bg-primary/8 flex items-center justify-center font-display font-black text-primary/50", isMobile ? "h-3.5 w-3.5 text-[5px]" : "h-4.5 w-4.5 text-[6px]")}>{mi + 1}</div>
                            <span className={cn("font-display font-bold text-foreground/60 truncate flex-1", isMobile ? "text-[5px]" : "text-[7px]")}>{mod.title}</span>
                            <ChevronRight className={cn("text-muted-foreground/15", isMobile ? "h-2 w-2" : "h-2.5 w-2.5")} />
                          </div>
                          <div className="border-t border-border/5">
                            {mod.lessons.map((lesson, li) => {
                              const isSelected = lesson.id === selectedLessonId;
                              return (
                                <div
                                  key={lesson.id}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 transition-all",
                                    isSelected ? "bg-primary/8" : "hover:bg-muted/5"
                                  )}
                                >
                                  {lesson.video_url ? (
                                    <CheckCircle2 className={cn("text-success/40 shrink-0", isMobile ? "h-2 w-2" : "h-2.5 w-2.5")} />
                                  ) : (
                                    <div className={cn("rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground/20 font-display font-bold shrink-0", isMobile ? "h-2.5 w-2.5 text-[4px]" : "h-3 w-3 text-[5px]")}>{li + 1}</div>
                                  )}
                                  <span className={cn("font-display truncate flex-1", isSelected ? "font-bold text-primary/80" : "font-semibold text-foreground/40", isMobile ? "text-[5px]" : "text-[6px]")}>{lesson.title}</span>
                                  {lesson.is_free && (
                                    <span className={cn("bg-success/10 text-success/60 rounded px-1 py-px font-display font-bold", isMobile ? "text-[4px]" : "text-[5px]")}>FREE</span>
                                  )}
                                  {lesson.duration_minutes && (
                                    <span className={cn("text-muted-foreground/20 font-display tabular-nums flex items-center gap-0.5", isMobile ? "text-[4px]" : "text-[5px]")}>
                                      <Clock className="h-1.5 w-1.5" />{lesson.duration_minutes}m
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {mod.lessons.length === 0 && (
                              <div className={cn("py-2 text-center text-muted-foreground/15 font-display", isMobile ? "text-[5px]" : "text-[6px]")}>
                                Sem aulas ainda
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {modules.length === 0 && (
                        <div className="py-6 text-center">
                          <GraduationCap className="h-6 w-6 text-muted-foreground/8 mx-auto mb-1" />
                          <p className="text-[7px] text-muted-foreground/20 font-display">Adicione módulos para ver o preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/10 bg-card/20">
              <div className="flex items-center justify-between">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-[9px] font-display font-bold px-2 py-1 rounded-md border",
                  course.is_published ? "text-success/60 bg-success/5 border-success/10" : "text-muted-foreground/30 bg-muted/5 border-border/10"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", course.is_published ? "bg-success animate-pulse" : "bg-muted-foreground/20")} />
                  {course.is_published ? "Live" : "Rascunho"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground/25 font-display tabular-nums">{totalLessons} aula{totalLessons !== 1 ? "s" : ""} · {modules.length} mód</span>
                  {progressPct > 0 && (
                    <span className={cn("text-[9px] font-display font-bold tabular-nums", progressPct === 100 ? "text-success/60" : "text-primary/50")}>{progressPct}%</span>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
