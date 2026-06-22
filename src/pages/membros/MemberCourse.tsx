/**
 * MemberCourse — Ultra Premium Cinematic Player
 * Flagship experience with glassmorphism, fluid transitions, and integrated learning tools.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Play, CheckCircle2, ChevronDown, BookOpen, Clock,
  ArrowLeft, ArrowRight, FileText, Video, ChevronLeft, List,
  Award, X, Check, Layers, GraduationCap, Maximize2, Minimize2,
  Trophy, Download, Paperclip, ExternalLink, MessageCircle, StickyNote,
  Keyboard, Settings, Share2, Heart, SkipForward, Volume2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { LessonComments } from "@/components/member/LessonComments";
import { LessonQuiz } from "@/components/member/LessonQuiz";
import { LessonNotes } from "@/components/member/LessonNotes";

type Course = { id: string; title: string; description: string | null; thumbnail_url: string | null };
type Module = { id: string; title: string; description: string | null; banner_url: string | null; sort_order: number; lessons: Lesson[] };
type Lesson = { id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number; is_free: boolean; sort_order: number; module_id: string };
type Progress = { lesson_id: string; completed: boolean; progress_seconds: number };
type Attachment = { id: string; file_name: string; file_url: string; file_size: number; file_type: string };

const ease = [0.16, 1, 0.3, 1] as const;

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
  if (!isAllowedVideoUrl(url)) return <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm font-display font-bold">URL de vídeo não suportada</div>;
  return <iframe src={url} className="w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin" />;
}

export default function MemberCourse() {
  const { courseId } = useParams();
  const { user } = useOutletContext<{ user: User }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"aula" | "materiais" | "comentarios" | "anotacoes">("aula");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [certificate, setCertificate] = useState<{ code: string } | null>(null);

  useEffect(() => { if (courseId && user) loadCourse(); }, [courseId, user]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigateLesson(1); }
      if (e.key === "ArrowLeft" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigateLesson(-1); }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey) { setTheaterMode(p => !p); }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && activeLesson && !progress.get(activeLesson.id)?.completed) {
        markComplete(activeLesson.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeLesson, progress, modules]);

  const loadCourse = async () => {
    if (!courseId || !user) return;
    const { data: courseData } = await supabase.from("courses").select("id, title, description, thumbnail_url").eq("id", courseId).maybeSingle();
    if (!courseData) { setLoading(false); return; }
    setCourse(courseData);

    const { data: modulesData } = await supabase.from("modules").select("id, title, description, banner_url, sort_order").eq("course_id", courseId).order("sort_order");
    if (!modulesData) { setLoading(false); return; }

    const moduleIds = modulesData.map(m => m.id);
    let lessonsData: Lesson[] = [];
    if (moduleIds.length > 0) {
      const { data } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      if (data) lessonsData = data as Lesson[];
    }
    const enrichedModules: Module[] = modulesData.map(m => ({ ...m, lessons: lessonsData.filter(l => l.module_id === m.id) }));
    setModules(enrichedModules);
    setExpandedModules(new Set(enrichedModules.map(m => m.id)));

    const allLessonIds = lessonsData.map((l: any) => l.id);
    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase.from("user_progress").select("lesson_id, completed, progress_seconds").eq("user_id", user.id).in("lesson_id", allLessonIds);
      const pMap = new Map<string, Progress>();
      progressData?.forEach(p => pMap.set(p.lesson_id, p));
      setProgress(pMap);

      const targetId = allLessonIds[0];
      const targetLesson = lessonsData.find((l: any) => l.id === targetId) as Lesson | undefined;
      if (targetLesson) {
        setActiveLesson(targetLesson);
        loadAttachments(targetLesson.id);
      }
    }
    setLoading(false);
  };

  const loadAttachments = async (lessonId: string) => {
    const { data } = await supabase.from("lesson_attachments").select("*").eq("lesson_id", lessonId);
    setAttachments(data || []);
  };

  const selectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    loadAttachments(lesson.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markComplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from("user_progress").upsert({ user_id: user.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    setProgress(prev => { const next = new Map(prev); next.set(lessonId, { lesson_id: lessonId, completed: true, progress_seconds: 0 }); return next; });
    toast.success("Aula concluída!");
    navigateLesson(1);
  };

  const navigateLesson = useCallback((dir: -1 | 1) => {
    if (!activeLesson) return;
    const allLessons = modules.flatMap(m => m.lessons);
    const idx = allLessons.findIndex(l => l.id === activeLesson.id);
    const next = allLessons[idx + dir];
    if (next) selectLesson(next);
  }, [activeLesson, modules]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const overallPct = useMemo(() => {
    const all = modules.flatMap(m => m.lessons);
    if (all.length === 0) return 0;
    const completed = all.filter(l => progress.get(l.id)?.completed).length;
    return Math.round((completed / all.length) * 100);
  }, [modules, progress]);

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-6">
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center">
          <Play className="h-8 w-8 text-black fill-current ml-1" />
        </motion.div>
        <div className="h-1 w-48 bg-white/10 overflow-hidden rounded-full">
          <motion.div className="h-full w-full bg-white" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </div>
    </div>
  );

  if (!course) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#050505] text-zinc-100 overflow-hidden">
      {/* ─── SIDEBAR — Grade Curricular ─── */}
      {!theaterMode && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 400, opacity: 1 }}
          className="hidden lg:flex flex-col h-full bg-[#080808] border-r border-white/5 relative z-20"
        >
          <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
            <Link to="/membros-area" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-6 text-[10px] font-bold uppercase tracking-widest">
              <ChevronLeft className="h-4 w-4" />
              Voltar ao Início
            </Link>
            <h2 className="font-display text-2xl font-bold text-white leading-tight tracking-tight mb-4">{course.title}</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Seu progresso</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{overallPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ duration: 1.2 }} className="h-full bg-emerald-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar py-4">
            {modules.map((mod, modIdx) => (
              <div key={mod.id} className="mb-2">
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full px-8 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-500 group-hover:text-white transition-colors">
                      {String(modIdx + 1).padStart(2, '0')}
                    </div>
                    <span className="text-[13px] font-bold uppercase tracking-widest text-zinc-300 group-hover:text-white transition-colors truncate max-w-[200px]">
                      {mod.title}
                    </span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-600 transition-transform duration-500", expandedModules.has(mod.id) && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {expandedModules.has(mod.id) && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      {mod.lessons.map((lesson, lIdx) => {
                        const isActive = activeLesson?.id === lesson.id;
                        const isCompleted = progress.get(lesson.id)?.completed;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => selectLesson(lesson)}
                            className={cn(
                              "w-full pl-20 pr-8 py-3.5 flex items-center gap-4 transition-all group/lesson relative",
                              isActive ? "bg-white/[0.06] text-white" : "text-zinc-500 hover:text-zinc-200"
                            )}
                          >
                            {isActive && <motion.div layoutId="activeLesson" className="absolute left-0 w-1 h-full bg-emerald-500" />}
                            <div className={cn(
                              "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                              isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : isActive ? "border-white/20 text-white" : "border-white/5 text-zinc-800"
                            )}>
                              {isCompleted ? <Check className="h-3 w-3" strokeWidth={4} /> : <Play className={cn("h-2.5 w-2.5", isActive ? "fill-current" : "")} />}
                            </div>
                            <div className="flex-1 truncate">
                              <p className="text-[13px] font-semibold tracking-tight truncate">{lesson.title}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{lesson.duration_minutes} min</p>
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.aside>
      )}

      {/* ─── MAIN CONTENT — Player & Details ─── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Sub-header Controls */}
        <div className="h-20 shrink-0 border-b border-white/5 px-8 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-6">
            {theaterMode && (
              <button onClick={() => setTheaterMode(false)} className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center hover:bg-zinc-800 transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-1">Módulo atual</p>
              <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate max-w-xs lg:max-w-md">
                {modules.find(m => m.id === activeLesson?.module_id)?.title || "Carregando..."}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-xl border border-white/5">
              <button onClick={() => navigateLesson(-1)} className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-zinc-500 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button onClick={() => navigateLesson(1)} className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-zinc-500 hover:text-white">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => setTheaterMode(!theaterMode)} className="h-12 w-12 rounded-xl bg-white text-black flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-xl">
              {theaterMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Player Scrollable Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className={cn("mx-auto transition-all duration-700", theaterMode ? "max-w-none" : "max-w-[1200px] p-8")}>
            {/* Cinematic Video Wrapper */}
            <div className="relative group/player mb-12">
              <div className={cn(
                "aspect-video bg-zinc-950 overflow-hidden relative shadow-2xl transition-all duration-700",
                theaterMode ? "" : "rounded-[2rem] border border-white/5"
              )}>
                {activeLesson?.video_url ? (
                  <VideoPlayer url={activeLesson.video_url} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-20 text-center">
                    <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mb-8">
                      <FileText className="h-10 w-10 text-zinc-700" />
                    </div>
                    <h2 className="text-3xl font-display font-bold mb-4">Material de Leitura</h2>
                    <p className="text-zinc-500 max-w-sm">Esta aula não possui vídeo. Acompanhe o conteúdo textual abaixo em 'Materiais'.</p>
                  </div>
                )}
              </div>
              
              {/* Bottom bar for player info */}
              {!theaterMode && (
                <div className="absolute -bottom-6 left-12 right-12 h-12 bg-white/10 backdrop-blur-3xl rounded-2xl border border-white/10 z-10 flex items-center justify-between px-6 opacity-0 group-hover/player:opacity-100 transition-opacity">
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-400">Pressione <kbd className="bg-white/20 px-1 rounded">C</kbd> para concluir</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-800" />
                    <span className="text-zinc-400">Pressione <kbd className="bg-white/20 px-1 rounded">T</kbd> para teatro</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-zinc-500" />
                    <Share2 className="h-4 w-4 text-zinc-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Lesson Details & Tabs */}
            <div className="px-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                      Aula Premium
                    </span>
                    <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                      {activeLesson?.duration_minutes} min de conteúdo
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tight leading-none mb-6">
                    {activeLesson?.title}
                  </h1>
                </div>

                <div className="flex items-center gap-4">
                  <button className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center hover:bg-zinc-800 transition-colors">
                    <Heart className="h-6 w-6 text-zinc-600" />
                  </button>
                  <button
                    onClick={() => markComplete(activeLesson!.id)}
                    disabled={progress.get(activeLesson?.id || "")?.completed}
                    className={cn(
                      "h-16 px-10 rounded-2xl font-display font-bold text-lg transition-all active:scale-95 shadow-2xl flex items-center gap-4",
                      progress.get(activeLesson?.id || "")?.completed
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-white text-black hover:bg-zinc-200"
                    )}
                  >
                    {progress.get(activeLesson?.id || "")?.completed ? (
                      <><CheckCircle2 className="h-6 w-6" /> Concluída</>
                    ) : (
                      <><CheckCircle2 className="h-6 w-6" /> Marcar como Concluída</>
                    )}
                  </button>
                </div>
              </div>

              {/* TABS Navigation */}
              <div className="flex items-center gap-10 border-b border-white/5 mb-10 overflow-x-auto no-scrollbar">
                {[
                  { id: "aula", label: "Aula", icon: Play },
                  { id: "materiais", label: "Materiais", icon: Paperclip },
                  { id: "comentarios", label: "Comentários", icon: MessageCircle },
                  { id: "anotacoes", label: "Anotações", icon: StickyNote },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "pb-6 text-[11px] font-bold uppercase tracking-[0.2em] relative transition-colors",
                      activeTab === tab.id ? "text-white" : "text-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon className={cn("h-3.5 w-3.5", activeTab === tab.id ? "text-emerald-500" : "text-zinc-700")} />
                      {tab.label}
                    </div>
                    {activeTab === tab.id && (
                      <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-1 bg-emerald-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* TAB Content */}
              <div className="pb-32 min-h-[400px]">
                <AnimatePresence mode="wait">
                  {activeTab === "aula" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl">
                      <p className="text-xl text-zinc-400 leading-relaxed font-medium mb-12">
                        {activeLesson?.description || "Esta aula não possui uma descrição detalhada."}
                      </p>
                      
                      {/* Tips or additional info */}
                      <div className="p-8 rounded-[2rem] bg-emerald-500/[0.03] border border-emerald-500/10 flex items-start gap-6">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Dica de Estudo</h4>
                          <p className="text-zinc-500 text-sm leading-relaxed">
                            Mantenha o foco e anote os pontos principais. Você pode usar a aba de 'Anotações' ao lado para marcar momentos específicos do vídeo.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "materiais" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {attachments.length > 0 ? attachments.map(att => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/20 transition-all group flex items-center justify-between"
                        >
                          <div className="flex items-center gap-5">
                            <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                              <Download className="h-5 w-5 text-zinc-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white mb-1 line-clamp-1">{att.file_name}</p>
                              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Baixar Material</p>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors" />
                        </a>
                      )) : (
                        <div className="col-span-2 py-20 text-center bg-zinc-900/50 rounded-[2rem] border border-dashed border-white/5">
                          <Paperclip className="h-10 w-10 text-zinc-800 mx-auto mb-4" />
                          <p className="text-zinc-600 font-bold tracking-tight">Nenhum anexo para esta aula.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "comentarios" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <LessonComments lessonId={activeLesson?.id || ""} currentUserId={user.id} />
                    </motion.div>
                  )}

                  {activeTab === "anotacoes" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <LessonNotes lessonId={activeLesson?.id || ""} userId={user.id} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-10 text-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Trophy className="h-32 w-32 text-emerald-400 mx-auto mb-10" />
              <h2 className="text-6xl font-display font-bold mb-4">Incrível!</h2>
              <p className="text-zinc-400 text-xl max-w-md mx-auto mb-12">Você acaba de concluir mais um passo na sua jornada. Continue focado!</p>
              <button onClick={() => setShowCelebration(false)} className="px-12 py-5 bg-white text-black font-bold rounded-2xl hover:scale-105 transition-transform">
                Continuar Estudando
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
