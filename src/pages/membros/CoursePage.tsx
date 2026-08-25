import { useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, CheckCircle2, ChevronLeft, ChevronDown, ChevronRight, BookOpen, Clock, ArrowLeft, ArrowRight, FileText, Video, Trophy, Info, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Course = { id: string; title: string; description: string | null; thumbnail_url: string | null };
type Module = { id: string; title: string; description: string | null; banner_url: string | null; sort_order: number; lessons: Lesson[] };
type Lesson = { id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number; is_free: boolean; sort_order: number; module_id: string };
type Progress = { lesson_id: string; completed: boolean; progress_seconds: number };

function extractYouTubeId(url: string): string | null {
 const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
 return m ? m[1] : null;
}

function extractVimeoId(url: string): string | null {
 const m = url.match(/vimeo\.com\/(\d+)/);
 return m ? m[1] : null;
}

function VideoPlayer({ url }: { url: string }) {
 const ytId = extractYouTubeId(url);
 if (ytId) {
 return (
 <iframe
 src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
 className="w-full h-full"
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 allowFullScreen
 />
 );
 }

 const vimeoId = extractVimeoId(url);
 if (vimeoId) {
 return (
 <iframe
 src={`https://player.vimeo.com/video/${vimeoId}?byline=0&portrait=0`}
 className="w-full h-full"
 allow="autoplay; fullscreen; picture-in-picture"
 allowFullScreen
 />
 );
 }

 // Generic embed fallback
 return (
 <iframe src={url} className="w-full h-full" allowFullScreen />
 );
}

export default function CoursePage() {
 const { courseId } = useParams();
 const [searchParams] = useSearchParams();
 const { user } = useAuth();
 const [course, setCourse] = useState<Course | null>(null);
 const [modules, setModules] = useState<Module[]>([]);
 const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
 const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
 const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!courseId || !user) return;
 loadCourse();
 }, [courseId, user]);

 const loadCourse = async () => {
 if (!courseId || !user) return;

 const { data: courseData } = await supabase
 .from("courses").select("id, title, description, thumbnail_url").eq("id", courseId).maybeSingle();
 if (!courseData) { setLoading(false); return; }
 setCourse(courseData);

 const { data: modulesData } = await supabase
 .from("modules").select("id, title, description, banner_url, sort_order").eq("course_id", courseId).order("sort_order");
 if (!modulesData) { setLoading(false); return; }

 const moduleIds = modulesData.map(m => m.id);
 let lessonsData: Lesson[] = [];
 if (moduleIds.length > 0) {
 const { data } = await supabase
 .from("lessons").select("id, title, description, video_url, duration_minutes, is_free, sort_order, module_id")
 .in("module_id", moduleIds).order("sort_order");
 if (data) lessonsData = data as Lesson[];
 }

 const enrichedModules: Module[] = modulesData.map(m => ({
 ...m,
 lessons: lessonsData.filter(l => l.module_id === m.id),
 }));
 setModules(enrichedModules);

 // Expand target module or first
 const targetModuleId = searchParams.get("module");
 if (targetModuleId && enrichedModules.some(m => m.id === targetModuleId)) {
 setExpandedModules(new Set([targetModuleId]));
 } else if (enrichedModules.length > 0) {
 setExpandedModules(new Set([enrichedModules[0].id]));
 }

 // Load progress
 const allLessonIds = lessonsData.map((l) => l.id);
 if (allLessonIds.length > 0) {
 const { data: progressData } = await supabase
 .from("user_progress").select("lesson_id, completed, progress_seconds").eq("user_id", user!.id).in("lesson_id", allLessonIds);
 const pMap = new Map<string, Progress>();
 progressData?.forEach(p => pMap.set(p.lesson_id, p));
 setProgress(pMap);

 const lastWatched = progressData?.filter(p => !p.completed).sort((a, b) => b.progress_seconds - a.progress_seconds)[0];
 const targetId = lastWatched?.lesson_id || allLessonIds[0];
 const targetLesson = lessonsData.find((l) => l.id === targetId) as Lesson | undefined;
 if (targetLesson) setActiveLesson(targetLesson);
 } else if (enrichedModules.length > 0 && enrichedModules[0].lessons.length > 0) {
 setActiveLesson(enrichedModules[0].lessons[0]);
 }
 setLoading(false);
 };

 const toggleModule = (id: string) => {
 setExpandedModules(prev => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id); else next.add(id);
 return next;
 });
 };

 const markComplete = async (lessonId: string) => {
 if (!user) return;
 await supabase.from("user_progress").upsert({
 user_id: user.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString(),
 }, { onConflict: "user_id,lesson_id" });

 setProgress(prev => {
 const next = new Map(prev);
 next.set(lessonId, { lesson_id: lessonId, completed: true, progress_seconds: 0 });
 return next;
 });
 toast.success("Aula concluída!");

 const allLessons = modules.flatMap(m => m.lessons);
 const idx = allLessons.findIndex(l => l.id === lessonId);
 if (idx < allLessons.length - 1) setActiveLesson(allLessons[idx + 1]);
 };

 const navigateLesson = (dir: -1 | 1) => {
 if (!activeLesson) return;
 const allLessons = modules.flatMap(m => m.lessons);
 const idx = allLessons.findIndex(l => l.id === activeLesson.id);
 const next = allLessons[idx + dir];
 if (next) setActiveLesson(next);
 };

 const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
 const completedLessons = [...progress.values()].filter(p => p.completed).length;
 const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

 const hasVideo = activeLesson?.video_url && activeLesson.video_url.trim().length > 0;

 if (loading) {
 return (
 <div className="min-h-[60vh] flex items-center justify-center">
 <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
 </div>
 );
 }

 if (!course) {
 return (
 <div className="text-center py-20">
 <h1 className="text-xl font-bold mb-2">Curso não encontrado</h1>
 <Link to="/membros" className="text-primary text-sm hover:underline">Voltar</Link>
 </div>
 );
 }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Immersive Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-8">
        <div className="flex items-center gap-6">
          <Link to="/membros" className="group flex h-14 w-14 items-center justify-center rounded-2xl border border-border/40 bg-secondary/30 text-foreground transition-all hover:bg-foreground hover:text-background active:scale-90">
            <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-1" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary">
                Modo Estudo
              </div>
              <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Sua Jornada</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.04em] text-foreground truncate">
              {course.title}
            </h1>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1 h-1.5 min-w-[120px] max-w-[200px] rounded-full bg-muted/40 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ duration: 1, ease: "circOut" }}
                  className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                />
              </div>
              <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
                {completedLessons}/{totalLessons} <span className="text-primary ml-1">{overallPct}% concluído</span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-2 bg-secondary/20 p-1.5 rounded-xl border border-border/40">
            <button onClick={() => navigateLesson(-1)} className="h-10 w-10 rounded-lg border border-border/40 flex items-center justify-center transition-all hover:bg-foreground hover:text-background text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigateLesson(1)} className="h-10 w-10 rounded-lg border border-border/40 flex items-center justify-center transition-all hover:bg-foreground hover:text-background text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Cinematic Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {activeLesson ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              {/* Player / Content Box */}
              <div className="relative group/player">
                {hasVideo ? (
                  <div className="aspect-video rounded-[2rem] overflow-hidden bg-black shadow-2xl ring-1 ring-white/5 transition-all duration-700 group-hover/player:ring-primary/20 group-hover/player:shadow-[0_0_50px_rgba(var(--primary),0.1)]">
                    <VideoPlayer url={activeLesson.video_url!} />
                  </div>
                ) : (
                  <div className="aspect-video rounded-[2rem] overflow-hidden bg-gradient-to-br from-secondary/40 via-background to-secondary/40 border border-border/40 flex flex-col items-center justify-center text-center p-12 relative shadow-xl">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.03),transparent_70%)]" />
                    <div className="h-24 w-24 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-8 relative z-10">
                      <FileText className="h-10 w-10 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-foreground relative z-10">{activeLesson.title}</h3>
                    <p className="text-muted-foreground mt-3 max-w-sm relative z-10">Este conteúdo é em formato de texto. Leia atentamente abaixo.</p>
                    {activeLesson.duration_minutes > 0 && (
                      <div className="flex items-center gap-2 mt-6 text-[11px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-4 py-2 rounded-full relative z-10">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{activeLesson.duration_minutes} min de leitura</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Cinema mode decoration */}
                <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-primary/10 via-transparent to-primary/10 blur-xl opacity-0 group-hover/player:opacity-100 transition-opacity duration-1000 -z-10" />
              </div>

              {/* Lesson Control Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-secondary/20 backdrop-blur-xl border border-border/40 rounded-[2rem] p-8">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {hasVideo ? (
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Video className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Conteúdo atual</span>
                  </div>
                  <h2 className="text-2xl font-display font-bold tracking-tight text-foreground truncate">{activeLesson.title}</h2>
                  {activeLesson.duration_minutes > 0 && (
                    <p className="text-[11px] font-bold text-muted-foreground/40 mt-1 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {activeLesson.duration_minutes} minutos de conteúdo
                    </p>
                  )}
                </div>
                
                <Button
                  size="lg"
                  variant={progress.get(activeLesson.id)?.completed ? "outline" : "default"}
                  className={cn(
                    "h-14 px-10 rounded-2xl font-display font-bold text-[15px] transition-all active:scale-95 shadow-xl",
                    progress.get(activeLesson.id)?.completed ? "border-success/30 text-success hover:bg-success/5" : "bg-foreground text-background hover:bg-foreground/90"
                  )}
                  onClick={() => markComplete(activeLesson.id)}
                  disabled={progress.get(activeLesson.id)?.completed}
                >
                  {progress.get(activeLesson.id)?.completed ? (
                    <><CheckCircle2 className="h-5 w-5 mr-2" /> Aula Finalizada</>
                  ) : (
                    <><CheckCircle2 className="h-5 w-5 mr-2" /> Concluir Aula</>
                  )}
                </Button>
              </div>

              {/* Lesson Info Tabs / Description */}
              {activeLesson.description && (
                <div className="bg-secondary/10 rounded-[2rem] border border-border/30 p-10 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <Info className="h-32 w-32" />
                  </div>
                  <h4 className="text-[11px] font-bold text-primary uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Sobre esta experiência
                  </h4>
                  <div className="text-[17px] text-muted-foreground leading-[1.7] font-medium whitespace-pre-wrap selection:bg-primary/20">
                    {activeLesson.description}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="aspect-video rounded-[2rem] bg-secondary/10 border border-dashed border-border/40 flex items-center justify-center">
              <div className="text-center">
                <div className="h-20 w-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <p className="text-[16px] font-bold text-muted-foreground/40 uppercase tracking-widest">Selecione uma aula no menu</p>
              </div>
            </div>
          )}
        </div>

        {/* Premium Sidebar - Modules & Lessons */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Grade Curricular</h3>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{modules.length} Módulos</span>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {modules.map((mod, modIdx) => {
                const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
                const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
                const isExpanded = expandedModules.has(mod.id);

                return (
                  <motion.div 
                    layout
                    key={mod.id} 
                    className={cn(
                      "rounded-[1.5rem] overflow-hidden border transition-all duration-500",
                      isExpanded ? "border-primary/20 bg-secondary/20 shadow-xl" : "border-border/40 bg-card hover:border-border"
                    )}
                  >
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="w-full text-left group/mod"
                    >
                      {/* Module banner or Title bar */}
                      {mod.banner_url ? (
                        <div className="aspect-[2.5/1] overflow-hidden relative">
                          <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/mod:scale-110" />
                          <div className={cn("absolute inset-0 transition-all duration-500", isExpanded ? "bg-black/40" : "bg-black/60")} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                            <div>
                              <p className="text-white text-lg font-display font-bold tracking-tight">{mod.title}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{mod.lessons.length} aulas</span>
                                <div className="h-1 w-20 bg-white/20 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${modPct}%` }} />
                                </div>
                              </div>
                            </div>
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-white/10 backdrop-blur-md text-white transition-transform duration-500", isExpanded && "rotate-180")}>
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-6">
                          <div className="flex items-center gap-4">
                            <span className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold transition-colors duration-500",
                              isExpanded ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            )}>{modIdx + 1}</span>
                            <div>
                              <p className="text-[15px] font-bold tracking-tight text-foreground">{mod.title}</p>
                              <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-1">{mod.lessons.length} aulas • {modPct}% completo</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("h-5 w-5 text-muted-foreground/40 transition-transform duration-500", isExpanded && "rotate-180")} />
                        </div>
                      )}

                      {/* Micro progress line */}
                      {!mod.banner_url && mod.lessons.length > 0 && (
                        <div className="h-1 bg-muted/20">
                          <div className={cn("h-full transition-all duration-700", isExpanded ? "bg-primary" : "bg-muted-foreground/20")} style={{ width: `${modPct}%` }} />
                        </div>
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="p-2 space-y-1">
                            {mod.description && (
                              <div className="px-4 py-3 mb-2 mx-2 bg-foreground/5 rounded-xl">
                                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium italic">{mod.description}</p>
                              </div>
                            )}
                            {mod.lessons.map((lesson, lessonIdx) => {
                              const isActive = activeLesson?.id === lesson.id;
                              const isCompleted = progress.get(lesson.id)?.completed;
                              const isVideoLesson = lesson.video_url && lesson.video_url.trim().length > 0;
                              
                              return (
                                <button
                                  key={lesson.id}
                                  onClick={() => setActiveLesson(lesson)}
                                  className={cn(
                                    "group/lesson w-full flex items-center gap-4 px-4 py-3.5 text-left transition-all rounded-xl relative overflow-hidden",
                                    isActive 
                                      ? "bg-foreground text-background shadow-lg" 
                                      : "hover:bg-foreground/[0.03] text-foreground"
                                  )}
                                >
                                  <div className="shrink-0 relative">
                                    {isCompleted ? (
                                      <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", isActive ? "bg-background text-foreground" : "bg-primary/20 text-primary")}>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      </div>
                                    ) : (
                                      <span className={cn("text-[10px] font-bold font-mono w-6 text-center", isActive ? "text-background/40" : "text-muted-foreground/30")}>
                                        {(lessonIdx + 1).toString().padStart(2, '0')}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0 relative z-10">
                                    <p className={cn(
                                      "text-[13px] font-bold tracking-tight truncate",
                                      isCompleted && !isActive && "text-muted-foreground/60"
                                    )}>{lesson.title}</p>
                                    <div className="flex items-center gap-3 mt-1 opacity-60">
                                      {isVideoLesson && <Video className="h-3 w-3" />}
                                      {!isVideoLesson && <FileText className="h-3 w-3" />}
                                      {lesson.duration_minutes > 0 && (
                                        <span className="text-[10px] font-bold tabular-nums">{lesson.duration_minutes}m</span>
                                      )}
                                    </div>
                                  </div>

                                  {isActive && (
                                    <motion.div 
                                      layoutId="active-indicator"
                                      className="absolute right-3 h-2 w-2 rounded-full bg-primary animate-pulse" 
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Quick Stats / Help */}
          <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/10 mt-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">Sua Conquista</p>
                <p className="text-lg font-display font-bold text-foreground">Venxpay Pioneer</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-medium">Continue sua jornada para desbloquear novos módulos e certificações exclusivas.</p>
            <Button variant="outline" className="w-full rounded-xl border-primary/20 hover:bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest h-11">
              Ver Certificado
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
