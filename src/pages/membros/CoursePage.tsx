import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, CheckCircle2, ChevronLeft, ChevronDown, ChevronRight, BookOpen, Clock, ArrowLeft, ArrowRight, FileText, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Course = { id: string; title: string; description: string | null; thumbnail_url: string | null };
type Module = { id: string; title: string; description: string | null; banner_url: string | null; sort_order: number; lessons: Lesson[] };
type Lesson = { id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number; is_free: boolean; sort_order: number };
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
    let lessonsData: any[] = [];
    if (moduleIds.length > 0) {
      const { data } = await supabase
        .from("lessons").select("id, title, description, video_url, duration_minutes, is_free, sort_order, module_id")
        .in("module_id", moduleIds).order("sort_order");
      if (data) lessonsData = data;
    }

    const enrichedModules: Module[] = modulesData.map(m => ({
      ...m,
      lessons: lessonsData.filter((l: any) => l.module_id === m.id) as Lesson[],
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
    const allLessonIds = lessonsData.map((l: any) => l.id);
    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase
        .from("user_progress").select("lesson_id, completed, progress_seconds").eq("user_id", user!.id).in("lesson_id", allLessonIds);
      const pMap = new Map<string, Progress>();
      progressData?.forEach(p => pMap.set(p.lesson_id, p));
      setProgress(pMap);

      const lastWatched = progressData?.filter(p => !p.completed).sort((a, b) => b.progress_seconds - a.progress_seconds)[0];
      const targetId = lastWatched?.lesson_id || allLessonIds[0];
      const targetLesson = lessonsData.find((l: any) => l.id === targetId) as Lesson | undefined;
      if (targetLesson) setActiveLesson(targetLesson);
    } else if (enrichedModules.length > 0 && enrichedModules[0].lessons.length > 0) {
      setActiveLesson(enrichedModules[0].lessons[0]);
    }
    setLoading(false);
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/membros" className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">{course.title}</h1>
            {course.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{course.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden w-32">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${overallPct}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{completedLessons}/{totalLessons} • {overallPct}%</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => navigateLesson(-1)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 transition-colors text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => navigateLesson(1)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 transition-colors text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Content Area */}
        <div className="lg:col-span-2 space-y-4">
          {activeLesson ? (
            <>
              {/* Video or Content placeholder */}
              {hasVideo ? (
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  <VideoPlayer url={activeLesson.video_url!} />
                </div>
              ) : (
                <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-card to-muted/30 border border-border flex flex-col items-center justify-center text-center p-8">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{activeLesson.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Conteúdo em texto</p>
                  {activeLesson.duration_minutes > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{activeLesson.duration_minutes} min de leitura</span>
                    </div>
                  )}
                </div>
              )}

              {/* Lesson info */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {hasVideo ? (
                        <Video className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <h2 className="text-base font-bold truncate">{activeLesson.title}</h2>
                    </div>
                    {activeLesson.duration_minutes > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {activeLesson.duration_minutes} min
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={progress.get(activeLesson.id)?.completed ? "outline" : "default"}
                    className="shrink-0 gap-1.5 rounded-xl"
                    onClick={() => markComplete(activeLesson.id)}
                    disabled={progress.get(activeLesson.id)?.completed}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {progress.get(activeLesson.id)?.completed ? "Concluída" : "Marcar como concluída"}
                  </Button>
                </div>

                {/* Lesson description */}
                {activeLesson.description && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sobre esta aula</h4>
                    <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {activeLesson.description}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="aspect-video rounded-xl bg-card border border-border flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-muted-foreground">Selecione uma aula para começar</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Modules & Lessons */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Conteúdo do Curso</h3>
          <div className="space-y-2">
            {modules.map((mod, modIdx) => {
              const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
              const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;

              return (
                <div key={mod.id} className="rounded-xl overflow-hidden border border-border bg-card">
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full text-left transition-colors hover:bg-muted/30"
                  >
                    {/* Module banner */}
                    {mod.banner_url && (
                      <div className="aspect-[3/1] overflow-hidden relative">
                        <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                          <div>
                            <p className="text-white text-sm font-bold">{mod.title}</p>
                            <p className="text-white/60 text-[10px]">{mod.lessons.length} aulas • {modPct}% concluído</p>
                          </div>
                          {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4 text-white/60" /> : <ChevronRight className="h-4 w-4 text-white/60" />}
                        </div>
                      </div>
                    )}
                    {!mod.banner_url && (
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{modIdx + 1}</span>
                          <div>
                            <p className="text-sm font-semibold">{mod.title}</p>
                            <p className="text-[10px] text-muted-foreground">{mod.lessons.length} aulas • {modPct}%</p>
                          </div>
                        </div>
                        {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    )}

                    {/* Progress bar */}
                    {mod.lessons.length > 0 && (
                      <div className="h-0.5 bg-muted/30">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${modPct}%` }} />
                      </div>
                    )}
                  </button>

                  {expandedModules.has(mod.id) && (
                    <div className="border-t border-border">
                      {mod.description && (
                        <div className="px-3 py-2 bg-muted/10 border-b border-border/50">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{mod.description}</p>
                        </div>
                      )}
                      {mod.lessons.map(lesson => {
                        const isActive = activeLesson?.id === lesson.id;
                        const isCompleted = progress.get(lesson.id)?.completed;
                        const isVideoLesson = lesson.video_url && lesson.video_url.trim().length > 0;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setActiveLesson(lesson)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-sm border-l-2 ${
                              isActive ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/30"
                            }`}
                          >
                            <div className="shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : isVideoLesson ? (
                                <Play className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs truncate ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>{lesson.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {lesson.duration_minutes > 0 && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" /> {lesson.duration_minutes} min
                                  </p>
                                )}
                                {lesson.description && (
                                  <p className="text-[10px] text-muted-foreground/50 truncate max-w-[120px]">{lesson.description}</p>
                                )}
                              </div>
                            </div>
                            {lesson.is_free && (
                              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold shrink-0">FREE</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
