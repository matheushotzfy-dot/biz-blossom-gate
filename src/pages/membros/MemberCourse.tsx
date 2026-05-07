/**
 * MemberCourse — Netflix Premium Player
 * Cinematic video player, sidebar with curriculum, celebration flow.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
 Play, CheckCircle2, ChevronDown, BookOpen, Clock,
 ArrowLeft, ArrowRight, FileText, Video, ChevronLeft, List,
 Award, X, Check, Layers, GraduationCap, Maximize2, Minimize2,
 Trophy, Download, Paperclip, ExternalLink,
 Keyboard,
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
function formatFileSize(bytes: number) {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / 1048576).toFixed(1)} MB`;
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
 const [searchParams] = useSearchParams();
 const { user } = useOutletContext<{ user: User }>();
 const [course, setCourse] = useState<Course | null>(null);
 const [modules, setModules] = useState<Module[]>([]);
 const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
 const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
 const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
 const [loading, setLoading] = useState(true);
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [theaterMode, setTheaterMode] = useState(false);
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
 setExpandedModules(new Set(enrichedModules.map(m => m.id)));
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
 loadAttachments(targetLesson.id);
 }
 } else if (enrichedModules.length > 0 && enrichedModules[0].lessons.length > 0) {
 setActiveLesson(enrichedModules[0].lessons[0]);
 loadAttachments(enrichedModules[0].lessons[0].id);
 }
 setLoading(false);
 const { data: certData } = await supabase.from("certificates").select("code").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
 if (certData) setCertificate(certData as { code: string });
 };

 const refreshCertificate = async () => {
 if (!user || !courseId) return;
 const { data } = await supabase.from("certificates").select("code").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
 if (data) setCertificate(data as { code: string });
 };

 const loadAttachments = async (lessonId: string) => {
 const { data } = await supabase.from("lesson_attachments")
 .select("id, file_name, file_url, file_size, file_type")
 .eq("lesson_id", lessonId);
 setAttachments(data || []);
 };

 const toggleModule = (id: string) => {
 setExpandedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
 };

 const selectLesson = (lesson: Lesson) => {
 setActiveLesson(lesson);
 setSidebarOpen(false);
 setExpandedModules(prev => new Set([...prev, lesson.module_id]));
 loadAttachments(lesson.id);
 window.scrollTo({ top: 0, behavior: "smooth" });
 if (user && !progress.get(lesson.id)?.completed) {
 supabase.from("user_progress").upsert(
 { user_id: user.id, lesson_id: lesson.id, completed: false, progress_seconds: 1 },
 { onConflict: "user_id,lesson_id" }
 ).then(({ error }) => {
 if (!error) {
 setProgress(prev => {
 const next = new Map(prev);
 if (!next.get(lesson.id)) next.set(lesson.id, { lesson_id: lesson.id, completed: false, progress_seconds: 1 });
 return next;
 });
 }
 });
 }
 };

 const markComplete = async (lessonId: string) => {
 if (!user) return;
 await supabase.from("user_progress").upsert(
 { user_id: user.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() },
 { onConflict: "user_id,lesson_id" }
 );
 setProgress(prev => { const next = new Map(prev); next.set(lessonId, { lesson_id: lessonId, completed: true, progress_seconds: 0 }); return next; });

 const allLessons = modules.flatMap(m => m.lessons);
 const newCompleted = [...progress.values()].filter(p => p.completed).length + 1;
 if (newCompleted >= allLessons.length) {
 setShowCelebration(true);
 setTimeout(() => setShowCelebration(false), 5000);
 setTimeout(() => refreshCertificate(), 1200);
 } else {
 toast.success("Aula concluída! 🎉");
 const idx = allLessons.findIndex(l => l.id === lessonId);
 if (idx < allLessons.length - 1) {
 setTimeout(() => selectLesson(allLessons[idx + 1]), 800);
 }
 }
 };

 const navigateLesson = useCallback((dir: -1 | 1) => {
 if (!activeLesson) return;
 const allLessons = modules.flatMap(m => m.lessons);
 const idx = allLessons.findIndex(l => l.id === activeLesson.id);
 const next = allLessons[idx + dir];
 if (next) selectLesson(next);
 }, [activeLesson, modules]);

 const allLessons = modules.flatMap(m => m.lessons);
 const currentIdx = activeLesson ? allLessons.findIndex(l => l.id === activeLesson.id) : -1;
 const totalLessons = allLessons.length;
 const completedLessons = [...progress.values()].filter(p => p.completed).length;
 const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
 const hasVideo = activeLesson?.video_url && activeLesson.video_url.trim().length > 0;
 const isComplete = overallPct === 100 && totalLessons > 0;
 const activeModule = activeLesson ? modules.find(m => m.lessons.some(l => l.id === activeLesson.id)) : null;

   if (loading) return (
    <div className="min-h-dvh flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-6">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
          transition={{ duration: 2, repeat: Infinity }}
          className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center"
        >
          <Play className="h-8 w-8 text-black fill-current ml-1" />
        </motion.div>
        <div className="h-1 w-48 bg-white/10 overflow-hidden rounded-full">
          <motion.div className="h-full w-full bg-white" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </div>
    </div>
  );

  if (!course) return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 bg-[#050505] text-white">
      <div className="h-24 w-24 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-2xl">
        <GraduationCap className="h-10 w-10 text-zinc-700" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-black tracking-tight">Título Indisponível</h1>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto">Este conteúdo não pôde ser carregado ou você não possui as credenciais necessárias.</p>
      </div>
      <Link to="/membros-area" className="px-8 py-3 bg-white text-black font-black text-sm rounded-lg hover:bg-zinc-200 transition-colors uppercase tracking-widest">
        Voltar ao Início
      </Link>
    </div>
  );

  const sidebarWidth = theaterMode ? "lg:w-0 lg:opacity-0 lg:pointer-events-none" : "w-[380px] xl:w-[420px]";

  /* ─── Sidebar Component ─── */
  const CourseSidebar = () => (
    <div className="p-4 space-y-3">
      {/* Progress card */}
      <div className="p-5 bg-white/[0.03] border border-white/[0.05] rounded-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Seu Progresso</span>
          <span className={cn("font-display text-xl font-black tabular-nums", isComplete ? "text-emerald-400" : "text-white")}>{overallPct}%</span>
        </div>
        <div className="h-2 bg-white/5 overflow-hidden rounded-full">
          <motion.div initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className={cn("h-full rounded-full", isComplete ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]" : "bg-white")} />
        </div>
        <p className="text-[11px] text-zinc-500 mt-3 font-bold tracking-tight">{completedLessons} de {totalLessons} aulas concluídas</p>
        {isComplete && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mt-3 pt-3 border-t border-emerald-500/20">
            <Trophy className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.16em]">Curso concluído</span>
          </motion.div>
        )}
      </div>

      {/* Keyboard shortcuts */}
      <div className="px-3 py-2 flex items-center gap-2 text-[9px] text-zinc-600 font-mono tracking-wider rounded-md bg-zinc-900/30">
        <Keyboard className="h-3 w-3" />
        <span>← → navegar</span>
        <span className="text-zinc-800">·</span>
        <span>C concluir</span>
        <span className="text-zinc-800">·</span>
        <span>T teatro</span>
      </div>

      {/* Modules list */}
      <div className="space-y-2">
        {modules.map((mod, modIdx) => {
          const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
          const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
          const isModComplete = modPct === 100 && mod.lessons.length > 0;
          const isExpanded = expandedModules.has(mod.id);
          const containsActive = mod.lessons.some(l => l.id === activeLesson?.id);

          return (
            <div key={mod.id} className={cn(
              "rounded-lg overflow-hidden border transition-colors",
              containsActive ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-white/[0.06] bg-zinc-900/30 hover:border-white/10"
            )}>
              <button onClick={() => toggleModule(mod.id)} className="w-full text-left">
                <div className="flex items-center gap-3 p-3.5">
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center font-display font-black text-sm tabular-nums shrink-0 border",
                    isModComplete
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : containsActive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-900 text-zinc-500 border-white/10"
                  )}>
                    {isModComplete ? <Check className="h-4 w-4" /> : String(modIdx + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[13px] font-bold text-zinc-200 line-clamp-1 tracking-tight">{mod.title}</p>
                    <p className="text-[10px] text-zinc-600 font-mono tabular-nums mt-0.5">{modCompleted}/{mod.lessons.length} · {modPct}%</p>
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2, ease }} className="shrink-0">
                    <ChevronDown className="h-4 w-4 text-zinc-600" />
                  </motion.div>
                </div>
                {mod.lessons.length > 0 && (
                  <div className="h-[2px] bg-white/5 mx-3.5 mb-px rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", isModComplete ? "bg-emerald-400" : "bg-emerald-500/60")} style={{ width: `${modPct}%` }} />
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/5">
                      {mod.lessons.map((lesson, lIdx) => {
                        const isActive = activeLesson?.id === lesson.id;
                        const isCompleted = progress.get(lesson.id)?.completed;
                        const isVideo = lesson.video_url && lesson.video_url.trim().length > 0;
                        return (
                          <button key={lesson.id} onClick={() => selectLesson(lesson)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all duration-200 relative border-b border-white/[0.03] last:border-b-0",
                              isActive ? "bg-emerald-500/[0.08]" : "hover:bg-white/[0.02]"
                            )}>
                            {isActive && (
                              <motion.div layoutId="member-lesson-active" className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-400 rounded-full" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                            )}
                            <div className="shrink-0">
                              {isCompleted ? (
                                <div className="h-7 w-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                </div>
                              ) : isActive ? (
                                <div className="h-7 w-7 rounded-md bg-emerald-400 flex items-center justify-center">
                                  <Play className="h-3 w-3 text-[#050505] ml-[1px] fill-current" />
                                </div>
                              ) : (
                                <div className="h-7 w-7 rounded-md bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-display font-black text-zinc-600 tabular-nums">
                                  {String(lIdx + 1).padStart(2, "0")}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-[12px] truncate font-display tracking-tight",
                                isCompleted ? "text-zinc-600 line-through" : isActive ? "text-zinc-100 font-semibold" : "text-zinc-400 font-medium"
                              )}>
                                {lesson.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isVideo ? (
                                  <span className="text-[9px] text-zinc-600 flex items-center gap-1 font-mono uppercase tracking-wider"><Video className="h-2.5 w-2.5" /> Vídeo</span>
                                ) : (
                                  <span className="text-[9px] text-zinc-600 flex items-center gap-1 font-mono uppercase tracking-wider"><FileText className="h-2.5 w-2.5" /> Texto</span>
                                )}
                                {lesson.duration_minutes > 0 && (
                                  <>
                                    <span className="text-zinc-800">·</span>
                                    <span className="text-[9px] text-zinc-600 font-mono tabular-nums">{lesson.duration_minutes}min</span>
                                  </>
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
    <div className="flex flex-col lg:flex-row min-h-[calc(100dvh-64px)] bg-[#050505] text-zinc-100">
      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505]/95 backdrop-blur-sm"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.5, ease }}
              className="text-center p-10 max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", bounce: 0.4 }} className="mx-auto mb-8">
                <div className="h-24 w-24 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <Trophy className="h-12 w-12 text-emerald-400" />
                </div>
              </motion.div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-[10px] uppercase tracking-[0.24em] text-emerald-400 font-bold mb-3">
                Curso Concluído
              </motion.p>
              <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="font-display text-5xl font-black text-zinc-100 tracking-[-0.04em] leading-[0.95] mb-4">
                Parabéns!
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="text-sm text-zinc-400 leading-relaxed mb-8">
                Você completou todas as {totalLessons} aulas de <strong className="text-zinc-100">{course.title}</strong>
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                className="flex flex-wrap items-center justify-center gap-3">
                {certificate && (
                  <Link to={`/certificado/${certificate.code}`} target="_blank"
                    className="px-6 py-3 bg-emerald-400 text-[#050505] text-[13px] font-display font-bold hover:bg-emerald-300 transition-all active:scale-[0.97] flex items-center gap-2 rounded-md">
                    <Award className="h-4 w-4" /> Ver certificado
                  </Link>
                )}
                <Link to="/membros-area"
                  className="px-6 py-3 bg-white text-[#050505] text-[13px] font-display font-bold hover:bg-zinc-200 transition-all active:scale-[0.97] rounded-md">
                  Voltar aos cursos
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-[#050505] relative">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 px-4 sm:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link to="/membros-area" className="h-9 w-9 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all shrink-0">
                <ChevronLeft className="h-4 w-4 text-zinc-400" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-[13px] font-bold text-zinc-100 truncate tracking-tight">{course.title}</h1>
                  {isComplete && (
                    <div className="h-5 w-5 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Award className="h-2.5 w-2.5 text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="h-1.5 bg-white/8 overflow-hidden w-24 lg:w-32 rounded-full">
                <div className={cn("h-full rounded-full transition-all duration-700", isComplete ? "bg-emerald-400" : "bg-emerald-500")} style={{ width: `${overallPct}%` }} />
              </div>
              <span className="text-[11px] text-zinc-500 font-mono font-bold tabular-nums">{overallPct}%</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => navigateLesson(-1)} disabled={currentIdx <= 0}
                className="h-9 w-9 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all disabled:opacity-20 active:scale-95"
                title="←">
                <ArrowLeft className="h-4 w-4 text-zinc-400" />
              </button>
              <button onClick={() => navigateLesson(1)} disabled={currentIdx >= totalLessons - 1}
                className="h-9 w-9 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all disabled:opacity-20 active:scale-95"
                title="→">
                <ArrowRight className="h-4 w-4 text-zinc-400" />
              </button>
              <button onClick={() => setTheaterMode(!theaterMode)}
                className="hidden lg:flex h-9 w-9 rounded-md bg-white/[0.04] hover:bg-white/[0.08] items-center justify-center transition-all active:scale-95"
                title="Modo teatro (T)">
                {theaterMode ? <Minimize2 className="h-4 w-4 text-zinc-400" /> : <Maximize2 className="h-4 w-4 text-zinc-400" />}
              </button>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-9 w-9 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all lg:hidden active:scale-95">
                <List className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Video Stage */}
        {activeLesson && (
          <motion.div key={`stage-${activeLesson.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease }}
            className="relative w-full bg-black">
            <div className={cn("mx-auto", theaterMode ? "max-w-none" : "max-w-[1280px]")}>
              {hasVideo ? (
                <div className="aspect-video w-full bg-black relative">
                  <VideoPlayer url={activeLesson.video_url!} />
                </div>
              ) : (
                <div className="aspect-video w-full bg-gradient-to-br from-zinc-900 via-[#050505] to-black flex flex-col items-center justify-center text-center p-8">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                    <FileText className="h-7 w-7 text-emerald-400/60" />
                  </div>
                  <h3 className="font-display text-2xl font-black text-zinc-100 tracking-[-0.02em]">{activeLesson.title}</h3>
                  <p className="text-xs text-zinc-600 font-medium mt-3">Conteúdo em texto — leia abaixo</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Lesson detail */}
        <div className={cn("mx-auto px-4 sm:px-8 lg:px-12 pb-20 pt-8", theaterMode ? "max-w-[1280px]" : "max-w-[1100px]")}>
          {activeLesson ? (
            <motion.div key={`meta-${activeLesson.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: 0.1 }} className="space-y-8">

              {/* Title block */}
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-white/5">
                <div className="min-w-0 flex-1">
                  {activeModule && (
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2.5">
                      <span className="inline-block h-px w-5 bg-emerald-500/40" />
                      {activeModule.title}
                      <span className="text-zinc-700">·</span>
                      <span className="tabular-nums text-zinc-500 font-mono">{String(currentIdx + 1).padStart(2, "0")} / {String(totalLessons).padStart(2, "0")}</span>
                    </p>
                  )}
                  <h2 className="font-display text-3xl sm:text-4xl lg:text-[48px] font-black text-zinc-100 tracking-[-0.04em] leading-[1.02]">{activeLesson.title}</h2>
                  <div className="flex items-center gap-3 mt-4 text-xs text-zinc-500 font-medium flex-wrap">
                    {hasVideo
                      ? <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-emerald-400/70" /> Vídeo</span>
                      : <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-emerald-400/70" /> Conteúdo</span>}
                    {activeLesson.duration_minutes > 0 && (
                      <><span className="text-zinc-800">·</span><span className="flex items-center gap-1.5 tabular-nums"><Clock className="h-3.5 w-3.5" /> {activeLesson.duration_minutes} min</span></>
                    )}
                    {attachments.length > 0 && (
                      <><span className="text-zinc-800">·</span><span className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {attachments.length} anexo{attachments.length > 1 ? "s" : ""}</span></>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => markComplete(activeLesson.id)}
                    disabled={progress.get(activeLesson.id)?.completed}
                    className={cn(
                      "flex items-center gap-2 px-5 h-11 rounded-md text-[13px] font-display font-bold transition-all active:scale-[0.97]",
                      progress.get(activeLesson.id)?.completed
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-white text-[#050505] hover:bg-zinc-200"
                    )}>
                    <CheckCircle2 className="h-4 w-4" />
                    {progress.get(activeLesson.id)?.completed ? "Concluída" : "Concluir aula"}
                  </button>
                  {currentIdx < totalLessons - 1 && (
                    <button onClick={() => navigateLesson(1)}
                      className="flex items-center gap-1.5 px-5 h-11 rounded-md text-[13px] font-display font-bold bg-white/[0.06] text-zinc-300 hover:bg-white/[0.10] transition-all active:scale-[0.97]">
                      Próxima <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              {activeLesson.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-bold mb-3">Sobre esta aula</p>
                  <p className="text-[15px] text-zinc-300 leading-[1.75] whitespace-pre-wrap">{activeLesson.description}</p>
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Paperclip className="h-3 w-3" /> Materiais de apoio
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {attachments.map(att => (
                      <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                        className="group flex items-center gap-3 p-3.5 rounded-lg bg-zinc-900/40 border border-white/[0.06] hover:border-emerald-500/30 hover:bg-zinc-900/70 transition-all active:scale-[0.99]">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
                          <Download className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-display font-bold text-zinc-200 truncate">{att.file_name}</p>
                          <p className="text-[10px] text-zinc-600 font-mono tabular-nums mt-0.5">{formatFileSize(att.file_size)}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-700 group-hover:text-emerald-400 transition-colors shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificate banner */}
              {certificate && (
                <Link to={`/certificado/${certificate.code}`} target="_blank"
                  className="block rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] border border-emerald-500/25 p-5 hover:border-emerald-500/50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Award className="h-7 w-7 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold mb-1">Certificado emitido</p>
                      <p className="font-display text-[15px] font-black text-zinc-100 tracking-tight">Seu certificado está pronto</p>
                      <p className="text-xs text-zinc-500 font-mono mt-1">ID · <span className="text-emerald-400">{certificate.code}</span></p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-emerald-400/60 group-hover:text-emerald-400 transition-colors shrink-0" />
                  </div>
                </Link>
              )}

              {/* Quiz / Notes / Comments */}
              <div className="space-y-5 pt-4">
                {user && <LessonQuiz lessonId={activeLesson.id} userId={user.id} />}
                {user && <LessonNotes lessonId={activeLesson.id} userId={user.id} />}
                {user && <LessonComments lessonId={activeLesson.id} currentUserId={user.id} />}
              </div>
            </motion.div>
          ) : (
            <div className="aspect-video max-h-[480px] rounded-lg bg-zinc-900/30 border border-white/5 flex items-center justify-center">
              <div className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-6 w-6 text-zinc-700" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Selecione uma aula para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:block shrink-0 border-l border-white/5 bg-[#0a0a0a] overflow-y-auto transition-all duration-500",
        sidebarWidth
      )}>
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">Conteúdo</p>
              <h3 className="font-display text-[12px] font-bold text-zinc-200 tracking-tight">{modules.length} módulos · {totalLessons} aulas</h3>
            </div>
          </div>
        </div>
        <CourseSidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#050505]/80 z-40 lg:hidden backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease }}
              className="fixed top-0 right-0 bottom-0 w-[88vw] max-w-[420px] bg-[#0a0a0a] border-l border-white/10 z-50 lg:hidden overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">Conteúdo</p>
                    <h3 className="font-display text-[12px] font-bold text-zinc-200 tracking-tight">{totalLessons} aulas</h3>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-zinc-400" />
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
