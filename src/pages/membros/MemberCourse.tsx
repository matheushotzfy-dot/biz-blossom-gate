import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Play, CheckCircle2, ChevronDown, BookOpen, Clock,
  ArrowLeft, ArrowRight, FileText, Video, ChevronLeft, List,
  Award, X, Check, Layers, GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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

function isAllowedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const allowed = ['youtube.com', 'www.youtube.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com', 'www.vimeo.com', 'fast.wistia.net', 'player.hotmart.com', 'cdn.embedly.com', 'iframe.mediadelivery.net'];
    return u.protocol === 'https:' && allowed.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}

function VideoPlayer({ url }: { url: string }) {
  const ytId = extractYouTubeId(url);
  if (ytId) return <iframe src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  const vimeoId = extractVimeoId(url);
  if (vimeoId) return <iframe src={`https://player.vimeo.com/video/${vimeoId}?byline=0&portrait=0&autoplay=1`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  if (!isAllowedVideoUrl(url)) return <div className="w-full h-full flex items-center justify-center bg-card text-muted-foreground text-sm font-display font-bold">URL de vídeo não suportada</div>;
  return <iframe src={url} className="w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin" />;
}

export default function MemberCourse() {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useOutletContext<{ user: User }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { if (courseId && user) loadCourse(); }, [courseId, user]);

  const loadCourse = async () => {
    if (!courseId || !user) return;
    const [{ data: accessData }, { data: ownedData }] = await Promise.all([
      supabase.from("user_access").select("id").eq("user_id", user.id).eq("course_id", courseId).eq("status", "active").limit(1),
      supabase.from("courses").select("id").eq("id", courseId).eq("user_id", user.id).limit(1),
    ]);
    if ((!accessData || accessData.length === 0) && (!ownedData || ownedData.length === 0)) {
      toast.error("Você não tem acesso a este curso.");
      setLoading(false);
      return;
    }
    const { data: courseData } = await supabase.from("courses").select("id, title, description, thumbnail_url").eq("id", courseId).maybeSingle();
    if (!courseData) { setLoading(false); return; }
    setCourse(courseData);
    const { data: modulesData } = await supabase.from("modules").select("id, title, description, banner_url, sort_order").eq("course_id", courseId).order("sort_order");
    if (!modulesData) { setLoading(false); return; }
    const moduleIds = modulesData.map(m => m.id);
    let lessonsData: any[] = [];
    if (moduleIds.length > 0) {
      const { data } = await supabase.from("lessons").select("id, title, description, video_url, duration_minutes, is_free, sort_order, module_id").in("module_id", moduleIds).order("sort_order");
      if (data) lessonsData = data;
    }
    const enrichedModules: Module[] = modulesData.map(m => ({ ...m, lessons: lessonsData.filter((l: any) => l.module_id === m.id) as Lesson[] }));
    setModules(enrichedModules);
    const targetModuleId = searchParams.get("module");
    if (targetModuleId && enrichedModules.some(m => m.id === targetModuleId)) {
      setExpandedModules(new Set([targetModuleId]));
    } else {
      setExpandedModules(new Set(enrichedModules.map(m => m.id)));
    }
    const allLessonIds = lessonsData.map((l: any) => l.id);
    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase.from("user_progress").select("lesson_id, completed, progress_seconds").eq("user_id", user.id).in("lesson_id", allLessonIds);
      const pMap = new Map<string, Progress>();
      progressData?.forEach(p => pMap.set(p.lesson_id, p));
      setProgress(pMap);
      const lastWatched = progressData?.filter(p => !p.completed).sort((a, b) => b.progress_seconds - a.progress_seconds)[0];
      const firstIncomplete = lessonsData.find((l: any) => !pMap.get(l.id)?.completed);
      const targetId = lastWatched?.lesson_id || firstIncomplete?.id || allLessonIds[0];
      const targetLesson = lessonsData.find((l: any) => l.id === targetId) as Lesson | undefined;
      if (targetLesson) {
        setActiveLesson(targetLesson);
        setExpandedModules(prev => new Set([...prev, targetLesson.module_id]));
      }
    } else if (enrichedModules.length > 0 && enrichedModules[0].lessons.length > 0) {
      setActiveLesson(enrichedModules[0].lessons[0]);
    }
    setLoading(false);
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const selectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setSidebarOpen(false);
    setExpandedModules(prev => new Set([...prev, lesson.module_id]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markComplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from("user_progress").upsert(
      { user_id: user.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    );
    setProgress(prev => { const next = new Map(prev); next.set(lessonId, { lesson_id: lessonId, completed: true, progress_seconds: 0 }); return next; });
    toast.success("Aula concluída!");
    const allLessons = modules.flatMap(m => m.lessons);
    const idx = allLessons.findIndex(l => l.id === lessonId);
    if (idx < allLessons.length - 1) {
      setTimeout(() => selectLesson(allLessons[idx + 1]), 800);
    }
  };

  const navigateLesson = (dir: -1 | 1) => {
    if (!activeLesson) return;
    const allLessons = modules.flatMap(m => m.lessons);
    const idx = allLessons.findIndex(l => l.id === activeLesson.id);
    const next = allLessons[idx + dir];
    if (next) selectLesson(next);
  };

  const allLessons = modules.flatMap(m => m.lessons);
  const currentIdx = activeLesson ? allLessons.findIndex(l => l.id === activeLesson.id) : -1;
  const totalLessons = allLessons.length;
  const completedLessons = [...progress.values()].filter(p => p.completed).length;
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const hasVideo = activeLesson?.video_url && activeLesson.video_url.trim().length > 0;
  const isComplete = overallPct === 100 && totalLessons > 0;
  const activeModule = activeLesson ? modules.find(m => m.lessons.some(l => l.id === activeLesson.id)) : null;

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-xl shadow-primary/10">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm font-display font-bold tracking-tight">Carregando curso...</p>
      </motion.div>
    </div>
  );

  if (!course) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-5">
      <div className="h-24 w-24 rounded-[2.5rem] bg-card border border-border/30 flex items-center justify-center shadow-xl">
        <GraduationCap className="h-12 w-12 text-muted-foreground/15" />
      </div>
      <h1 className="text-2xl font-display font-black text-foreground tracking-tight">Curso não encontrado</h1>
      <Link to="/membros-area" className="text-primary text-sm hover:underline font-display font-bold underline-offset-4">← Voltar ao início</Link>
    </div>
  );

  const CourseSidebar = () => (
    <div className="p-5 space-y-4">
      {/* Progress card */}
      <div className="p-5 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-display font-bold text-muted-foreground uppercase tracking-[0.08em]">Progresso</span>
          <span className="text-lg font-display font-black text-primary tabular-nums">{overallPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted/15 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-700" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-3 font-display tabular-nums">{completedLessons} de {totalLessons} aulas</p>
        {isComplete && (
          <div className="flex items-center gap-2.5 mt-4 p-3 rounded-xl bg-success/10 border border-success/15">
            <Award className="h-5 w-5 text-success" />
            <span className="text-sm font-display font-bold text-success">Curso concluído!</span>
          </div>
        )}
      </div>

      {/* Modules */}
      <div className="space-y-2">
        {modules.map((mod, modIdx) => {
          const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
          const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
          const isModComplete = modPct === 100 && mod.lessons.length > 0;

          return (
            <div key={mod.id} className="rounded-2xl overflow-hidden bg-card/40 border border-border/15 hover:border-border/25 transition-all duration-300">
              <button onClick={() => toggleModule(mod.id)} className="w-full text-left transition-colors hover:bg-muted/5">
                {mod.banner_url ? (
                  <div className="aspect-[3/1] overflow-hidden relative">
                    <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <p className="text-foreground text-sm font-display font-bold line-clamp-1">{mod.title}</p>
                        <p className="text-muted-foreground text-xs font-display tabular-nums mt-0.5">{mod.lessons.length} aulas · {modPct}%</p>
                      </div>
                      <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center text-xs font-display font-black shrink-0 border",
                        isModComplete ? "bg-success/10 text-success border-success/15" : "bg-card text-muted-foreground/50 border-border/20"
                      )}>
                        {isModComplete ? <Check className="h-4 w-4" /> : modIdx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-display font-bold text-foreground line-clamp-1">{mod.title}</p>
                        <p className="text-xs text-muted-foreground font-display tabular-nums mt-0.5">{modCompleted}/{mod.lessons.length} aulas</p>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </motion.div>
                  </div>
                )}
                {mod.lessons.length > 0 && (
                  <div className="h-1 bg-muted/10">
                    <div className={cn("h-full transition-all rounded-full", isModComplete ? "bg-success" : "bg-primary")} style={{ width: `${modPct}%` }} />
                  </div>
                )}
              </button>

              <AnimatePresence>
                {expandedModules.has(mod.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/10 py-1.5 px-1.5">
                      {mod.lessons.map((lesson, lIdx) => {
                        const isActive = activeLesson?.id === lesson.id;
                        const isCompleted = progress.get(lesson.id)?.completed;
                        const isVideo = lesson.video_url && lesson.video_url.trim().length > 0;
                        return (
                          <button key={lesson.id} onClick={() => selectLesson(lesson)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all duration-300 rounded-xl",
                              isActive
                                ? "bg-primary/10 border border-primary/15"
                                : "border border-transparent hover:bg-muted/5"
                            )}
                          >
                            <div className="shrink-0">
                              {isCompleted ? (
                                <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center border border-success/10">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                </div>
                              ) : isActive ? (
                                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                                  <Play className="h-3 w-3 text-primary-foreground ml-[1px] fill-current" />
                                </div>
                              ) : (
                                <span className="h-7 w-7 rounded-lg bg-muted/10 flex items-center justify-center text-xs text-muted-foreground/40 font-display font-black border border-border/10">{lIdx + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm truncate font-display",
                                isCompleted ? "text-muted-foreground line-through font-semibold" : isActive ? "text-foreground font-bold" : "text-foreground/70 font-semibold"
                              )}>
                                {lesson.title}
                              </p>
                              <div className="flex items-center gap-2.5 mt-1">
                                {lesson.duration_minutes > 0 && (
                                  <span className="text-xs text-muted-foreground/50 flex items-center gap-1 font-display tabular-nums"><Clock className="h-2.5 w-2.5" /> {lesson.duration_minutes}min</span>
                                )}
                                {isVideo ? (
                                  <span className="text-xs text-muted-foreground/40 flex items-center gap-1 font-display"><Video className="h-2.5 w-2.5" /> Vídeo</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/40 flex items-center gap-1 font-display"><FileText className="h-2.5 w-2.5" /> Texto</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-68px)]">
      {/* ═══ Main Content ═══ */}
      <div className="flex-1 overflow-y-auto">
        {/* Premium top bar */}
        <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-2xl border-b border-border/20 px-5 sm:px-8 py-3.5">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3.5 min-w-0">
              <Link to="/membros-area" className="h-10 w-10 rounded-xl bg-card/50 backdrop-blur-xl hover:bg-card/70 flex items-center justify-center transition-all duration-300 border border-border/20 shrink-0 group">
                <ChevronLeft className="h-4.5 w-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-base font-display font-black text-foreground truncate tracking-tight">{course.title}</h1>
                  {isComplete && <Award className="h-4.5 w-4.5 text-success shrink-0" />}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-1.5 rounded-full bg-muted/15 overflow-hidden w-24 sm:w-32">
                    <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${overallPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground font-display font-semibold tabular-nums">{completedLessons}/{totalLessons} · {overallPct}%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateLesson(-1)} disabled={currentIdx <= 0}
                className="h-10 w-10 rounded-xl bg-card/50 backdrop-blur-xl hover:bg-card/70 flex items-center justify-center transition-all disabled:opacity-20 border border-border/20">
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => navigateLesson(1)} disabled={currentIdx >= totalLessons - 1}
                className="h-10 w-10 rounded-xl bg-card/50 backdrop-blur-xl hover:bg-card/70 flex items-center justify-center transition-all disabled:opacity-20 border border-border/20">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-10 w-10 rounded-xl bg-card/50 backdrop-blur-xl hover:bg-card/70 flex items-center justify-center transition-all lg:hidden border border-border/20">
                <List className="h-4.5 w-4.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Lesson content */}
        <div className="p-5 sm:p-8 lg:p-10 space-y-6 max-w-5xl mx-auto">
          {activeLesson ? (
            <motion.div
              key={activeLesson.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Video / Content area */}
              {hasVideo ? (
                <div className="aspect-video rounded-2xl overflow-hidden bg-foreground/5 shadow-2xl shadow-background/50 ring-1 ring-border/15">
                  <VideoPlayer url={activeLesson.video_url!} />
                </div>
              ) : (
                <div className="aspect-video max-h-[420px] rounded-2xl overflow-hidden bg-gradient-to-br from-card to-muted/10 border border-border/20 flex flex-col items-center justify-center text-center p-10">
                  <div className="h-24 w-24 rounded-[2rem] bg-primary/8 flex items-center justify-center mb-6 border border-primary/10">
                    <FileText className="h-12 w-12 text-primary/25" />
                  </div>
                  <h3 className="text-2xl font-display font-black text-foreground tracking-tight">{activeLesson.title}</h3>
                  <p className="text-base text-muted-foreground mt-3 font-display">Conteúdo em texto — leia abaixo</p>
                </div>
              )}

              {/* Lesson details card */}
              <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 overflow-hidden shadow-lg shadow-background/20">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                    <div className="flex-1 min-w-0">
                      {activeModule && (
                        <p className="text-xs text-muted-foreground font-display font-bold uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-primary/50" />
                          {activeModule.title}
                          <span className="text-muted-foreground/30">·</span>
                          <span className="tabular-nums">Aula {currentIdx + 1} de {totalLessons}</span>
                        </p>
                      )}
                      <h2 className="text-xl sm:text-2xl font-display font-black text-foreground tracking-[-0.03em]">{activeLesson.title}</h2>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground font-display font-semibold">
                        {hasVideo ? <span className="flex items-center gap-1.5"><Video className="h-4 w-4 text-primary" /> Vídeo-aula</span>
                          : <span className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> Conteúdo</span>}
                        {activeLesson.duration_minutes > 0 && (
                          <span className="flex items-center gap-1.5 tabular-nums"><Clock className="h-4 w-4" /> {activeLesson.duration_minutes} min</span>
                        )}
                        {activeLesson.is_free && (
                          <span className="px-2.5 py-1 rounded-lg bg-success/10 text-success text-xs font-display font-bold border border-success/15">Grátis</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button onClick={() => markComplete(activeLesson.id)}
                        disabled={progress.get(activeLesson.id)?.completed}
                        className={cn(
                          "flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-display font-bold transition-all duration-300 active:scale-[0.98]",
                          progress.get(activeLesson.id)?.completed
                            ? "bg-success/10 text-success border border-success/15"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01]"
                        )}>
                        <CheckCircle2 className="h-4.5 w-4.5" />
                        {progress.get(activeLesson.id)?.completed ? "Concluída ✓" : "Concluir aula"}
                      </button>
                      {currentIdx < totalLessons - 1 && (
                        <button onClick={() => navigateLesson(1)}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-display font-bold bg-card/60 text-foreground/70 hover:bg-card hover:text-foreground transition-all border border-border/20">
                          Próxima <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {activeLesson.description && (
                  <div className="border-t border-border/15 p-6 sm:p-8">
                    <h4 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" /> Sobre esta aula
                    </h4>
                    <div className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap font-display">{activeLesson.description}</div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="aspect-video max-h-[500px] rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 flex items-center justify-center shadow-lg">
              <div className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-muted/10 flex items-center justify-center mx-auto mb-5 border border-border/15">
                  <BookOpen className="h-10 w-10 text-muted-foreground/15" />
                </div>
                <p className="text-muted-foreground font-display font-bold text-base">Selecione uma aula para começar</p>
                <p className="text-sm text-muted-foreground/60 mt-2 font-display">Use o menu lateral para navegar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:block w-[340px] xl:w-[400px] shrink-0 border-l border-border/20 bg-card/15 backdrop-blur-sm overflow-y-auto">
        <div className="sticky top-0 z-10 bg-card/70 backdrop-blur-2xl border-b border-border/15 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-primary/60" />
            <h3 className="text-sm font-display font-black text-foreground tracking-tight">Conteúdo</h3>
          </div>
          <span className="text-xs font-display font-semibold text-muted-foreground bg-muted/10 px-2.5 py-1 rounded-lg border border-border/15 tabular-nums">{totalLessons} aulas</span>
        </div>
        <CourseSidebar />
      </aside>

      {/* ═══ Mobile Sidebar Overlay ═══ */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 w-[88vw] max-w-[400px] bg-card/95 backdrop-blur-2xl border-l border-border/20 z-50 lg:hidden overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-card/85 backdrop-blur-2xl border-b border-border/15 p-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-primary/60" />
                  <h3 className="text-base font-display font-black text-foreground tracking-tight">Conteúdo do Curso</h3>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="h-9 w-9 rounded-xl bg-muted/15 hover:bg-muted/25 flex items-center justify-center transition-colors border border-border/15">
                  <X className="h-4.5 w-4.5 text-muted-foreground" />
                </button>
              </div>
              <CourseSidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
