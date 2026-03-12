import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Play, CheckCircle2, ChevronDown, ChevronRight, BookOpen, Clock,
  ArrowLeft, ArrowRight, FileText, Video, ChevronLeft, List,
  Award, Sparkles, X, Check,
} from "lucide-react";
import { toast } from "sonner";

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
  // FIX: Only allow whitelisted video domains to prevent XSS via iframe injection
  if (!isAllowedVideoUrl(url)) return <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-sm">URL de vídeo não suportada</div>;
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

    // FIX: Verify user has access to this course before loading
    const [{ data: accessData }, { data: ownedData }] = await Promise.all([
      supabase.from("user_access").select("id").eq("user_id", user.id).eq("course_id", courseId).eq("status", "active").limit(1),
      supabase.from("courses").select("id").eq("id", courseId).eq("user_id", user.id).limit(1),
    ]);
    if ((!accessData || accessData.length === 0) && (!ownedData || ownedData.length === 0)) {
      toast.error("Você não tem acesso a este curso.");
      setLoading(false);
      return;
    }

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

    // Expand relevant module
    const targetModuleId = searchParams.get("module");
    if (targetModuleId && enrichedModules.some(m => m.id === targetModuleId)) {
      setExpandedModules(new Set([targetModuleId]));
    } else {
      setExpandedModules(new Set(enrichedModules.map(m => m.id)));
    }

    // Load progress
    const allLessonIds = lessonsData.map((l: any) => l.id);
    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase.from("user_progress").select("lesson_id, completed, progress_seconds").eq("user_id", user.id).in("lesson_id", allLessonIds);
      const pMap = new Map<string, Progress>();
      progressData?.forEach(p => pMap.set(p.lesson_id, p));
      setProgress(pMap);

      // Auto-select lesson
      const lastWatched = progressData?.filter(p => !p.completed).sort((a, b) => b.progress_seconds - a.progress_seconds)[0];
      const firstIncomplete = lessonsData.find((l: any) => !pMap.get(l.id)?.completed);
      const targetId = lastWatched?.lesson_id || firstIncomplete?.id || allLessonIds[0];
      const targetLesson = lessonsData.find((l: any) => l.id === targetId) as Lesson | undefined;
      if (targetLesson) {
        setActiveLesson(targetLesson);
        // Expand the module containing this lesson
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
    // Expand the module
    setExpandedModules(prev => new Set([...prev, lesson.module_id]));
    // Scroll to top on mobile
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
    // Auto-advance to next
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

  // Find which module this lesson belongs to
  const activeModule = activeLesson ? modules.find(m => m.lessons.some(l => l.id === activeLesson.id)) : null;

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-zinc-600 text-xs">Carregando curso...</p>
      </div>
    </div>
  );

  if (!course) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
      <div className="h-20 w-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <BookOpen className="h-10 w-10 text-zinc-700" />
      </div>
      <h1 className="text-xl font-extrabold text-white">Curso não encontrado</h1>
      <Link to="/membros-area" className="text-emerald-500 text-sm hover:underline font-semibold">← Voltar ao início</Link>
    </div>
  );

  const SidebarContent = () => (
    <div className="p-4 space-y-2">
      {/* Course progress */}
      <div className="mb-4 p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-400">Progresso</span>
          <span className="text-xs font-extrabold text-emerald-500">{overallPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">{completedLessons} de {totalLessons} aulas</p>
        {isComplete && (
          <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Award className="h-4 w-4 text-emerald-500" />
            <span className="text-[11px] font-bold text-emerald-500">Curso concluído!</span>
          </div>
        )}
      </div>

      {/* Modules */}
      <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1 mb-2">Conteúdo</h3>
      {modules.map((mod, modIdx) => {
        const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
        const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
        const isModComplete = modPct === 100 && mod.lessons.length > 0;

        return (
          <div key={mod.id} className="rounded-xl overflow-hidden bg-zinc-900/40 border border-zinc-800/20">
            <button onClick={() => toggleModule(mod.id)} className="w-full text-left transition-colors hover:bg-zinc-800/20">
              {mod.banner_url ? (
                <div className="aspect-[3/1] overflow-hidden relative">
                  <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <div>
                      <p className="text-white text-xs font-bold line-clamp-1">{mod.title}</p>
                      <p className="text-white/40 text-[9px]">{mod.lessons.length} aulas • {modPct}%</p>
                    </div>
                    {expandedModules.has(mod.id) ? <ChevronDown className="h-3 w-3 text-white/40" /> : <ChevronRight className="h-3 w-3 text-white/40" />}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isModComplete ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {isModComplete ? <Check className="h-3.5 w-3.5" /> : modIdx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white line-clamp-1">{mod.title}</p>
                      <p className="text-[9px] text-zinc-600">{modCompleted}/{mod.lessons.length} aulas</p>
                    </div>
                  </div>
                  {expandedModules.has(mod.id) ? <ChevronDown className="h-3 w-3 text-zinc-600 shrink-0" /> : <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />}
                </div>
              )}
              {mod.lessons.length > 0 && (
                <div className="h-0.5 bg-zinc-800">
                  <div className={`h-full transition-all ${isModComplete ? "bg-emerald-400" : "bg-emerald-500"}`} style={{ width: `${modPct}%` }} />
                </div>
              )}
            </button>

            {expandedModules.has(mod.id) && (
              <div className="border-t border-zinc-800/20">
                {mod.lessons.map((lesson, lIdx) => {
                  const isActive = activeLesson?.id === lesson.id;
                  const isCompleted = progress.get(lesson.id)?.completed;
                  const isVideo = lesson.video_url && lesson.video_url.trim().length > 0;
                  return (
                    <button key={lesson.id} onClick={() => selectLesson(lesson)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all border-l-2 ${
                        isActive
                          ? "bg-emerald-500/10 border-emerald-500"
                          : "border-transparent hover:bg-zinc-800/20"
                      }`}>
                      <div className="shrink-0">
                        {isCompleted ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          </div>
                        ) : isActive ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Play className="h-2.5 w-2.5 text-white ml-[1px] fill-white" />
                          </div>
                        ) : (
                          <span className="h-5 w-5 flex items-center justify-center text-[10px] text-zinc-600 font-mono">{lIdx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] truncate font-medium ${isCompleted ? "text-zinc-600 line-through" : isActive ? "text-white" : "text-zinc-300"}`}>
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {lesson.duration_minutes > 0 && (
                            <span className="text-[9px] text-zinc-600 flex items-center gap-0.5"><Clock className="h-2 w-2" /> {lesson.duration_minutes}min</span>
                          )}
                          {isVideo ? (
                            <span className="text-[8px] text-zinc-700 flex items-center gap-0.5"><Video className="h-2 w-2" /> Vídeo</span>
                          ) : (
                            <span className="text-[8px] text-zinc-700 flex items-center gap-0.5"><FileText className="h-2 w-2" /> Texto</span>
                          )}
                        </div>
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
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* ═══ Main Content ═══ */}
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#09090b]/95 backdrop-blur-2xl border-b border-zinc-800/40 px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/membros-area" className="h-9 w-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-all border border-zinc-700/20 shrink-0">
                <ChevronLeft className="h-4 w-4 text-zinc-400" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-extrabold text-white truncate">{course.title}</h1>
                  {isComplete && <Award className="h-4 w-4 text-emerald-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <div className="h-1 rounded-full bg-zinc-800 overflow-hidden w-20 sm:w-28">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${overallPct}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium">{completedLessons}/{totalLessons} • {overallPct}%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => navigateLesson(-1)} disabled={currentIdx <= 0}
                className="h-9 w-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-all disabled:opacity-30 border border-zinc-700/20">
                <ArrowLeft className="h-3.5 w-3.5 text-zinc-400" />
              </button>
              <button onClick={() => navigateLesson(1)} disabled={currentIdx >= totalLessons - 1}
                className="h-9 w-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-all disabled:opacity-30 border border-zinc-700/20">
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
              </button>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-9 w-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-all lg:hidden border border-zinc-700/20">
                <List className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Lesson content */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">
          {activeLesson ? (
            <>
              {/* Video / Content area */}
              {hasVideo ? (
                <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-zinc-800/50">
                  <VideoPlayer url={activeLesson.video_url!} />
                </div>
              ) : (
                <div className="aspect-video max-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/50 flex flex-col items-center justify-center text-center p-8">
                  <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/10">
                    <FileText className="h-10 w-10 text-emerald-500/40" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white">{activeLesson.title}</h3>
                  <p className="text-sm text-zinc-500 mt-2">Conteúdo em texto — leia abaixo</p>
                </div>
              )}

              {/* Lesson details card */}
              <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/30 overflow-hidden">
                {/* Header */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Breadcrumb */}
                      {activeModule && (
                        <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          {activeModule.title}
                          <span className="text-zinc-700">•</span>
                          Aula {currentIdx + 1} de {totalLessons}
                        </p>
                      )}
                      <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{activeLesson.title}</h2>
                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                        {hasVideo ? <span className="flex items-center gap-1"><Video className="h-3 w-3 text-emerald-500" /> Vídeo-aula</span>
                          : <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-emerald-500" /> Conteúdo</span>}
                        {activeLesson.duration_minutes > 0 && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {activeLesson.duration_minutes} min</span>
                        )}
                        {activeLesson.is_free && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">Grátis</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => markComplete(activeLesson.id)}
                        disabled={progress.get(activeLesson.id)?.completed}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          progress.get(activeLesson.id)?.completed
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        }`}>
                        <CheckCircle2 className="h-4 w-4" />
                        {progress.get(activeLesson.id)?.completed ? "Concluída ✓" : "Concluir aula"}
                      </button>
                      {currentIdx < totalLessons - 1 && (
                        <button onClick={() => navigateLesson(1)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all border border-zinc-700/30">
                          Próxima <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {activeLesson.description && (
                  <div className="border-t border-zinc-800/30 p-5 sm:p-6">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Sobre esta aula
                    </h4>
                    <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeLesson.description}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="aspect-video max-h-[500px] rounded-2xl bg-zinc-900/60 border border-zinc-800/30 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-zinc-700" />
                </div>
                <p className="text-zinc-500 font-medium">Selecione uma aula para começar</p>
                <p className="text-xs text-zinc-700 mt-1">Use o menu lateral para navegar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:block w-80 xl:w-96 shrink-0 border-l border-zinc-800/30 bg-[#0c0c0f] overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* ═══ Mobile Sidebar Overlay ═══ */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-[380px] bg-[#0c0c0f] border-l border-zinc-800/30 z-50 lg:hidden overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 z-10 bg-[#0c0c0f] border-b border-zinc-800/30 p-4 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white">Conteúdo do Curso</h3>
              <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </>
      )}
    </div>
  );
}
