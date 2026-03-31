import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, GripVertical, X,
  ChevronRight, Clock, Video, FileText,
  Calendar, Paperclip, ArrowLeft, Eye, EyeOff, Upload,
  Globe, Lock, CheckCircle2, Loader2, AlertCircle, Hash,
  Download, File, Sparkles, Shield, ChevronDown, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
  id: string; title: string; description: string | null; is_published: boolean;
  user_id: string; product_id: string | null;
}
interface Module {
  id: string; course_id: string; title: string; description: string | null;
  sort_order: number | null; lessons: Lesson[];
}
interface Lesson {
  id: string; module_id: string; title: string; description: string | null;
  video_url: string | null; duration_minutes: number | null; is_free: boolean;
  sort_order: number | null; drip_days: number | null;
}
interface Attachment {
  id: string; lesson_id: string; user_id: string; file_name: string;
  file_url: string; file_size: number; file_type: string; created_at: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Helpers ──────────────────────────────────────────────────────
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getVideoEmbed(url: string) {
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

function getVideoThumbnail(url: string) {
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  return null;
}

function isDirectVideoUrl(url: string) {
  return url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i);
}

// ═══════════════════════════════════════════════════════════════════
export default function CourseBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);

  const [editingLessonTitle, setEditingLessonTitle] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDripDays, setLessonDripDays] = useState(0);
  const [lessonIsFree, setLessonIsFree] = useState(false);
  const [lessonDripEnabled, setLessonDripEnabled] = useState(false);
  const [lessonDuration, setLessonDuration] = useState(0);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [showNewModule, setShowNewModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // ─── Load All ───────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!courseId) return;
    const [courseRes, modsRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order"),
    ]);
    if (courseRes.data) setCourse(courseRes.data as Course);
    const mods = modsRes.data || [];
    const moduleIds = mods.map(m => m.id);
    let lessons: Lesson[] = [];
    if (moduleIds.length > 0) {
      const { data: l } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      if (l) lessons = l as Lesson[];
    }
    const mapped = mods.map(m => ({ ...m, lessons: lessons.filter(l => l.module_id === m.id) })) as Module[];
    setModules(mapped);
    setExpandedModules(new Set(mods.map(m => m.id)));
    setLoading(false);
  }, [courseId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadAttachments = useCallback(async (lessonId: string) => {
    const { data } = await supabase
      .from("lesson_attachments" as any).select("*")
      .eq("lesson_id", lessonId).order("created_at", { ascending: false });
    setAttachments((data || []) as unknown as Attachment[]);
  }, []);

  // ─── Auto-save ──────────────────────────────────────────────────
  const autoSave = useCallback(async (field: string, value: any) => {
    if (!selectedLesson) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("lessons").update({ [field]: value }).eq("id", selectedLesson.id);
    if (error) { setSaveStatus("error"); return; }
    setSaveStatus("saved");
    setModules(prev => prev.map(m => ({
      ...m, lessons: m.lessons.map(l => l.id === selectedLesson.id ? { ...l, [field]: value } : l)
    })));
    setSelectedLesson(prev => prev ? { ...prev, [field]: value } : prev);
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [selectedLesson]);

  const debouncedSave = useCallback((field: string, value: any) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => autoSave(field, value), 1200);
  }, [autoSave]);

  // ─── Select Lesson ──────────────────────────────────────────────
  const selectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || "");
    setLessonVideoUrl(lesson.video_url || "");
    setLessonDripDays(lesson.drip_days || 0);
    setLessonIsFree(lesson.is_free);
    setLessonDripEnabled((lesson.drip_days || 0) > 0);
    setLessonDuration(lesson.duration_minutes || 0);
    setEditingLessonTitle(false);
    loadAttachments(lesson.id);
  };

  // ─── Video Upload ───────────────────────────────────────────────
  const handleVideoUpload = async (file: File) => {
    if (!user || !selectedLesson) return;
    const ALLOWED = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
    if (!ALLOWED.includes(file.type)) { toast.error("Formato inválido. Use MP4, WebM ou OGG."); return; }
    if (file.size > 500 * 1024 * 1024) { toast.error("Máximo 500MB."); return; }
    setUploadingVideo(true); setVideoUploadProgress(0);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/videos/${crypto.randomUUID()}.${ext}`;
    const progressInterval = setInterval(() => {
      setVideoUploadProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    const { error } = await supabase.storage.from("course-content").upload(path, file);
    clearInterval(progressInterval);
    if (error) { toast.error("Erro no upload"); setUploadingVideo(false); setVideoUploadProgress(0); return; }
    setVideoUploadProgress(100);
    const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
    setLessonVideoUrl(urlData.publicUrl);
    await autoSave("video_url", urlData.publicUrl);
    setUploadingVideo(false); setVideoUploadProgress(0);
    toast.success("Vídeo enviado!");
  };

  // ─── Attachment Upload ──────────────────────────────────────────
  const handleAttachmentUpload = async (file: File) => {
    if (!user || !selectedLesson) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Máximo 50MB."); return; }
    setUploadingAttachment(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/attachments/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("course-content").upload(path, file);
    if (uploadError) { toast.error("Erro no upload"); setUploadingAttachment(false); return; }
    const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
    const { error: dbError } = await supabase.from("lesson_attachments" as any).insert({
      lesson_id: selectedLesson.id, user_id: user.id,
      file_name: file.name, file_url: urlData.publicUrl, file_size: file.size, file_type: file.type,
    });
    if (dbError) { toast.error("Erro ao salvar"); setUploadingAttachment(false); return; }
    await loadAttachments(selectedLesson.id);
    setUploadingAttachment(false); toast.success("Anexo adicionado!");
  };

  const deleteAttachment = async (att: Attachment) => {
    await supabase.from("lesson_attachments" as any).delete().eq("id", att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    toast.success("Anexo removido");
  };

  // ─── Module CRUD ────────────────────────────────────────────────
  const createModule = async () => {
    if (!courseId || !newModuleTitle.trim()) return;
    await supabase.from("modules").insert({ course_id: courseId, title: newModuleTitle.trim(), sort_order: modules.length });
    setNewModuleTitle(""); setShowNewModule(false);
    toast.success("Módulo criado!"); loadAll();
  };

  const renameModule = async (id: string, title: string) => {
    if (!title.trim()) return;
    await supabase.from("modules").update({ title: title.trim() }).eq("id", id);
    setEditingModuleId(null); loadAll();
  };

  const deleteModule = async (id: string) => {
    if (!window.confirm("Excluir este módulo e todas as suas aulas?")) return;
    await supabase.from("lessons").delete().in("module_id", [id]);
    await supabase.from("modules").delete().eq("id", id);
    if (selectedLesson && modules.find(m => m.id === id)?.lessons.some(l => l.id === selectedLesson.id)) {
      setSelectedLesson(null);
    }
    toast.success("Módulo excluído"); loadAll();
  };

  // ─── Lesson CRUD ───────────────────────────────────────────────
  const createLesson = async (moduleId: string) => {
    const mod = modules.find(m => m.id === moduleId);
    const { data } = await supabase.from("lessons").insert({
      module_id: moduleId, title: "Nova Aula", sort_order: mod?.lessons.length || 0
    }).select().single();
    toast.success("Aula criada!");
    await loadAll();
    if (data) selectLesson(data as Lesson);
  };

  const deleteLesson = async (id: string) => {
    if (!window.confirm("Excluir esta aula?")) return;
    await supabase.from("lesson_attachments" as any).delete().eq("lesson_id", id);
    await supabase.from("lessons").delete().eq("id", id);
    if (selectedLesson?.id === id) setSelectedLesson(null);
    toast.success("Aula excluída"); loadAll();
  };

  // ─── Drag & Drop ───────────────────────────────────────────────
  const reorderLessons = async (moduleId: string, newOrder: Lesson[]) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, lessons: newOrder } : m));
    setSaveStatus("saving");
    await Promise.all(newOrder.map((l, i) => supabase.from("lessons").update({ sort_order: i }).eq("id", l.id)));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  // ─── Publish ───────────────────────────────────────────────────
  const togglePublish = async () => {
    if (!course || !user) return;
    await supabase.from("courses").update({ is_published: !course.is_published }).eq("id", course.id).eq("user_id", user.id);
    setCourse(prev => prev ? { ...prev, is_published: !prev.is_published } : prev);
    toast.success(course.is_published ? "Despublicado" : "Publicado!");
  };

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ─── Loading / Error ───────────────────────────────────────────
  if (loading) return (
    <div className="h-screen w-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-xs text-muted-foreground/50 font-display">Carregando curso...</p>
      </div>
    </div>
  );

  if (!course) return (
    <div className="h-screen w-screen bg-background flex items-center justify-center flex-col gap-4">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <p className="text-muted-foreground text-sm font-display">Curso não encontrado</p>
      <Button variant="ghost" onClick={() => navigate("/vendas/conteudo")} className="rounded-xl font-display font-bold">Voltar</Button>
    </div>
  );

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
  const completedLessons = modules.reduce((a, m) => a + m.lessons.filter(l => l.video_url).length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* ═══ Top Bar ═══ */}
      <header className="h-[52px] border-b border-border/30 bg-card/90 backdrop-blur-xl flex items-center justify-between px-3 sm:px-5 shrink-0 z-50">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/vendas/conteudo")}
            className="h-8 w-8 rounded-xl bg-muted/20 border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-all duration-300 active:scale-[0.985]"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <div className="h-4 w-px bg-border/30 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h1 className="text-[13px] font-display font-black text-foreground leading-none truncate max-w-[180px] lg:max-w-[300px]">{course.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-bold text-muted-foreground/40">{modules.length} módulos · {totalLessons} aulas</span>
                {totalLessons > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-12 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-[9px] font-display font-bold text-primary/70">{progressPct}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          <AnimatePresence mode="wait">
            <motion.div key={saveStatus} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="hidden sm:flex items-center gap-1.5 mr-1">
              {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" /><span className="text-[10px] text-muted-foreground/50 font-display font-bold">Salvando...</span></>}
              {saveStatus === "saved" && <><CheckCircle2 className="h-3 w-3 text-success" /><span className="text-[10px] text-success font-display font-bold">Salvo</span></>}
              {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /><span className="text-[10px] text-destructive font-display font-bold">Erro</span></>}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={togglePublish}
            className={cn(
              "h-8 px-3.5 rounded-xl text-[11px] font-display font-bold flex items-center gap-1.5 transition-all duration-300 active:scale-[0.985]",
              course.is_published
                ? "bg-success/10 text-success border border-success/20 hover:bg-success/15"
                : "bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40"
            )}
          >
            {course.is_published ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Publicado</>
            ) : (
              <><EyeOff className="h-3 w-3" /> Rascunho</>
            )}
          </button>
        </div>
      </header>

      {/* ═══ Split Screen ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT: Sidebar ─── */}
        <aside className={cn(
          "bg-card/50 backdrop-blur-sm border-r border-border/20 flex flex-col overflow-hidden shrink-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarCollapsed ? "w-0 min-w-0 border-r-0" : "w-[300px] lg:w-[320px] min-w-[280px]"
        )}>
          {/* Sidebar header */}
          <div className="px-3.5 py-3 border-b border-border/15 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                <Layers className="h-3 w-3 text-primary" />
              </div>
              <span className="text-[11px] font-display font-black text-foreground">Estrutura</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-display font-bold text-muted-foreground/30 bg-muted/10 px-2 py-0.5 rounded-md border border-border/15">
                {totalLessons} aulas
              </span>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-muted/20 transition-colors text-muted-foreground/30 hover:text-muted-foreground/60"
              >
                <ChevronRight className="h-3 w-3 rotate-180" />
              </button>
            </div>
          </div>

          {/* Modules list */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5" style={{ WebkitOverflowScrolling: "touch" }}>
            {modules.map((mod, idx) => (
              <div key={mod.id} className="rounded-xl overflow-hidden">
                {/* Module Header */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 cursor-pointer group transition-all duration-300",
                    expandedModules.has(mod.id)
                      ? "bg-muted/15 rounded-t-xl"
                      : "hover:bg-muted/10 rounded-xl"
                  )}
                  onClick={() => toggleExpand(mod.id)}
                >
                  <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 90 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                  </motion.div>
                  <div className={cn(
                    "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-display font-black ring-1",
                    expandedModules.has(mod.id) ? "bg-primary/10 text-primary ring-primary/15" : "bg-muted/15 text-muted-foreground/40 ring-border/15"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingModuleId === mod.id ? (
                      <input
                        autoFocus value={editingModuleTitle}
                        onChange={e => setEditingModuleTitle(e.target.value)}
                        onBlur={() => renameModule(mod.id, editingModuleTitle)}
                        onKeyDown={e => { if (e.key === "Enter") renameModule(mod.id, editingModuleTitle); if (e.key === "Escape") setEditingModuleId(null); }}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-[11px] font-display font-bold text-foreground bg-transparent focus:outline-none border-b border-primary/30 pb-0.5"
                      />
                    ) : (
                      <p
                        className="text-[11px] font-display font-bold text-foreground truncate"
                        onDoubleClick={e => { e.stopPropagation(); setEditingModuleId(mod.id); setEditingModuleTitle(mod.title); }}
                      >{mod.title}</p>
                    )}
                    <p className="text-[9px] text-muted-foreground/30 font-bold">{mod.lessons.length} aula{mod.lessons.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}
                    className="h-5 w-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-destructive/50" />
                  </button>
                </div>

                {/* Lessons */}
                <AnimatePresence>
                  {expandedModules.has(mod.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="bg-muted/[0.04] border-t border-border/10 px-1.5 py-1">
                        <Reorder.Group axis="y" values={mod.lessons} onReorder={newOrder => reorderLessons(mod.id, newOrder)} className="space-y-0.5">
                          {mod.lessons.map((lesson, li) => (
                            <Reorder.Item
                              key={lesson.id} value={lesson}
                              className={cn(
                                "relative flex items-center gap-2 pl-3 pr-2 py-[7px] rounded-lg cursor-pointer group/lesson transition-all duration-300",
                                selectedLesson?.id === lesson.id
                                  ? "bg-primary/8 border border-primary/15"
                                  : "hover:bg-muted/10 border border-transparent"
                              )}
                              onClick={() => selectLesson(lesson)}
                            >
                              {selectedLesson?.id === lesson.id && (
                                <motion.div layoutId="lesson-accent" className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                              )}
                              <GripVertical className="h-3 w-3 text-muted-foreground/15 opacity-0 group-hover/lesson:opacity-100 cursor-grab shrink-0 transition-opacity" />
                              <div className={cn(
                                "h-5 w-5 rounded-md ring-1 flex items-center justify-center shrink-0 text-[8px] font-display font-black",
                                selectedLesson?.id === lesson.id ? "bg-primary/10 ring-primary/15 text-primary" : "bg-muted/10 ring-border/10 text-muted-foreground/25"
                              )}>
                                {li + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-[11px] truncate font-display", selectedLesson?.id === lesson.id ? "text-primary font-bold" : "text-foreground/60 font-semibold")}>{lesson.title}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {lesson.is_free && <span className="text-[7px] bg-success/10 text-success px-1 rounded font-black leading-[14px]">FREE</span>}
                                  {lesson.video_url && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                                  {!lesson.video_url && <span className="h-1.5 w-1.5 rounded-full bg-warning/40" />}
                                  {(lesson.drip_days || 0) > 0 && <Clock className="h-2 w-2 text-warning/40" />}
                                </div>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                className="h-5 w-5 rounded-md flex items-center justify-center opacity-0 group-hover/lesson:opacity-100 hover:bg-destructive/10 transition-all shrink-0"
                              >
                                <Trash2 className="h-2.5 w-2.5 text-destructive/40" />
                              </button>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>

                        <button
                          onClick={() => createLesson(mod.id)}
                          className="w-full mt-0.5 flex items-center gap-2 px-3 py-[7px] rounded-lg text-muted-foreground/25 hover:text-primary hover:bg-primary/5 transition-all duration-300"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="text-[10px] font-display font-bold">Nova aula</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* New Module */}
            {showNewModule ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-2.5">
                <input
                  autoFocus value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createModule(); if (e.key === "Escape") setShowNewModule(false); }}
                  placeholder="Nome do módulo..."
                  className="w-full bg-transparent text-[12px] font-display font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button onClick={createModule} className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[10px] font-display font-bold hover:bg-primary/90 transition-colors">Criar</button>
                  <button onClick={() => setShowNewModule(false)} className="h-7 px-3 rounded-lg bg-muted/20 text-muted-foreground text-[10px] font-display font-bold hover:bg-muted/30 transition-colors">Cancelar</button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowNewModule(true)}
                className="w-full rounded-xl border border-dashed border-border/20 py-3.5 flex flex-col items-center gap-1 text-muted-foreground/20 hover:text-primary hover:border-primary/20 hover:bg-primary/[0.02] transition-all duration-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-[10px] font-display font-bold">Novo Módulo</span>
              </button>
            )}
          </div>
        </aside>

        {/* Sidebar toggle (when collapsed) */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute left-2 top-[68px] z-40 h-8 w-8 rounded-xl bg-card/90 backdrop-blur-sm border border-border/20 flex items-center justify-center hover:bg-muted/30 transition-all shadow-sm"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          </button>
        )}

        {/* ─── RIGHT: Lesson Editor ─── */}
        <main className="flex-1 bg-background overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          {selectedLesson ? (
            <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-8 space-y-5">

              {/* Lesson Header */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="h-5 w-5 rounded-md bg-primary/8 ring-1 ring-primary/10 flex items-center justify-center">
                    <Hash className="h-2.5 w-2.5 text-primary/60" />
                  </div>
                  <span className="text-[9px] font-display font-black uppercase tracking-[0.2em] text-primary/40">
                    {modules.find(m => m.lessons.some(l => l.id === selectedLesson.id))?.title}
                  </span>
                </div>
                {editingLessonTitle ? (
                  <input
                    ref={titleInputRef} value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onBlur={() => { setEditingLessonTitle(false); if (lessonTitle.trim() && lessonTitle !== selectedLesson.title) autoSave("title", lessonTitle.trim()); }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-transparent text-xl sm:text-2xl font-display font-black tracking-tight text-foreground focus:outline-none border-b-2 border-primary/20 pb-1.5"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => { setEditingLessonTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}
                    className="text-xl sm:text-2xl font-display font-black tracking-tight text-foreground cursor-text hover:text-foreground/70 transition-colors"
                  >
                    {lessonTitle || "Sem título"}
                  </h2>
                )}
              </div>

              {/* ─── Video Section ─── */}
              <div className="rounded-2xl bg-card/60 border border-border/20 overflow-hidden">
                {uploadingVideo ? (
                  <div className="aspect-video flex flex-col items-center justify-center gap-4 p-6 bg-muted/5">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                    <div className="w-full max-w-xs">
                      <div className="flex justify-between text-[10px] mb-1.5">
                        <span className="font-display font-bold text-foreground/60">Enviando vídeo...</span>
                        <span className="font-display font-bold text-primary tabular-nums">{Math.round(videoUploadProgress)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted/15 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${videoUploadProgress}%` }} transition={{ ease: "easeOut" }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/30 font-display">Não feche esta página</p>
                  </div>
                ) : lessonVideoUrl ? (
                  <div className="relative">
                    {isDirectVideoUrl(lessonVideoUrl) ? (
                      <video controls className="w-full aspect-video bg-foreground/5" src={lessonVideoUrl} />
                    ) : getVideoEmbed(lessonVideoUrl) ? (
                      <iframe
                        src={getVideoEmbed(lessonVideoUrl)!}
                        className="w-full aspect-video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : getVideoThumbnail(lessonVideoUrl) ? (
                      <div className="relative aspect-video">
                        <img src={getVideoThumbnail(lessonVideoUrl)!} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-foreground/20 flex items-center justify-center">
                          <div className="h-14 w-14 rounded-full bg-card/80 backdrop-blur-xl flex items-center justify-center shadow-xl">
                            <PlayCircle className="h-7 w-7 text-primary" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                          <Video className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground font-display font-bold truncate">{lessonVideoUrl}</p>
                          <p className="text-[10px] text-primary/60 font-display font-bold">Vídeo vinculado</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                      className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-card/90 backdrop-blur-sm border border-border/20 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/20 transition-all shadow-sm"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-muted/5 transition-all duration-300 group/upload"
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleVideoUpload(f); }}
                  >
                    <div className="h-16 w-16 rounded-2xl bg-muted/8 border border-dashed border-border/20 flex items-center justify-center group-hover/upload:border-primary/20 group-hover/upload:bg-primary/5 transition-all duration-300">
                      <Upload className="h-6 w-6 text-muted-foreground/15 group-hover/upload:text-primary/40 transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-display font-bold text-foreground/30 group-hover/upload:text-foreground/60 transition-colors">Arraste um vídeo ou clique para enviar</p>
                      <p className="text-[11px] text-muted-foreground/20 mt-1 font-display">MP4, WebM, OGG — até 500MB</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/15 font-display">ou cole um link do YouTube/Vimeo abaixo</p>
                  </div>
                )}
              </div>
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); }} />

              {/* Video URL Input */}
              {!uploadingVideo && (
                <div className="relative">
                  <Video className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/20" />
                  <input
                    value={lessonVideoUrl}
                    onChange={e => { setLessonVideoUrl(e.target.value); debouncedSave("video_url", e.target.value || null); }}
                    placeholder="https://youtu.be/... ou https://vimeo.com/..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-card/50 border border-border/15 text-[12px] font-display text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/20 transition-all duration-300"
                  />
                </div>
              )}

              {/* ─── Description ─── */}
              <div className="rounded-2xl bg-card/60 border border-border/20 overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/10">
                  <div className="h-6 w-6 rounded-lg bg-primary/8 ring-1 ring-primary/10 flex items-center justify-center">
                    <FileText className="h-3 w-3 text-primary/60" />
                  </div>
                  <span className="text-[11px] font-display font-black text-foreground/70">Descrição da Aula</span>
                </div>
                <textarea
                  value={lessonDescription}
                  onChange={e => { setLessonDescription(e.target.value); debouncedSave("description", e.target.value || null); }}
                  placeholder="Descreva o que será abordado nesta aula..."
                  rows={5}
                  className="w-full bg-transparent p-5 text-[13px] text-foreground placeholder:text-muted-foreground/15 leading-relaxed focus:outline-none resize-none"
                />
              </div>

              {/* ─── Settings Grid ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Duration */}
                <div className="rounded-2xl bg-card/60 border border-border/20 p-4 hover:border-border/30 transition-all duration-300">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-info/8 ring-1 ring-info/10 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-info/60" />
                    </div>
                    <div>
                      <p className="text-[11px] font-display font-bold text-foreground/70">Duração</p>
                      <p className="text-[9px] text-muted-foreground/30">Tempo da aula</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} value={lessonDuration}
                      onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDuration(v); debouncedSave("duration_minutes", v); }}
                      className="h-8 w-14 rounded-lg bg-muted/8 border border-border/15 text-center text-[12px] font-display font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-info/15"
                    />
                    <span className="text-[10px] text-muted-foreground/30 font-display font-bold">min</span>
                  </div>
                </div>

                {/* Free Lesson */}
                <div className="rounded-2xl bg-card/60 border border-border/20 p-4 hover:border-border/30 transition-all duration-300">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-success/8 ring-1 ring-success/10 flex items-center justify-center">
                      <Globe className="h-3.5 w-3.5 text-success/60" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-display font-bold text-foreground/70">Gratuita</p>
                      <p className="text-[9px] text-muted-foreground/30">Sem compra</p>
                    </div>
                  </div>
                  <Switch checked={lessonIsFree} onCheckedChange={v => { setLessonIsFree(v); autoSave("is_free", v); }} />
                </div>

                {/* Drip */}
                <div className="rounded-2xl bg-card/60 border border-border/20 p-4 hover:border-border/30 transition-all duration-300">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-warning/8 ring-1 ring-warning/10 flex items-center justify-center">
                      <Calendar className="h-3.5 w-3.5 text-warning/60" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-display font-bold text-foreground/70">Gotejamento</p>
                      <p className="text-[9px] text-muted-foreground/30">Liberar após</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={lessonDripEnabled}
                      onCheckedChange={v => {
                        setLessonDripEnabled(v);
                        if (!v) { setLessonDripDays(0); autoSave("drip_days", 0); }
                      }}
                    />
                    <AnimatePresence>
                      {lessonDripEnabled && (
                        <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-1 overflow-hidden">
                          <input
                            type="number" min={0} value={lessonDripDays}
                            onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDripDays(v); debouncedSave("drip_days", v); }}
                            className="h-7 w-12 rounded-md bg-muted/8 border border-border/15 text-center text-[11px] font-display font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-warning/15"
                          />
                          <span className="text-[9px] text-muted-foreground/30 font-display font-bold whitespace-nowrap">dias</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* ─── Attachments ─── */}
              <div className="rounded-2xl bg-card/60 border border-border/20 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/10">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-lg bg-accent/10 ring-1 ring-accent/15 flex items-center justify-center">
                      <Paperclip className="h-3 w-3 text-accent-foreground/50" />
                    </div>
                    <div>
                      <span className="text-[11px] font-display font-black text-foreground/70">Anexos</span>
                      <span className="text-[9px] text-muted-foreground/30 ml-2">{attachments.length} arquivo{attachments.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="h-7 px-3 rounded-lg bg-muted/10 border border-border/15 text-[10px] font-display font-bold text-muted-foreground/50 hover:text-foreground hover:border-border/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {uploadingAttachment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Anexar
                  </button>
                </div>
                <input ref={attachmentInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachmentUpload(f); }} />

                <div className="p-3">
                  {attachments.length > 0 ? (
                    <div className="space-y-1">
                      {attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/5 group transition-all duration-300">
                          <div className="h-8 w-8 rounded-lg bg-muted/8 ring-1 ring-border/10 flex items-center justify-center shrink-0">
                            <File className="h-3.5 w-3.5 text-muted-foreground/30" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-display font-bold text-foreground/70 truncate">{att.file_name}</p>
                            <p className="text-[9px] text-muted-foreground/25 font-display tabular-nums">{formatFileSize(att.file_size)}</p>
                          </div>
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted/15 transition-colors opacity-0 group-hover:opacity-100">
                            <Download className="h-3 w-3 text-muted-foreground/40" />
                          </a>
                          <button onClick={() => deleteAttachment(att)} className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="h-3 w-3 text-destructive/40" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="rounded-xl border border-dashed border-border/10 py-6 flex flex-col items-center gap-2 text-muted-foreground/15 hover:text-muted-foreground/30 hover:border-border/20 transition-all duration-300 cursor-pointer"
                      onClick={() => attachmentInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleAttachmentUpload(f); }}
                    >
                      <Upload className="h-5 w-5" />
                      <p className="text-[10px] font-display font-bold">Arraste ou clique para enviar</p>
                      <p className="text-[9px]">PDF, DOCX, XLSX, ZIP — até 50MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Delete Lesson */}
              <div className="flex justify-end pt-1 pb-4">
                <button
                  onClick={() => deleteLesson(selectedLesson.id)}
                  className="flex items-center gap-1.5 text-[10px] font-display font-bold text-destructive/30 hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/5"
                >
                  <Trash2 className="h-3 w-3" /> Excluir aula
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/10 flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-muted-foreground/8" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-display font-bold text-foreground/20 mb-1">Selecione uma aula</p>
                <p className="text-[12px] text-muted-foreground/20 font-display">Clique em uma aula na barra lateral para editar</p>
              </div>
              {modules.length === 0 && (
                <Button onClick={() => setShowNewModule(true)} className="gap-2 rounded-xl font-display font-bold text-[11px] h-9 mt-2 shadow-lg shadow-primary/20">
                  <Plus className="h-3.5 w-3.5" /> Criar Primeiro Módulo
                </Button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
