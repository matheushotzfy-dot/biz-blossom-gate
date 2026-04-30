/**
 * MemberCourse — Cinematic Course Player
 * @module MemberCourse
 * @version 6.0.0 — Ultra Premium Player Experience
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
 Play, CheckCircle2, ChevronDown, BookOpen, Clock,
 ArrowLeft, ArrowRight, FileText, Video, ChevronLeft, List,
 Award, X, Check, Layers, GraduationCap, Maximize2, Minimize2,
 Sparkles, Trophy, Flame, Download, Paperclip, ExternalLink,
 Keyboard, Star,
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
 const [theaterMode, setTheaterMode] = useState(false);
 const [attachments, setAttachments] = useState<Attachment[]>([]);
 const [showCelebration, setShowCelebration] = useState(false);
 const [certificate, setCertificate] = useState<{ code: string } | null>(null);

 useEffect(() => { if (courseId && user) loadCourse(); }, [courseId, user]);

 // Keyboard shortcuts
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
 loadAttachments(targetLesson.id);
 }
 } else if (enrichedModules.length > 0 && enrichedModules[0].lessons.length > 0) {
 setActiveLesson(enrichedModules[0].lessons[0]);
 loadAttachments(enrichedModules[0].lessons[0].id);
 }
 setLoading(false);
 // Fetch certificate if exists
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
 // Track lesson view (updates progress.updated_at → powers "Continue watching")
 if (user && !progress.get(lesson.id)?.completed) {
 supabase.from("user_progress").upsert(
 { user_id: user.id, lesson_id: lesson.id, completed: false, progress_seconds: 1 },
 { onConflict: "user_id,lesson_id" }
 ).then(({ error }) => {
 if (!error) {
 setProgress(prev => {
 const next = new Map(prev);
 const existing = next.get(lesson.id);
 if (!existing) next.set(lesson.id, { lesson_id: lesson.id, completed: false, progress_seconds: 1 });
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

 // Check if course completed
 const allLessons = modules.flatMap(m => m.lessons);
 const newCompleted = [...progress.values()].filter(p => p.completed).length + 1;
 if (newCompleted >= allLessons.length) {
 setShowCelebration(true);
 setTimeout(() => setShowCelebration(false), 5000);
 // Certificate is auto-issued by DB trigger; fetch it
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
      <div className="h-1 w-32 bg-white/5 overflow-hidden">
        <motion.div className="h-full w-full bg-emerald-500" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
      </div>
    </div>
  );

  if (!course) return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 bg-[#050505] text-zinc-100">
      <div className="h-16 w-16 rounded-sm bg-zinc-900 border border-white/10 flex items-center justify-center">
        <GraduationCap className="h-7 w-7 text-zinc-700" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-zinc-100 tracking-tight">Curso não encontrado</h1>
      <Link to="/membros-area" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-emerald-400 font-bold transition-colors">← Voltar ao início</Link>
    </div>
  );

  const sidebarWidth = theaterMode ? "lg:w-0 lg:opacity-0 lg:pointer-events-none" : "w-[360px] xl:w-[400px]";

  /* ─── Sidebar Component — Cakto style: numbered, dense, dark ─── */
  const CourseSidebar = () => (
    <div className="p-4 space-y-3">
 {/* Progress */}
 <div className="p-3.5 rounded-xl bg-card/40 border border-border/10 relative overflow-hidden">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", isComplete ? "bg-success/10" : "bg-primary/10")}>
 {isComplete ? <Trophy className="h-3.5 w-3.5 text-success" /> : <Flame className="h-3.5 w-3.5 text-primary" />}
 </div>
 <span className="text-[11px] font-display font-bold text-foreground/60">Progresso</span>
 </div>
 <span className={cn("text-base font-display font-black tabular-nums", isComplete ? "text-success" : "text-primary")}>{overallPct}%</span>
 </div>
 <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${overallPct}%` }}
 transition={{ duration: 1, delay: 0.3, ease }}
 className={cn("h-full rounded-full", isComplete ? "bg-success" : "bg-primary")}
 />
 </div>
 <p className="text-[10px] text-muted-foreground/30 mt-2 font-display tabular-nums">{completedLessons}/{totalLessons} aulas concluídas</p>
 {isComplete && (
 <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
 className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-success/8 border border-success/12">
 <Trophy className="h-4 w-4 text-success" />
 <div>
 <span className="text-[11px] font-display font-bold text-success block">Parabéns! 🎉</span>
 <span className="text-[9px] text-success/50 font-display">Curso concluído</span>
 </div>
 </motion.div>
 )}
 </div>

 {/* Keyboard shortcuts hint */}
 <div className="px-3 py-2 rounded-lg bg-muted/5 border border-border/5">
 <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/25 font-display">
 <Keyboard className="h-3 w-3" />
 <span>← → navegar</span>
 <span className="text-border/20">·</span>
 <span>C concluir</span>
 <span className="text-border/20">·</span>
 <span>T teatro</span>
 </div>
 </div>

 {/* Modules */}
 <div className="space-y-1.5">
 {modules.map((mod, modIdx) => {
 const modCompleted = mod.lessons.filter(l => progress.get(l.id)?.completed).length;
 const modPct = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
 const isModComplete = modPct === 100 && mod.lessons.length > 0;

 return (
 <div key={mod.id} className="rounded-xl overflow-hidden bg-card/20 border border-border/8 hover:border-border/15 transition-all duration-300">
 <button onClick={() => toggleModule(mod.id)} className="w-full text-left transition-colors hover:bg-card/20">
 {mod.banner_url ? (
 <div className="aspect-[3.5/1] overflow-hidden relative">
 <img src={mod.banner_url} alt="" className="w-full h-full object-cover" />
 <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
 <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
 <div>
 <p className="text-foreground text-[11px] font-display font-bold line-clamp-1">{mod.title}</p>
 <p className="text-foreground/40 text-[9px] font-display tabular-nums mt-0.5">{mod.lessons.length} aulas · {modPct}%</p>
 </div>
 <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 180 : 0 }} transition={{ duration: 0.2 }}>
 <ChevronDown className="h-3 w-3 text-foreground/30" />
 </motion.div>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-between p-3 relative">
 {isModComplete && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-success" />}
 <div className="flex items-center gap-2.5 min-w-0">
 <div className={cn(
 "h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-display font-black shrink-0",
 isModComplete ? "bg-success/10 text-success" : "bg-card/60 text-muted-foreground/30"
 )}>
 {isModComplete ? <Check className="h-3.5 w-3.5" /> : modIdx + 1}
 </div>
 <div className="min-w-0">
 <p className="text-[11px] font-display font-bold text-foreground/80 line-clamp-1">{mod.title}</p>
 <p className="text-[9px] text-muted-foreground/30 font-display tabular-nums mt-0.5">{modCompleted}/{mod.lessons.length}</p>
 </div>
 </div>
 <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 180 : 0 }} transition={{ duration: 0.2 }}>
 <ChevronDown className="h-3 w-3 text-muted-foreground/20 shrink-0" />
 </motion.div>
 </div>
 )}
 {mod.lessons.length > 0 && (
 <div className="h-[2px] bg-foreground/[0.03]">
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
 transition={{ duration: 0.25, ease }}
 className="overflow-hidden"
 >
 <div className="border-t border-border/5 py-1 px-1">
 {mod.lessons.map((lesson, lIdx) => {
 const isActive = activeLesson?.id === lesson.id;
 const isCompleted = progress.get(lesson.id)?.completed;
 const isVideo = lesson.video_url && lesson.video_url.trim().length > 0;
 return (
 <button key={lesson.id} onClick={() => selectLesson(lesson)}
 className={cn(
 "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-200 rounded-lg relative",
 isActive ? "bg-primary/8" : "hover:bg-foreground/[0.02]"
 )}>
 {isActive && (
 <motion.div layoutId="member-lesson-active" className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
 )}
 <div className="shrink-0">
 {isCompleted ? (
 <div className="h-6 w-6 rounded-md bg-success/10 flex items-center justify-center">
 <CheckCircle2 className="h-3 w-3 text-success" />
 </div>
 ) : isActive ? (
 <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shadow-md shadow-primary/25">
 <Play className="h-2.5 w-2.5 text-primary-foreground ml-[1px] fill-current" />
 </div>
 ) : (
 <span className="h-6 w-6 rounded-md bg-foreground/[0.03] flex items-center justify-center text-[9px] text-muted-foreground/20 font-display font-black">{lIdx + 1}</span>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className={cn(
 "text-[11px] truncate font-display",
 isCompleted ? "text-muted-foreground/40 line-through" : isActive ? "text-foreground font-bold" : "text-foreground/50 font-semibold"
 )}>
 {lesson.title}
 </p>
 <div className="flex items-center gap-1.5 mt-0.5">
 {lesson.duration_minutes > 0 && (
 <span className="text-[9px] text-muted-foreground/20 flex items-center gap-0.5 font-display tabular-nums"><Clock className="h-2 w-2" /> {lesson.duration_minutes}min</span>
 )}
 {isVideo ? (
 <span className="text-[9px] text-muted-foreground/15 flex items-center gap-0.5 font-display"><Video className="h-2 w-2" /> Vídeo</span>
 ) : (
 <span className="text-[9px] text-muted-foreground/15 flex items-center gap-0.5 font-display"><FileText className="h-2 w-2" /> Texto</span>
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
 <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)]">
 {/* ═══ Celebration Modal ═══ */}
 <AnimatePresence>
 {showCelebration && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-2xl"
 onClick={() => setShowCelebration(false)}
 >
 <motion.div
 initial={{ scale: 0.8, opacity: 0, y: 20 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 0.9, opacity: 0 }}
 transition={{ duration: 0.5, ease }}
 className="text-center p-10 max-w-md"
 onClick={e => e.stopPropagation()}
 >
 <motion.div
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: 0.2, type: "spring", bounce: 0.4 }}
 className="mx-auto mb-6"
 >
 <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center mx-auto border border-success/20 shadow-2xl shadow-success/20">
 <Trophy className="h-12 w-12 text-success" />
 </div>
 </motion.div>
 <motion.h2
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 }}
 className="text-3xl font-display font-black text-foreground tracking-[-0.03em] mb-3"
 >
 Curso Concluído! 🎉
 </motion.h2>
 <motion.p
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.6 }}
 className="text-sm text-muted-foreground/60 font-display mb-6"
 >
 Parabéns! Você completou todas as {totalLessons} aulas de <strong className="text-foreground">{course.title}</strong>
 </motion.p>
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.8 }}
 className="flex flex-wrap items-center justify-center gap-3"
 >
 {certificate && (
 <Link to={`/certificado/${certificate.code}`} target="_blank"
 className="px-6 py-3 rounded-xl bg-success text-success-foreground text-sm font-display font-bold hover:bg-success/90 transition-all active:scale-[0.97] shadow-lg flex items-center gap-2">
 <Award className="h-4 w-4" /> Ver certificado
 </Link>
 )}
 <Link to="/membros-area"
 className="px-6 py-3 rounded-xl bg-foreground text-background text-sm font-display font-bold hover:bg-foreground/90 transition-all active:scale-[0.97] shadow-lg">
 Voltar aos cursos
 </Link>
 <button onClick={() => setShowCelebration(false)}
 className="px-6 py-3 rounded-xl bg-foreground/5 text-foreground/60 text-sm font-display font-bold hover:bg-foreground/10 transition-all active:scale-[0.97]">
 Continuar aqui
 </button>
 </motion.div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

      {/* ═══ Main Content — Cinematic ═══ */}
      <div className="flex-1 overflow-y-auto bg-background relative">
        {/* Floating top bar */}
        <div className="sticky top-0 z-20 bg-background/70 backdrop-blur-2xl border-b border-border/10 px-4 sm:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link to="/membros-area" className="h-9 w-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center transition-all shrink-0 group">
                <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </Link>
              <div className="min-w-0">
                <p className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Curso</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <h1 className="text-[13px] font-display font-black text-foreground truncate tracking-[-0.02em]">{course.title}</h1>
                  {isComplete && (
                    <div className="h-4 w-4 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                      <Award className="h-2.5 w-2.5 text-success" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-1 rounded-full bg-foreground/8 overflow-hidden w-24 lg:w-32">
                  <div className={cn("h-full rounded-full transition-all duration-700", isComplete ? "bg-success" : "bg-primary")} style={{ width: `${overallPct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground/55 font-display font-bold tabular-nums">{overallPct}%</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => navigateLesson(-1)} disabled={currentIdx <= 0}
                className="h-9 w-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center transition-all disabled:opacity-15 active:scale-95"
                title="Aula anterior (←)">
                <ArrowLeft className="h-4 w-4 text-muted-foreground/50" />
              </button>
              <button onClick={() => navigateLesson(1)} disabled={currentIdx >= totalLessons - 1}
                className="h-9 w-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center transition-all disabled:opacity-15 active:scale-95"
                title="Próxima aula (→)">
                <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
              <button onClick={() => setTheaterMode(!theaterMode)}
                className="hidden lg:flex h-9 w-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] items-center justify-center transition-all active:scale-95"
                title={theaterMode ? "Modo normal (T)" : "Modo teatro (T)"}>
                {theaterMode ? <Minimize2 className="h-4 w-4 text-muted-foreground/50" /> : <Maximize2 className="h-4 w-4 text-muted-foreground/50" />}
              </button>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-9 w-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center transition-all lg:hidden active:scale-95">
                <List className="h-4 w-4 text-muted-foreground/50" />
              </button>
            </div>
          </div>
        </div>

        {/* Video Stage — full bleed cinematic */}
        {activeLesson && (
          <motion.div
            key={`stage-${activeLesson.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease }}
            className="relative w-full bg-black"
          >
            <div className={cn("mx-auto", theaterMode ? "max-w-[1600px]" : "max-w-[1200px]")}>
              {hasVideo ? (
                <div className="aspect-video w-full bg-black relative">
                  <VideoPlayer url={activeLesson.video_url!} />
                </div>
              ) : (
                <div className="aspect-video w-full bg-gradient-to-br from-card via-background to-black flex flex-col items-center justify-center text-center p-8">
                  <div className="h-20 w-20 rounded-2xl bg-primary/8 flex items-center justify-center mb-5 border border-primary/10">
                    <FileText className="h-9 w-9 text-primary/40" />
                  </div>
                  <h3 className="text-2xl font-display font-black text-foreground tracking-[-0.02em]">{activeLesson.title}</h3>
                  <p className="text-sm text-muted-foreground/50 mt-2 font-display">Conteúdo em texto — leia abaixo</p>
                </div>
              )}
            </div>
            {/* fade-out gradient bottom */}
            <div className="absolute inset-x-0 -bottom-px h-24 bg-gradient-to-b from-transparent to-background pointer-events-none" />
          </motion.div>
        )}

        {/* Lesson detail strip */}
        <div className={cn("mx-auto px-4 sm:px-8 lg:px-12 pb-12 pt-8", theaterMode ? "max-w-[1200px]" : "max-w-[1100px]")}>
          {activeLesson ? (
            <motion.div
              key={`meta-${activeLesson.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: 0.1 }}
              className="space-y-6"
            >
              {/* Title block */}
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pb-6 border-b border-border/10">
                <div className="min-w-0 flex-1">
                  {activeModule && (
                    <p className="text-[10px] text-primary/70 font-display font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <span className="inline-block h-px w-6 bg-primary/30" />
                      {activeModule.title}
                      <span className="text-muted-foreground/30">·</span>
                      <span className="tabular-nums text-muted-foreground/60">Aula {currentIdx + 1} de {totalLessons}</span>
                    </p>
                  )}
                  <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-display font-black text-foreground tracking-[-0.035em] leading-[1.05]">{activeLesson.title}</h2>
                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground/55 font-display flex-wrap">
                    {hasVideo
                      ? <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-primary/60" /> Vídeo HD</span>
                      : <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary/60" /> Conteúdo</span>}
                    {activeLesson.duration_minutes > 0 && (
                      <><span className="text-border/40">·</span><span className="flex items-center gap-1.5 tabular-nums"><Clock className="h-3.5 w-3.5" /> {activeLesson.duration_minutes} min</span></>
                    )}
                    {attachments.length > 0 && (
                      <><span className="text-border/40">·</span><span className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {attachments.length} anexo{attachments.length > 1 ? "s" : ""}</span></>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => markComplete(activeLesson.id)}
                    disabled={progress.get(activeLesson.id)?.completed}
                    className={cn(
                      "flex items-center gap-2 px-6 h-12 rounded-full text-[13px] font-display font-bold transition-all active:scale-[0.97]",
                      progress.get(activeLesson.id)?.completed
                        ? "bg-success/12 text-success border border-success/20"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    )}>
                    <CheckCircle2 className="h-4 w-4" />
                    {progress.get(activeLesson.id)?.completed ? "Concluída" : "Marcar como concluída"}
                  </button>
                  {currentIdx < totalLessons - 1 && (
                    <button onClick={() => navigateLesson(1)}
                      className="flex items-center gap-1.5 px-5 h-12 rounded-full text-[13px] font-display font-bold bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground transition-all active:scale-[0.97]">
                      Próxima <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              {activeLesson.description && (
                <div className="prose prose-invert max-w-none">
                  <p className="text-[15px] text-foreground/75 leading-[1.75] whitespace-pre-wrap font-display">{activeLesson.description}</p>
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.18em] mb-3 flex items-center gap-2">
                    <Paperclip className="h-3 w-3" /> Materiais de apoio
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {attachments.map(att => (
                      <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                        className="group flex items-center gap-3 p-3.5 rounded-xl bg-card/40 border border-border/10 hover:border-primary/25 hover:bg-primary/5 transition-all active:scale-[0.99]">
                        <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                          <Download className="h-4 w-4 text-primary/60 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-display font-bold text-foreground/80 truncate group-hover:text-foreground transition-colors">{att.file_name}</p>
                          <p className="text-[10px] text-muted-foreground/40 font-display tabular-nums">{formatFileSize(att.file_size)}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/25 group-hover:text-primary/60 transition-colors shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificate banner */}
              {certificate && (
                <Link to={`/certificado/${certificate.code}`} target="_blank"
                  className="block rounded-2xl bg-gradient-to-br from-success/12 to-success/4 border border-success/20 p-5 hover:border-success/40 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-success/15 flex items-center justify-center shrink-0">
                      <Award className="h-7 w-7 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-display font-black text-foreground tracking-[-0.01em]">Seu certificado está pronto</p>
                      <p className="text-xs text-muted-foreground/70 font-display mt-1">Código <span className="font-mono text-success">{certificate.code}</span> · Toque para abrir e imprimir</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-success/60 group-hover:text-success transition-colors shrink-0" />
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
            <div className="aspect-video max-h-[480px] rounded-2xl bg-card/30 border border-border/10 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-foreground/[0.03] flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground/15" />
                </div>
                <p className="text-muted-foreground/50 font-display font-bold text-sm">Selecione uma aula para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

 {/* ═══ Desktop Sidebar ═══ */}
 <aside className={cn(
 "hidden lg:block shrink-0 border-l border-border/10 bg-card/5 overflow-y-auto transition-all duration-500",
 sidebarWidth
 )}>
 <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-2xl border-b border-border/10 p-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center">
 <Layers className="h-3.5 w-3.5 text-primary/40" />
 </div>
 <h3 className="text-[11px] font-display font-black text-foreground/60 tracking-tight">Conteúdo</h3>
 </div>
 <span className="text-[9px] font-display font-bold text-muted-foreground/30 bg-foreground/[0.03] px-2 py-0.5 rounded-md tabular-nums">{totalLessons} aulas</span>
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
 transition={{ duration: 0.3, ease }}
 className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-[380px] bg-background/95 backdrop-blur-2xl border-l border-border/10 z-50 lg:hidden overflow-y-auto shadow-2xl"
 >
 <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-2xl border-b border-border/10 p-3.5 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center">
 <Layers className="h-3.5 w-3.5 text-primary/40" />
 </div>
 <h3 className="text-sm font-display font-black text-foreground/70 tracking-tight">Conteúdo</h3>
 </div>
 <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 rounded-lg bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center transition-colors">
 <X className="h-4 w-4 text-muted-foreground/40" />
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
