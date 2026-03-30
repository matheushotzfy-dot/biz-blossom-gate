import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, GripVertical, X,
  ChevronRight, Clock, Video, FileText,
  Calendar, Paperclip, ArrowLeft, Eye, EyeOff, Upload,
  Globe, Lock, CheckCircle2, Loader2, AlertCircle, Hash,
  Download, File, Sparkles, Shield
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

// ─── Setting Card ─────────────────────────────────────────────────
function SettingCard({ icon, iconBg, iconColor, title, subtitle, children, accentColor = "primary", className, fullWidth }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; title: string; subtitle: string;
  children: React.ReactNode; accentColor?: string; className?: string; fullWidth?: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 p-5 overflow-hidden shadow-sm transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/60",
      fullWidth && "sm:col-span-2",
      className
    )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", `bg-${accentColor}`)} />
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-xl ring-1 flex items-center justify-center shrink-0", iconBg, `ring-${iconColor}/20`)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-foreground tracking-tight">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
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

  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // ─── Load All ───────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!courseId) return;
    const [courseRes, modsRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
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
      .from("lesson_attachments" as any)
      .select("*")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false });
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
    if (!ALLOWED.includes(file.type)) { toast.error("Formato de vídeo inválido. Use MP4, WebM ou OGG."); return; }
    if (file.size > 500 * 1024 * 1024) { toast.error("Vídeo muito grande. Máximo 500MB."); return; }

    setUploadingVideo(true);
    setVideoUploadProgress(0);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/videos/${crypto.randomUUID()}.${ext}`;

    const progressInterval = setInterval(() => {
      setVideoUploadProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);

    const { error } = await supabase.storage.from("course-content").upload(path, file);
    clearInterval(progressInterval);

    if (error) {
      toast.error("Erro no upload do vídeo");
      setUploadingVideo(false);
      setVideoUploadProgress(0);
      return;
    }

    setVideoUploadProgress(100);
    const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
    const videoUrl = urlData.publicUrl;

    setLessonVideoUrl(videoUrl);
    await autoSave("video_url", videoUrl);
    setUploadingVideo(false);
    setVideoUploadProgress(0);
    toast.success("Vídeo enviado com sucesso!");
  };

  // ─── Attachment Upload ──────────────────────────────────────────
  const handleAttachmentUpload = async (file: File) => {
    if (!user || !selectedLesson) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo 50MB."); return; }

    setUploadingAttachment(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/attachments/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("course-content").upload(path, file);
    if (uploadError) { toast.error("Erro no upload"); setUploadingAttachment(false); return; }

    const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);

    const { error: dbError } = await supabase.from("lesson_attachments" as any).insert({
      lesson_id: selectedLesson.id,
      user_id: user.id,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      file_type: file.type,
    });

    if (dbError) { toast.error("Erro ao salvar anexo"); setUploadingAttachment(false); return; }

    await loadAttachments(selectedLesson.id);
    setUploadingAttachment(false);
    toast.success("Anexo adicionado!");
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
    setEditingModuleId(null);
    loadAll();
  };

  const deleteModule = async (id: string) => {
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

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando curso...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center flex-col gap-4">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <p className="text-muted-foreground text-sm">Curso não encontrado</p>
        <Button variant="ghost" onClick={() => navigate("/vendas/conteudo")}>Voltar</Button>
      </div>
    );
  }

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* ═══ Top Bar ═══ */}
      <header className="h-14 border-b border-border/40 bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/vendas/conteudo")}
            className="h-9 w-9 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center hover:bg-muted/50 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.985]"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="h-5 w-px bg-border/40 hidden sm:block" />
          <div className="hidden sm:block">
            <h1 className="text-sm font-display font-black text-foreground leading-tight truncate max-w-[200px] lg:max-w-none tracking-tight">{course.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-muted-foreground">{modules.length} módulos</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="text-[10px] font-bold text-muted-foreground">{totalLessons} aulas</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <AnimatePresence mode="wait">
            <motion.div key={saveStatus} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hidden sm:flex items-center gap-1.5">
              {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Salvando...</span></>}
              {saveStatus === "saved" && <><CheckCircle2 className="h-3 w-3 text-success" /><span className="text-[11px] text-success font-bold">Salvo</span></>}
              {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /><span className="text-[11px] text-destructive">Erro</span></>}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={togglePublish}
            className={cn(
              "h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.985]",
              course.is_published
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-card/80 border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {course.is_published ? <><Eye className="h-3.5 w-3.5" /> Publicado</> : <><EyeOff className="h-3.5 w-3.5" /> Rascunho</>}
          </button>
        </div>
      </header>

      {/* ═══ Split Screen ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT: Sidebar ─── */}
        <aside className="w-[300px] lg:w-[340px] min-w-[280px] bg-card/60 backdrop-blur-sm border-r border-border/40 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                <Layers className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-display font-black text-foreground tracking-tight">Estrutura</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/30">{totalLessons} aulas</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {modules.map((mod, idx) => (
              <div key={mod.id} className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/40 overflow-hidden">
                {/* Module Header */}
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] group" onClick={() => toggleExpand(mod.id)}>
                  <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 90 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </motion.div>
                  <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-display font-black text-primary">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingModuleId === mod.id ? (
                      <input
                        autoFocus
                        value={editingModuleTitle}
                        onChange={e => setEditingModuleTitle(e.target.value)}
                        onBlur={() => renameModule(mod.id, editingModuleTitle)}
                        onKeyDown={e => { if (e.key === "Enter") renameModule(mod.id, editingModuleTitle); if (e.key === "Escape") setEditingModuleId(null); }}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-[12px] font-bold text-foreground bg-transparent focus:outline-none border-b border-primary/40"
                      />
                    ) : (
                      <p
                        className="text-[12px] font-display font-bold text-foreground truncate"
                        onDoubleClick={e => { e.stopPropagation(); setEditingModuleId(mod.id); setEditingModuleTitle(mod.title); }}
                      >{mod.title}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{mod.lessons.length} aulas</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}
                    className="h-6 w-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3 w-3 text-destructive/60" />
                  </button>
                </div>

                {/* Lessons */}
                <AnimatePresence>
                  {expandedModules.has(mod.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
                    >
                      <div className="border-t border-border/30 px-2 py-1.5">
                        <Reorder.Group axis="y" values={mod.lessons} onReorder={newOrder => reorderLessons(mod.id, newOrder)} className="space-y-0.5">
                          {mod.lessons.map(lesson => (
                            <Reorder.Item
                              key={lesson.id} value={lesson}
                              className={cn(
                                "relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer group/lesson transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                                selectedLesson?.id === lesson.id
                                  ? "bg-primary/10 border border-primary/20"
                                  : "hover:bg-muted/30 border border-transparent"
                              )}
                              onClick={() => selectLesson(lesson)}
                            >
                              {/* Active accent bar */}
                              {selectedLesson?.id === lesson.id && (
                                <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-primary" />
                              )}
                              <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover/lesson:opacity-100 cursor-grab shrink-0" />
                              <div className={cn("h-6 w-6 rounded-md ring-1 flex items-center justify-center shrink-0",
                                selectedLesson?.id === lesson.id ? "bg-primary/15 ring-primary/20" : "bg-muted/30 ring-border/20"
                              )}>
                                <PlayCircle className={cn("h-3 w-3", selectedLesson?.id === lesson.id ? "text-primary" : "text-muted-foreground/50")} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-[11px] truncate", selectedLesson?.id === lesson.id ? "text-primary font-bold" : "text-foreground/70 font-medium")}>{lesson.title}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {lesson.is_free && <span className="text-[8px] bg-primary/10 text-primary px-1.5 rounded font-black">FREE</span>}
                                  {lesson.video_url && <Video className="h-2.5 w-2.5 text-muted-foreground/40" />}
                                  {(lesson.drip_days || 0) > 0 && <Clock className="h-2.5 w-2.5 text-warning/60" />}
                                  <span className={cn("h-1.5 w-1.5 rounded-full", lesson.video_url ? "bg-success" : "bg-warning/50")} />
                                </div>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/lesson:opacity-100 hover:bg-destructive/10 transition-all shrink-0"
                              >
                                <Trash2 className="h-2.5 w-2.5 text-destructive/50" />
                              </button>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>

                        <button
                          onClick={() => createLesson(mod.id)}
                          className="w-full mt-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="text-[11px] font-bold">Adicionar aula</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* New Module */}
            {showNewModule ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2.5">
                <input
                  autoFocus value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createModule(); if (e.key === "Escape") setShowNewModule(false); }}
                  placeholder="Nome do módulo..."
                  className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button onClick={createModule} className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors">Criar</button>
                  <button onClick={() => setShowNewModule(false)} className="h-7 px-3 rounded-lg bg-muted text-muted-foreground text-[11px] font-bold hover:bg-muted/80 transition-colors">Cancelar</button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowNewModule(true)}
                className="w-full rounded-xl border-2 border-dashed border-border/40 py-4 flex flex-col items-center gap-1 text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[11px] font-bold">Novo Módulo</span>
              </button>
            )}
          </div>
        </aside>

        {/* ─── RIGHT: Lesson Editor ─── */}
        <main className="flex-1 bg-background overflow-y-auto">
          {selectedLesson ? (
            <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-6">
              {/* Lesson Header */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-5 rounded-md bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                    <Hash className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/60">
                    {modules.find(m => m.lessons.some(l => l.id === selectedLesson.id))?.title}
                  </span>
                </div>
                {editingLessonTitle ? (
                  <input
                    ref={titleInputRef} value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onBlur={() => { setEditingLessonTitle(false); if (lessonTitle.trim() && lessonTitle !== selectedLesson.title) autoSave("title", lessonTitle.trim()); }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-transparent text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground focus:outline-none border-b-2 border-primary/30 pb-2"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => { setEditingLessonTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}
                    className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground cursor-text hover:text-foreground/80 transition-colors"
                  >
                    {lessonTitle || "Sem título"}
                  </h2>
                )}
              </div>

              {/* ─── Video Section ─── */}
              <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 overflow-hidden shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />
                {uploadingVideo ? (
                  <div className="aspect-video flex flex-col items-center justify-center gap-4 p-6">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="w-full max-w-xs">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="font-bold">Enviando vídeo...</span>
                        <span className="font-numbers font-bold">{Math.round(videoUploadProgress)}%</span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full" animate={{ width: `${videoUploadProgress}%` }} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Não feche esta página</p>
                  </div>
                ) : lessonVideoUrl ? (
                  <div className="relative">
                    {isDirectVideoUrl(lessonVideoUrl) ? (
                      <video controls className="w-full aspect-video bg-black" src={lessonVideoUrl} />
                    ) : getVideoEmbed(lessonVideoUrl) ? (
                      <iframe
                        src={getVideoEmbed(lessonVideoUrl)!}
                        className="w-full aspect-video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : getVideoThumbnail(lessonVideoUrl) ? (
                      <div className="relative aspect-video bg-muted">
                        <img src={getVideoThumbnail(lessonVideoUrl)!} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-foreground/20 flex items-center justify-center">
                          <div className="h-16 w-16 rounded-full bg-card/80 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <PlayCircle className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                          <Video className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-bold truncate">{lessonVideoUrl}</p>
                          <p className="text-[11px] text-primary font-medium">Vídeo vinculado</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                      className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-card/90 backdrop-blur-sm border border-border/40 flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-muted/10 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleVideoUpload(f); }}
                  >
                    <div className="h-16 w-16 rounded-2xl bg-muted/20 border-2 border-dashed border-border/40 flex items-center justify-center">
                      <Upload className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-display font-bold text-foreground/60">Arraste um vídeo ou clique para enviar</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, WebM, OGG — até 500MB</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50">ou cole um link do YouTube/Vimeo abaixo</p>
                  </div>
                )}
              </div>
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); }} />

              {/* Video URL Input */}
              {!uploadingVideo && (
                <div className="relative">
                  <Video className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <input
                    value={lessonVideoUrl}
                    onChange={e => { setLessonVideoUrl(e.target.value); debouncedSave("video_url", e.target.value || null); }}
                    placeholder="https://youtu.be/... ou https://vimeo.com/..."
                    className="w-full h-11 pl-11 pr-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  />
                </div>
              )}

              {/* ─── Description ─── */}
              <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 p-5 sm:p-6 space-y-3 shadow-sm overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-display font-black text-foreground tracking-tight">Descrição da Aula</span>
                </div>
                <textarea
                  value={lessonDescription}
                  onChange={e => { setLessonDescription(e.target.value); debouncedSave("description", e.target.value || null); }}
                  placeholder="Descreva o que será abordado nesta aula..."
                  rows={5}
                  className="w-full bg-muted/10 rounded-xl border border-border/30 p-4 text-sm text-foreground placeholder:text-muted-foreground/30 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                />
              </div>

              {/* ─── Settings Grid ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Duration */}
                <SettingCard
                  icon={<Clock className="h-4 w-4 text-info" />}
                  iconBg="bg-info/10" iconColor="info"
                  title="Duração" subtitle="Tempo da aula"
                  accentColor="info"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} value={lessonDuration}
                      onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDuration(v); debouncedSave("duration_minutes", v); }}
                      className="h-9 w-14 rounded-lg bg-muted/20 border border-border/30 text-center text-sm font-numbers font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-info/20"
                    />
                    <span className="text-xs text-muted-foreground font-bold">min</span>
                  </div>
                </SettingCard>

                {/* Free Lesson */}
                <SettingCard
                  icon={<Globe className="h-4 w-4 text-success" />}
                  iconBg="bg-success/10" iconColor="success"
                  title="Aula Gratuita" subtitle="Disponível sem compra"
                  accentColor="success"
                >
                  <Switch checked={lessonIsFree} onCheckedChange={v => { setLessonIsFree(v); autoSave("is_free", v); }} />
                </SettingCard>

                {/* Drip Content */}
                <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 p-5 space-y-3 shadow-sm sm:col-span-2 overflow-hidden transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/60">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-warning/10 ring-1 ring-warning/20 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-warning" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-display font-bold text-foreground tracking-tight">Gotejamento de Conteúdo</p>
                      <p className="text-[11px] text-muted-foreground">Liberar aula após X dias da compra</p>
                    </div>
                    <Switch
                      checked={lessonDripEnabled}
                      onCheckedChange={v => {
                        setLessonDripEnabled(v);
                        if (!v) { setLessonDripDays(0); autoSave("drip_days", 0); }
                      }}
                    />
                  </div>
                  <AnimatePresence>
                    {lessonDripEnabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground font-medium">Liberar após</span>
                          <input
                            type="number" min={0} value={lessonDripDays}
                            onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDripDays(v); debouncedSave("drip_days", v); }}
                            className="h-9 w-16 rounded-lg bg-muted/20 border border-border/30 text-center text-sm font-numbers font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-warning/20"
                          />
                          <span className="text-xs text-muted-foreground font-medium">dias da compra</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ─── Attachments ─── */}
              <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 p-5 sm:p-6 shadow-sm overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-[hsl(var(--primary))]" style={{ background: 'hsl(280 60% 55%)' }} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20 flex items-center justify-center">
                      <Paperclip className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-foreground tracking-tight">Anexos da Aula</p>
                      <p className="text-[11px] text-muted-foreground">PDFs, planilhas e materiais complementares</p>
                    </div>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 rounded-xl text-xs h-8 font-bold border-border/40"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={uploadingAttachment}
                  >
                    {uploadingAttachment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Anexar
                  </Button>
                </div>

                <input ref={attachmentInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachmentUpload(f); }} />

                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/30 group hover:border-border/50 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                        <div className="h-9 w-9 rounded-lg bg-muted/30 ring-1 ring-border/20 flex items-center justify-center shrink-0">
                          <File className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{att.file_name}</p>
                          <p className="text-[10px] text-muted-foreground font-numbers">{formatFileSize(att.file_size)}</p>
                        </div>
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-colors opacity-0 group-hover:opacity-100">
                          <Download className="h-3 w-3 text-muted-foreground" />
                        </a>
                        <button onClick={() => deleteAttachment(att)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3 text-destructive/60" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="rounded-xl border-2 border-dashed border-border/40 py-6 flex flex-col items-center gap-2 text-muted-foreground/30 hover:text-muted-foreground/50 hover:border-border/60 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer"
                    onClick={() => attachmentInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleAttachmentUpload(f); }}
                  >
                    <Upload className="h-5 w-5" />
                    <p className="text-xs font-bold">Arraste arquivos ou clique para enviar</p>
                    <p className="text-[10px]">PDF, DOCX, XLSX, ZIP — até 50MB</p>
                  </div>
                )}
              </div>

              {/* Delete Lesson */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost" size="sm"
                  className="gap-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/5 rounded-xl text-xs font-bold"
                  onClick={() => deleteLesson(selectedLesson.id)}
                >
                  <Trash2 className="h-3 w-3" /> Excluir aula
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-5">
              <div className="h-20 w-20 rounded-2xl bg-muted/10 border border-border/30 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/15" />
              </div>
              <div className="text-center">
                <p className="text-base font-display font-bold text-foreground/40 mb-1">Selecione uma aula</p>
                <p className="text-sm text-muted-foreground/40">Clique em uma aula na barra lateral para editá-la</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
