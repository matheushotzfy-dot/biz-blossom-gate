import { useState } from "react";
import {
  Eye, EyeOff, Play, BookOpen, Lock, CheckCircle2, Clock,
  GraduationCap, Layers, ChevronRight, Smartphone, Monitor,
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
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
  const completedLessons = modules.reduce((a, m) => a + m.lessons.filter(l => l.video_url).length, 0);

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
            animate={{ width: 340, opacity: 1 }}
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
                <span className="text-xs font-display font-black text-foreground/60">Visão do Aluno</span>
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
                "rounded-2xl border border-border/20 bg-background overflow-hidden shadow-xl mx-auto transition-all duration-300",
                viewMode === "mobile" ? "max-w-[200px]" : "w-full"
              )}>
                {/* Browser chrome */}
                <div className="h-6 bg-card/80 border-b border-border/15 flex items-center gap-1.5 px-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive/30" />
                  <div className="h-1.5 w-1.5 rounded-full bg-warning/30" />
                  <div className="h-1.5 w-1.5 rounded-full bg-success/30" />
                  <div className="ml-2 h-3.5 flex-1 max-w-[100px] rounded-sm bg-muted/10 flex items-center justify-center">
                    <span className="text-[6px] text-muted-foreground/25 truncate px-1">área de membros</span>
                  </div>
                </div>

                {/* Course hero */}
                <div className="relative aspect-video bg-gradient-to-br from-primary/8 to-muted/5 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                  <div className="absolute bottom-2 left-2.5 right-2.5">
                    <p className={cn("font-display font-black text-foreground truncate", viewMode === "mobile" ? "text-[8px]" : "text-[10px]")}>{course.title}</p>
                    {course.description && <p className={cn("text-muted-foreground/50 line-clamp-1 mt-0.5", viewMode === "mobile" ? "text-[6px]" : "text-[7px]")}>{course.description}</p>}
                  </div>
                  {/* Stats */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={cn("rounded-md bg-card/80 backdrop-blur-xl px-1.5 py-0.5 font-display font-bold text-foreground/60 flex items-center gap-0.5", viewMode === "mobile" ? "text-[5px]" : "text-[7px]")}>
                      <Layers className="h-2 w-2 text-primary/40" /> {modules.length}
                    </span>
                    <span className={cn("rounded-md bg-card/80 backdrop-blur-xl px-1.5 py-0.5 font-display font-bold text-foreground/60 flex items-center gap-0.5", viewMode === "mobile" ? "text-[5px]" : "text-[7px]")}>
                      <Play className="h-2 w-2 text-info/40" /> {totalLessons}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                {totalLessons > 0 && (
                  <div className="px-2.5 py-2 border-b border-border/10">
                    <div className="flex justify-between mb-1">
                      <span className={cn("text-muted-foreground/40 font-display font-bold", viewMode === "mobile" ? "text-[5px]" : "text-[7px]")}>Progresso</span>
                      <span className={cn("text-primary/60 font-display font-black tabular-nums", viewMode === "mobile" ? "text-[5px]" : "text-[7px]")}>{Math.round((completedLessons / totalLessons) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-muted/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${(completedLessons / totalLessons) * 100}%` }} />
                    </div>
                  </div>
                )}

                {/* Modules & Lessons */}
                <div className="p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                  {modules.map((mod, mi) => (
                    <div key={mod.id} className="rounded-lg border border-border/10 overflow-hidden bg-card/30">
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <div className={cn("rounded-md bg-primary/8 flex items-center justify-center font-display font-black text-primary/50", viewMode === "mobile" ? "h-3.5 w-3.5 text-[6px]" : "h-4.5 w-4.5 text-[7px]")}>{mi + 1}</div>
                        <span className={cn("font-display font-bold text-foreground/60 truncate flex-1", viewMode === "mobile" ? "text-[6px]" : "text-[8px]")}>{mod.title}</span>
                        <ChevronRight className={cn("text-muted-foreground/15", viewMode === "mobile" ? "h-2 w-2" : "h-2.5 w-2.5")} />
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
                                <CheckCircle2 className={cn("text-success/40 shrink-0", viewMode === "mobile" ? "h-2 w-2" : "h-2.5 w-2.5")} />
                              ) : (
                                <div className={cn("rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground/20 font-display font-bold shrink-0", viewMode === "mobile" ? "h-2.5 w-2.5 text-[4px]" : "h-3 w-3 text-[5px]")}>{li + 1}</div>
                              )}
                              <span className={cn("font-display truncate flex-1", isSelected ? "font-bold text-primary/80" : "font-semibold text-foreground/40", viewMode === "mobile" ? "text-[5px]" : "text-[7px]")}>{lesson.title}</span>
                              {lesson.is_free && (
                                <span className={cn("bg-success/10 text-success/60 rounded px-1 py-px font-display font-bold", viewMode === "mobile" ? "text-[4px]" : "text-[5px]")}>FREE</span>
                              )}
                              {lesson.duration_minutes && (
                                <span className={cn("text-muted-foreground/20 font-display tabular-nums flex items-center gap-0.5", viewMode === "mobile" ? "text-[4px]" : "text-[6px]")}>
                                  <Clock className="h-1.5 w-1.5" />{lesson.duration_minutes}m
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {mod.lessons.length === 0 && (
                          <div className={cn("py-2 text-center text-muted-foreground/15 font-display", viewMode === "mobile" ? "text-[5px]" : "text-[7px]")}>
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
                <span className="text-[9px] text-muted-foreground/25 font-display tabular-nums">{totalLessons} aula{totalLessons !== 1 ? "s" : ""} · {modules.length} mód</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
