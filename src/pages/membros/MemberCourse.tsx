import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Play, CheckCircle2, ChevronDown, ChevronRight, BookOpen, Clock, ArrowLeft, ArrowRight, FileText, Video, ChevronLeft } from "lucide-react";
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
  if (ytId) return <iframe src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  const vimeoId = extractVimeoId(url);
  if (vimeoId) return <iframe src={`https://player.vimeo.com/video/${vimeoId}?byline=0&portrait=0`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  return <iframe src={url} className="w-full h-full" allowFullScreen />;
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { if (courseId && user) loadCourse(); }, [courseId, user]);

  const loadCourse = async () => {
    if (!courseId || !user) return;
    const { data: courseData } = await supabase.from("courses").select("id, title, description, thumbnail_url").eq("id", courseId).single();
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
    } else if (enrichedModules.length > 0) {
      setExpandedModules(new Set([enrichedModules[0].id]));
    }

    const allLessonIds = lessonsData.map((l: any) => l.id);
    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase.from("user_progress").select("lesson_id, completed, progress_seconds").eq("user_id", user.id).in("lesson_id", allLessonIds);
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
    setExpandedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const markComplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from("user_progress").upsert({ user_id: user.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    setProgress(prev => { const next = new Map(prev); next.set(lessonId, { lesson_id: lessonId, completed: true, progress_seconds: 0 }); return next; });
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

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = [...progress.values()].filter(p => p.completed).length;
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const hasVideo = activeLesson?.video_url && activeLesson.video_url.trim().length > 0;

  if (loading) return <div className="min-h-[80vh] flex items-center justify-center"><div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!course) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <h1 className="text-xl font-bold text-white mb-2">Curso não encontrado</h1>
      <Link to="/membros-area" className="text-emerald-500 text-sm hover:underline">Voltar</Link>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/membros-area" className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors shrink-0">
              <ChevronLeft className="h-4 w-4 text-zinc-400" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">{course.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden w-24">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${overallPct}%` }} />
                </div>
                <span className="text-[10px] text-zinc-500">{completedLessons}/{totalLessons} • {overallPct}%</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => navigateLesson(-1)} className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"><ArrowLeft className="h-3.5 w-3.5 text-zinc-400" /></button>
            <button onClick={() => navigateLesson(1)} className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"><ArrowRight className="h-3.5 w-3.5 text-zinc-400" /></button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors lg:hidden">
              <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
          {activeLesson ? (
            <>
              {hasVideo ? (
                <div className="aspect-video rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/50">
                  <VideoPlayer url={activeLesson.video_url!} />
                </div>
              ) : (
                <div className="aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center text-center p-8">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-emerald-500/40" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{activeLesson.title}</h3>
                  <p className="text-sm text-zinc-500 mt-1">Conteúdo em texto</p>
                </div>
              )}

              {/* Lesson info */}
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {hasVideo ? <Video className="h-4 w-4 text-emerald-500 shrink-0" /> : <FileText className="h-4 w-4 text-emerald-500 shrink-0" />}
                      <h2 className="text-base font-bold text-white truncate">{activeLesson.title}</h2>
                    </div>
                    {activeLesson.duration_minutes > 0 && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><Clock className="h-3 w-3" /> {activeLesson.duration_minutes} min</p>
                    )}
                  </div>
                  <button
                    onClick={() => markComplete(activeLesson.id)}
                    disabled={progress.get(activeLesson.id)?.completed}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      progress.get(activeLesson.id)?.completed
                        ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {progress.get(activeLesson.id)?.completed ? "Concluída" : "Concluir aula"}
                  </button>
                </div>

                {activeLesson.description && (
                  <div className="border-t border-zinc-800 pt-4">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Sobre esta aula</h4>
                    <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeLesson.description}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="aspect-video rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500">Selecione uma aula para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-80 xl:w-96" : "w-0"} hidden lg:block shrink-0 border-l border-zinc-800/50 bg-[#0d0d0d] overflow-y-auto transition-all`}>
        <div className="p-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Conteúdo do Curso</h3>
          <div className="space-y-1.5">
            {modules.map((mod, modIdx) => {
              const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
              const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
              return (
                <div key={mod.id} className="rounded-lg overflow-hidden bg-zinc-900/50 border border-zinc-800/30">
                  <button onClick={() => toggleModule(mod.id)} className="w-full text-left transition-colors hover:bg-zinc-800/30">
                    {mod.banner_url ? (
                      <div className="aspect-[3/1] overflow-hidden relative">
                        <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                          <div>
                            <p className="text-white text-xs font-bold">{mod.title}</p>
                            <p className="text-white/50 text-[9px]">{mod.lessons.length} aulas • {modPct}%</p>
                          </div>
                          {expandedModules.has(mod.id) ? <ChevronDown className="h-3 w-3 text-white/50" /> : <ChevronRight className="h-3 w-3 text-white/50" />}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-500">{modIdx + 1}</span>
                          <div>
                            <p className="text-xs font-semibold text-white">{mod.title}</p>
                            <p className="text-[9px] text-zinc-500">{mod.lessons.length} aulas • {modPct}%</p>
                          </div>
                        </div>
                        {expandedModules.has(mod.id) ? <ChevronDown className="h-3 w-3 text-zinc-600" /> : <ChevronRight className="h-3 w-3 text-zinc-600" />}
                      </div>
                    )}
                    {mod.lessons.length > 0 && <div className="h-0.5 bg-zinc-800"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${modPct}%` }} /></div>}
                  </button>

                  {expandedModules.has(mod.id) && (
                    <div className="border-t border-zinc-800/30">
                      {mod.lessons.map(lesson => {
                        const isActive = activeLesson?.id === lesson.id;
                        const isCompleted = progress.get(lesson.id)?.completed;
                        const isVideo = lesson.video_url && lesson.video_url.trim().length > 0;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setActiveLesson(lesson)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-l-2 ${
                              isActive ? "bg-emerald-500/10 border-emerald-500" : "border-transparent hover:bg-zinc-800/30"
                            }`}
                          >
                            <div className="shrink-0">
                              {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : isVideo ? <Play className="h-3.5 w-3.5 text-zinc-600" /> : <FileText className="h-3.5 w-3.5 text-zinc-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] truncate ${isCompleted ? "text-zinc-600 line-through" : "text-zinc-300"}`}>{lesson.title}</p>
                              {lesson.duration_minutes > 0 && <p className="text-[9px] text-zinc-600 flex items-center gap-1 mt-0.5"><Clock className="h-2 w-2" /> {lesson.duration_minutes} min</p>}
                            </div>
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
      </aside>
    </div>
  );
}
