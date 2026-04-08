import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, GripVertical, X,
  ChevronRight, Clock, Video, FileText,
  Calendar, Paperclip, ArrowLeft, Eye, EyeOff, Upload,
  Globe, Lock, CheckCircle2, Loader2, AlertCircle, Hash,
  Download, File, Sparkles, ChevronDown, MoreHorizontal,
  Zap, Settings, Star, PanelLeftClose, PanelLeft,
  GraduationCap, Flame, Shield, Copy, ExternalLink, Users,
  Activity, Award, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import StudentPreviewPanel from "@/components/course/StudentPreviewPanel";

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

const ease = [0.16, 1, 0.3, 1] as const;

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
  const [activeEditorTab, setActiveEditorTab] = useState<"video" | "content" | "settings">("video");
  const [studentCount, setStudentCount] = useState(0);
  const [lessonStats, setLessonStats] = useState<Map<string, number>>(new Map());

  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // ─── Load All ───────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!courseId) return;
    const [courseRes, modsRes, accessRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order"),
      supabase.from("user_access").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "active"),
    ]);
    if (courseRes.data) setCourse(courseRes.data as Course);
    setStudentCount(accessRes.count || 0);
    const mods = modsRes.data || [];
    const moduleIds = mods.map(m => m.id);
    let lessons: Lesson[] = [];
    if (moduleIds.length > 0) {
      const { data: l } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      if (l) lessons = l as Lesson[];
      const lessonIds = lessons.map(le => le.id);
      if (lessonIds.length > 0) {
        const { data: progressData } = await supabase.from("user_progress").select("lesson_id").eq("completed", true).in("lesson_id", lessonIds);
        const statsMap = new Map<string, number>();
        progressData?.forEach(p => statsMap.set(p.lesson_id, (statsMap.get(p.lesson_id) || 0) + 1));
        setLessonStats(statsMap);
      }
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
    setActiveEditorTab("video");
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center shadow-xl shadow-primary/10">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-display font-bold text-foreground/50">Carregando curso...</p>
          <p className="text-sm text-muted-foreground/40 mt-1">Preparando o editor</p>
        </div>
      </motion.div>
    </div>
  );

  if (!course) return (
    <div className="h-screen w-screen bg-background flex items-center justify-center flex-col gap-6">
      <div className="h-24 w-24 rounded-3xl bg-destructive/10 border border-destructive/15 flex items-center justify-center">
        <AlertCircle className="h-10 w-10 text-destructive/50" />
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-lg font-display font-bold">Curso não encontrado</p>
        <p className="text-sm text-muted-foreground/60 mt-1.5">O curso pode ter sido excluído</p>
      </div>
      <Button variant="ghost" onClick={() => navigate("/vendas/conteudo")} className="rounded-xl font-display font-bold gap-2.5 text-sm">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
    </div>
  );

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
  const completedLessons = modules.reduce((a, m) => a + m.lessons.filter(l => l.video_url).length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const editorTabs = [
    { id: "video" as const, label: "Vídeo", icon: Video },
    { id: "content" as const, label: "Conteúdo", icon: FileText },
    { id: "settings" as const, label: "Config", icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden">
      {/* ═══ Premium Top Bar ═══ */}
      <header className="h-14 border-b border-border/20 bg-card/80 backdrop-blur-2xl flex items-center justify-between px-3 sm:px-5 shrink-0 z-50 relative overflow-hidden shadow-sm">
        {/* Subtle mesh gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-info/[0.03] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

        <div className="relative flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            onClick={() => navigate("/vendas/conteudo")}
            className="h-9 w-9 rounded-xl bg-muted/10 border border-border/20 flex items-center justify-center hover:bg-muted/20 hover:border-border/30 transition-all duration-300 active:scale-[0.985] shrink-0 group"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
          </button>

          <div className="hidden sm:flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/15 shrink-0 ring-1 ring-primary/20">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-display font-black text-foreground leading-none truncate max-w-[200px] lg:max-w-[320px] tracking-[-0.02em]">{course.title}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] font-display font-semibold text-muted-foreground/50">{modules.length} mód · {totalLessons} aulas</span>
                {studentCount > 0 && (
                  <span className="text-[10px] font-display font-bold text-primary/60 flex items-center gap-1 bg-primary/5 px-1.5 py-0.5 rounded-md">
                    <Users className="h-2.5 w-2.5" /> {studentCount}
                  </span>
                )}
                {totalLessons > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-muted/15 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8, ease }}
                      />
                    </div>
                    <span className="text-[10px] font-display font-black text-primary/60 tabular-nums">{progressPct}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Mobile title */}
          <div className="sm:hidden min-w-0">
            <h1 className="text-xs font-display font-black text-foreground truncate max-w-[140px]">{course.title}</h1>
            <span className="text-[10px] font-display text-muted-foreground/40">{totalLessons} aulas</span>
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 sm:gap-2.5">
          {/* Save status */}
          <AnimatePresence mode="wait">
            <motion.div key={saveStatus} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="hidden sm:flex items-center gap-1.5 mr-1">
              {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" /><span className="text-[10px] text-muted-foreground/40 font-display font-bold">Salvando</span></>}
              {saveStatus === "saved" && <><CheckCircle2 className="h-3 w-3 text-success/60" /><span className="text-[10px] text-success/60 font-display font-bold">Salvo</span></>}
              {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-destructive/60" /><span className="text-[10px] text-destructive/60 font-display font-bold">Erro</span></>}
            </motion.div>
          </AnimatePresence>

          {/* Preview */}
          {course.is_published && (
            <button
              onClick={() => window.open(`/membros-area/curso/${courseId}`, "_blank")}
              className="hidden sm:flex h-9 px-3.5 rounded-xl bg-info/8 border border-info/15 text-xs font-display font-bold text-info/70 items-center gap-1.5 hover:bg-info/15 transition-all active:scale-[0.985]"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          )}

          <button
            onClick={togglePublish}
            className={cn(
              "h-9 px-3.5 sm:px-4 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all duration-300 active:scale-[0.985] border shadow-sm",
              course.is_published
                ? "bg-success/10 text-success border-success/20 hover:bg-success/15 shadow-success/5"
                : "bg-muted/10 border-border/20 text-muted-foreground/50 hover:text-foreground/70 hover:border-border/30 hover:bg-muted/20"
            )}
          >
            {course.is_published ? (
              <><span className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success)/0.4)]" /> <span className="hidden sm:inline">Publicado</span><span className="sm:hidden">Live</span></>
            ) : (
              <><EyeOff className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rascunho</span></>
            )}
          </button>
        </div>
      </header>

      {/* ═══ Split Screen ═══ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ─── LEFT: Sidebar ─── */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease }}
              className="bg-card/30 backdrop-blur-xl border-r border-border/15 flex flex-col overflow-hidden shrink-0"
            >
              {/* Sidebar header */}
              <div className="px-4 py-4 border-b border-border/15 flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent pointer-events-none" />
                <div className="relative flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary/60" />
                  </div>
                  <div>
                    <span className="text-sm font-display font-black text-foreground/80 block">Estrutura</span>
                    <span className="text-[10px] text-muted-foreground/40 font-display">{modules.length} módulo{modules.length !== 1 ? "s" : ""} · {totalLessons} aula{totalLessons !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="relative h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/10 transition-colors text-muted-foreground/25 hover:text-muted-foreground/50"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Modules list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ WebkitOverflowScrolling: "touch" }}>
                {modules.map((mod, idx) => {
                  const lessonsWithVideo = mod.lessons.filter(l => l.video_url).length;
                  const modPct = mod.lessons.length > 0 ? Math.round((lessonsWithVideo / mod.lessons.length) * 100) : 0;

                  return (
                    <div key={mod.id} className="rounded-xl overflow-hidden ring-1 ring-border/10 hover:ring-border/20 transition-all duration-300 bg-card/20">
                      {/* Module Header */}
                      <div
                        className={cn(
                          "flex items-center gap-2.5 px-3.5 py-3 cursor-pointer group transition-all duration-300 relative",
                          expandedModules.has(mod.id) ? "bg-card/40" : "hover:bg-card/30"
                        )}
                        onClick={() => toggleExpand(mod.id)}
                      >
                        {expandedModules.has(mod.id) && (
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                        )}
                        <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/25" />
                        </motion.div>
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-display font-black ring-1 transition-colors",
                          expandedModules.has(mod.id) ? "bg-primary/10 text-primary ring-primary/15" : "bg-muted/8 text-muted-foreground/30 ring-border/10"
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
                              className="w-full text-xs font-display font-bold text-foreground bg-transparent focus:outline-none border-b border-primary/25 pb-0.5"
                            />
                          ) : (
                            <p
                              className="text-xs font-display font-bold text-foreground/80 truncate"
                              onDoubleClick={e => { e.stopPropagation(); setEditingModuleId(mod.id); setEditingModuleTitle(mod.title); }}
                            >{mod.title}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-muted-foreground/30 font-display">{mod.lessons.length} aula{mod.lessons.length !== 1 ? "s" : ""}</p>
                            {mod.lessons.length > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="h-1 w-8 rounded-full bg-muted/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-primary/50 transition-all" style={{ width: `${modPct}%` }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground/20 font-display tabular-nums">{modPct}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/8 transition-all"
                        >
                          <Trash2 className="h-3 w-3 text-destructive/30" />
                        </button>
                      </div>

                      {/* Lessons */}
                      <AnimatePresence>
                        {expandedModules.has(mod.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border/10 px-2.5 py-2">
                              <Reorder.Group axis="y" values={mod.lessons} onReorder={newOrder => reorderLessons(mod.id, newOrder)} className="space-y-0.5">
                                {mod.lessons.map((lesson, li) => (
                                  <Reorder.Item
                                    key={lesson.id} value={lesson}
                                    className={cn(
                                      "relative flex items-center gap-2.5 pl-3 pr-2.5 py-2.5 rounded-lg cursor-pointer group/lesson transition-all duration-300",
                                      selectedLesson?.id === lesson.id
                                        ? "bg-primary/8 ring-1 ring-primary/15"
                                        : "hover:bg-muted/5 ring-1 ring-transparent"
                                    )}
                                    onClick={() => selectLesson(lesson)}
                                  >
                                    {selectedLesson?.id === lesson.id && (
                                      <motion.div layoutId="lesson-active-bar" className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.3)]" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                                    )}
                                    <GripVertical className="h-3 w-3 text-muted-foreground/10 opacity-0 group-hover/lesson:opacity-100 cursor-grab shrink-0 transition-opacity" />
                                    <div className={cn(
                                      "h-7 w-7 rounded-lg ring-1 flex items-center justify-center shrink-0 text-[10px] font-display font-black transition-all",
                                      lesson.video_url
                                        ? selectedLesson?.id === lesson.id
                                          ? "bg-primary/15 ring-primary/20 text-primary"
                                          : "bg-success/8 ring-success/12 text-success/60"
                                        : selectedLesson?.id === lesson.id
                                          ? "bg-primary/10 ring-primary/15 text-primary/80"
                                          : "bg-muted/5 ring-border/10 text-muted-foreground/25"
                                    )}>
                                      {lesson.video_url ? <CheckCircle2 className="h-3 w-3" /> : li + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("text-xs truncate font-display transition-colors", selectedLesson?.id === lesson.id ? "text-primary font-bold" : "text-foreground/60 font-semibold")}>{lesson.title}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {lesson.is_free && <span className="text-[8px] bg-success/10 text-success/70 px-1.5 py-0.5 rounded font-display font-bold ring-1 ring-success/15">FREE</span>}
                                        {lesson.video_url ? (
                                          <span className="flex items-center gap-0.5 text-[10px] text-success/50 font-display font-semibold"><span className="h-1 w-1 rounded-full bg-success/60" /> Vídeo</span>
                                        ) : (
                                          <span className="flex items-center gap-0.5 text-[10px] text-warning/40 font-display font-semibold"><span className="h-1 w-1 rounded-full bg-warning/40" /> Pendente</span>
                                        )}
                                        {(lesson.drip_days || 0) > 0 && <span className="text-[10px] text-info/40 font-display font-semibold">{lesson.drip_days}d</span>}
                                        {(lessonStats.get(lesson.id) || 0) > 0 && (
                                          <span className="text-[10px] text-primary/40 font-display font-semibold flex items-center gap-0.5"><Users className="h-2 w-2" />{lessonStats.get(lesson.id)}</span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                      className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover/lesson:opacity-100 hover:bg-destructive/8 transition-all shrink-0"
                                    >
                                      <Trash2 className="h-2.5 w-2.5 text-destructive/30" />
                                    </button>
                                  </Reorder.Item>
                                ))}
                              </Reorder.Group>

                              <button
                                onClick={() => createLesson(mod.id)}
                                className="w-full mt-1.5 flex items-center gap-2 px-3 py-2.5 rounded-lg text-muted-foreground/20 hover:text-primary/60 hover:bg-primary/[0.04] transition-all duration-300 active:scale-[0.985]"
                              >
                                <Plus className="h-3 w-3" />
                                <span className="text-[11px] font-display font-bold">Nova aula</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* New Module */}
                {showNewModule ? (
                  <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="rounded-xl bg-primary/5 border border-primary/15 p-4 space-y-3">
                    <input
                      autoFocus value={newModuleTitle}
                      onChange={e => setNewModuleTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createModule(); if (e.key === "Escape") setShowNewModule(false); }}
                      placeholder="Nome do módulo..."
                      className="w-full bg-transparent text-sm font-display font-bold text-foreground placeholder:text-muted-foreground/25 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={createModule} className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-display font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/15 active:scale-[0.985]">Criar</button>
                      <button onClick={() => setShowNewModule(false)} className="h-8 px-4 rounded-lg bg-muted/10 text-muted-foreground/50 text-xs font-display font-bold hover:bg-muted/20 transition-colors">Cancelar</button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowNewModule(true)}
                    className="w-full rounded-xl border-2 border-dashed border-border/15 py-5 flex flex-col items-center gap-2.5 text-muted-foreground/15 hover:text-primary/50 hover:border-primary/20 hover:bg-primary/[0.03] transition-all duration-500 active:scale-[0.985] group/new"
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted/5 flex items-center justify-center group-hover/new:bg-primary/8 group-hover/new:ring-1 group-hover/new:ring-primary/15 transition-all duration-300">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-display font-bold">Novo Módulo</span>
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar toggle */}
        <AnimatePresence>
          {sidebarCollapsed && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => setSidebarCollapsed(false)}
              className="absolute left-3 top-3 z-40 h-9 w-9 rounded-xl bg-card/90 backdrop-blur-xl border border-border/20 flex items-center justify-center hover:bg-muted/15 hover:border-border/30 transition-all shadow-lg shadow-foreground/[0.03] active:scale-[0.985]"
            >
              <PanelLeft className="h-4 w-4 text-muted-foreground/40" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ─── RIGHT: Lesson Editor ─── */}
        <main className="flex-1 bg-background overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          {selectedLesson ? (
            <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-8 space-y-6">

              {/* Lesson Header */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                    <Hash className="h-3 w-3 text-primary/50" />
                  </div>
                  <span className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-primary/40">
                    {modules.find(m => m.lessons.some(l => l.id === selectedLesson.id))?.title}
                  </span>
                  {/* Lesson status badges */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {lessonVideoUrl && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-display font-bold text-success/60 bg-success/5 px-2 py-0.5 rounded-md ring-1 ring-success/10">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Vídeo
                      </span>
                    )}
                    {lessonIsFree && (
                      <span className="text-[9px] font-display font-bold text-info/60 bg-info/5 px-2 py-0.5 rounded-md ring-1 ring-info/10">Gratuita</span>
                    )}
                  </div>
                </div>
                {editingLessonTitle ? (
                  <input
                    ref={titleInputRef} value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onBlur={() => { setEditingLessonTitle(false); if (lessonTitle.trim() && lessonTitle !== selectedLesson.title) autoSave("title", lessonTitle.trim()); }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-transparent text-2xl sm:text-3xl font-display font-black tracking-[-0.03em] text-foreground focus:outline-none border-b-2 border-primary/20 pb-1.5"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => { setEditingLessonTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}
                    className="text-2xl sm:text-3xl font-display font-black tracking-[-0.03em] text-foreground cursor-text hover:text-foreground/70 transition-colors leading-tight"
                  >
                    {lessonTitle || "Sem título"}
                  </h2>
                )}
              </motion.div>

              {/* ── Editor Tabs ── */}
              <div className="flex items-center gap-1 p-1.5 rounded-xl bg-card/50 backdrop-blur-xl border border-border/20 w-fit shadow-sm">
                {editorTabs.map(tab => {
                  const isActive = activeEditorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveEditorTab(tab.id)}
                      className={cn(
                        "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-display font-bold transition-all duration-300 active:scale-[0.985]",
                        isActive ? "text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/50"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="editor-tab-active"
                          className="absolute inset-0 rounded-lg bg-card border border-border/25 shadow-sm"
                          transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                        />
                      )}
                      <tab.icon className="h-3.5 w-3.5 relative z-10" />
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Tab Content ── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeEditorTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease }}
                  className="space-y-5"
                >
                  {/* ─── VIDEO TAB ─── */}
                  {activeEditorTab === "video" && (
                    <>
                      <div className="rounded-2xl bg-card/60 border border-border/20 overflow-hidden shadow-md ring-1 ring-border/5">
                        {uploadingVideo ? (
                          <div className="aspect-video flex flex-col items-center justify-center gap-5 p-8 bg-gradient-to-b from-primary/[0.02] to-transparent">
                            <div className="h-20 w-20 rounded-2xl bg-primary/8 border border-primary/10 flex items-center justify-center shadow-lg shadow-primary/5">
                              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
                            </div>
                            <div className="w-full max-w-xs">
                              <div className="flex justify-between text-xs mb-2">
                                <span className="font-display font-bold text-foreground/50">Enviando vídeo...</span>
                                <span className="font-display font-bold text-primary/70 tabular-nums">{Math.round(videoUploadProgress)}%</span>
                              </div>
                              <div className="h-2.5 bg-muted/10 rounded-full overflow-hidden ring-1 ring-border/10">
                                <motion.div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" animate={{ width: `${videoUploadProgress}%` }} transition={{ ease: "easeOut" }} />
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
                                <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px] flex items-center justify-center">
                                  <div className="h-18 w-18 rounded-2xl bg-card/90 backdrop-blur-xl flex items-center justify-center shadow-2xl ring-1 ring-border/20">
                                    <PlayCircle className="h-9 w-9 text-primary" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-5 flex items-center gap-3 bg-gradient-to-r from-primary/[0.02] to-transparent">
                                <div className="h-12 w-12 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center shadow-sm">
                                  <Video className="h-5 w-5 text-primary/60" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-foreground/70 font-display font-bold truncate">{lessonVideoUrl}</p>
                                  <p className="text-[10px] text-primary/40 font-display font-semibold mt-0.5 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Vídeo vinculado</p>
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                              className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-card/90 backdrop-blur-xl border border-border/20 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/15 transition-all shadow-lg"
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="aspect-video flex flex-col items-center justify-center gap-5 cursor-pointer hover:bg-primary/[0.02] transition-all duration-500 group/upload relative overflow-hidden"
                            onClick={() => videoInputRef.current?.click()}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleVideoUpload(f); }}
                          >
                            {/* Decorative grid */}
                            <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/[0.02] pointer-events-none" />

                            <div className="relative h-20 w-20 rounded-2xl border-2 border-dashed border-border/20 flex items-center justify-center group-hover/upload:border-primary/25 group-hover/upload:bg-primary/[0.04] transition-all duration-500">
                              <Upload className="h-8 w-8 text-muted-foreground/10 group-hover/upload:text-primary/30 transition-colors" />
                            </div>
                            <div className="relative text-center">
                              <p className="text-sm font-display font-bold text-foreground/20 group-hover/upload:text-foreground/50 transition-colors">Arraste ou clique para enviar</p>
                              <p className="text-xs text-muted-foreground/25 mt-1.5 font-display">MP4, WebM, OGG — até 500MB</p>
                            </div>
                            <p className="relative text-[10px] text-muted-foreground/15 font-display">ou cole um link abaixo</p>
                          </div>
                        )}
                      </div>
                      <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); }} />

                      {/* Video URL Input */}
                      {!uploadingVideo && (
                        <div className="relative group">
                          <Video className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/15 group-focus-within:text-primary/40 transition-colors" />
                          <input
                            value={lessonVideoUrl}
                            onChange={e => { setLessonVideoUrl(e.target.value); debouncedSave("video_url", e.target.value || null); }}
                            placeholder="https://youtu.be/... ou https://vimeo.com/..."
                            className="w-full h-12 pl-11 pr-4 rounded-xl bg-card/50 border border-border/20 text-sm font-display text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/25 transition-all duration-300 shadow-sm"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* ─── CONTENT TAB ─── */}
                  {activeEditorTab === "content" && (
                    <>
                      {/* Description */}
                      <div className="rounded-2xl bg-card/60 border border-border/20 overflow-hidden shadow-md">
                        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/15 bg-card/30">
                          <div className="h-9 w-9 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary/50" />
                          </div>
                          <div>
                            <span className="text-xs font-display font-black text-foreground/70 block">Descrição da Aula</span>
                            <span className="text-[10px] text-muted-foreground/30 font-display">Visível para alunos abaixo do player</span>
                          </div>
                        </div>
                        <textarea
                          value={lessonDescription}
                          onChange={e => { setLessonDescription(e.target.value); debouncedSave("description", e.target.value || null); }}
                          placeholder="Descreva o conteúdo desta aula para seus alunos..."
                          rows={8}
                          className="w-full bg-transparent p-5 text-sm text-foreground/80 placeholder:text-muted-foreground/20 leading-relaxed focus:outline-none resize-none font-display"
                        />
                      </div>

                      {/* Attachments */}
                      <div className="rounded-2xl bg-card/60 border border-border/20 overflow-hidden shadow-md">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/15 bg-card/30">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
                              <Paperclip className="h-4 w-4 text-info/50" />
                            </div>
                            <div>
                              <span className="text-xs font-display font-black text-foreground/70 block">Materiais de Apoio</span>
                              <span className="text-[10px] text-muted-foreground/30 font-display">{attachments.length} arquivo{attachments.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => attachmentInputRef.current?.click()}
                            disabled={uploadingAttachment}
                            className="h-9 px-4 rounded-xl bg-info/8 border border-info/15 text-xs font-display font-bold text-info/60 hover:text-info hover:bg-info/12 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.985]"
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
                                <div key={att.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/5 group transition-all duration-300 ring-1 ring-transparent hover:ring-border/10">
                                  <div className="h-10 w-10 rounded-xl bg-muted/5 ring-1 ring-border/10 flex items-center justify-center shrink-0">
                                    <File className="h-4 w-4 text-muted-foreground/25" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-display font-bold text-foreground/60 truncate">{att.file_name}</p>
                                    <p className="text-[10px] text-muted-foreground/30 font-display tabular-nums mt-0.5">{formatFileSize(att.file_size)}</p>
                                  </div>
                                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/10 transition-colors opacity-0 group-hover:opacity-100">
                                    <Download className="h-3.5 w-3.5 text-muted-foreground/30" />
                                  </a>
                                  <button onClick={() => deleteAttachment(att)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 className="h-3.5 w-3.5 text-destructive/30" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              className="rounded-xl border-2 border-dashed border-border/15 py-10 flex flex-col items-center gap-3 text-muted-foreground/12 hover:text-muted-foreground/25 hover:border-border/25 transition-all duration-500 cursor-pointer"
                              onClick={() => attachmentInputRef.current?.click()}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleAttachmentUpload(f); }}
                            >
                              <div className="h-14 w-14 rounded-2xl bg-muted/5 flex items-center justify-center">
                                <Upload className="h-6 w-6" />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-display font-bold">Arraste ou clique para anexar</p>
                                <p className="text-[10px] mt-1">PDF, DOCX, ZIP — até 50MB</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ─── SETTINGS TAB ─── */}
                  {activeEditorTab === "settings" && (
                    <div className="space-y-4">
                      {/* Duration */}
                      <div className="rounded-2xl bg-card/60 border border-border/20 p-5 hover:border-border/30 transition-all duration-300 shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-info/10 ring-1 ring-info/15 flex items-center justify-center shadow-sm shadow-info/5">
                              <Clock className="h-5 w-5 text-info/60" />
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-foreground/80">Duração</p>
                              <p className="text-[10px] text-muted-foreground/30 mt-0.5">Tempo estimado de vídeo</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" min={0} value={lessonDuration}
                              onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDuration(v); debouncedSave("duration_minutes", v); }}
                              className="h-11 w-18 rounded-xl bg-card/80 border border-border/20 text-center text-sm font-display font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-info/15 transition-all shadow-sm"
                            />
                            <span className="text-xs text-muted-foreground/40 font-display font-semibold">min</span>
                          </div>
                        </div>
                      </div>

                      {/* Free Lesson */}
                      <div className="rounded-2xl bg-card/60 border border-border/20 p-5 hover:border-border/30 transition-all duration-300 shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-success/10 ring-1 ring-success/15 flex items-center justify-center shadow-sm shadow-success/5">
                              <Globe className="h-5 w-5 text-success/60" />
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-foreground/80">Aula Gratuita</p>
                              <p className="text-[10px] text-muted-foreground/30 mt-0.5">Disponível sem compra como preview</p>
                            </div>
                          </div>
                          <Switch checked={lessonIsFree} onCheckedChange={v => { setLessonIsFree(v); autoSave("is_free", v); }} />
                        </div>
                      </div>

                      {/* Drip */}
                      <div className="rounded-2xl bg-card/60 border border-border/20 p-5 hover:border-border/30 transition-all duration-300 shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-warning/10 ring-1 ring-warning/15 flex items-center justify-center shadow-sm shadow-warning/5">
                              <Calendar className="h-5 w-5 text-warning/60" />
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-foreground/80">Gotejamento</p>
                              <p className="text-[10px] text-muted-foreground/30 mt-0.5">Liberar após X dias da compra</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <Switch
                              checked={lessonDripEnabled}
                              onCheckedChange={v => {
                                setLessonDripEnabled(v);
                                if (!v) { setLessonDripDays(0); autoSave("drip_days", 0); }
                              }}
                            />
                            <AnimatePresence>
                              {lessonDripEnabled && (
                                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-2 overflow-hidden">
                                  <input
                                    type="number" min={0} value={lessonDripDays}
                                    onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDripDays(v); debouncedSave("drip_days", v); }}
                                    className="h-10 w-16 rounded-xl bg-card/80 border border-border/20 text-center text-sm font-display font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-warning/15 shadow-sm"
                                  />
                                  <span className="text-xs text-muted-foreground/40 font-display font-semibold whitespace-nowrap">dias</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      <div className="rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-destructive/8 ring-1 ring-destructive/12 flex items-center justify-center">
                              <Trash2 className="h-5 w-5 text-destructive/40" />
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-destructive/60">Zona de Perigo</p>
                              <p className="text-[10px] text-muted-foreground/30 mt-0.5">Esta ação não pode ser desfeita</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => deleteLesson(selectedLesson.id)}
                            className="rounded-xl text-xs font-display font-bold text-destructive/50 hover:text-destructive hover:bg-destructive/8 active:scale-[0.985]"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Aula
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            /* ── Empty State — Cinematic ── */
            <div className="h-full flex flex-col items-center justify-center gap-6 relative overflow-hidden">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-info/[0.02] pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              {/* Ambient blobs */}
              <div className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full bg-primary/4 blur-[120px] animate-pulse-glow pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/3 w-48 h-48 rounded-full bg-info/4 blur-[100px] animate-pulse-glow pointer-events-none" style={{ animationDelay: "1.5s" }} />

              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="relative text-center">
                <div className="h-28 w-28 rounded-[2rem] bg-gradient-to-br from-card via-card to-primary/5 border border-border/15 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/[0.05] relative group">
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
                  <GraduationCap className="h-14 w-14 text-primary/10 relative z-10 group-hover:text-primary/20 transition-colors duration-500" />
                </div>
                <h3 className="text-xl font-display font-black text-foreground/30 mb-2 tracking-[-0.02em]">Selecione uma aula</h3>
                <p className="text-sm text-muted-foreground/25 font-display max-w-[300px] leading-relaxed">Clique em uma aula na sidebar para começar a editar o conteúdo</p>
              </motion.div>
              {modules.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Button onClick={() => setShowNewModule(true)} className="gap-2 rounded-xl font-display font-bold text-xs h-11 px-6 shadow-lg shadow-primary/15 active:scale-[0.985] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none" />
                    <Plus className="h-3.5 w-3.5 relative z-10" /> <span className="relative z-10">Criar Primeiro Módulo</span>
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </main>
        {/* ─── RIGHT: Student Preview Panel ─── */}
        <StudentPreviewPanel
          course={course}
          modules={modules.map(m => ({
            ...m,
            lessons: m.lessons.map(l => ({
              id: l.id, title: l.title, video_url: l.video_url,
              is_free: l.is_free, duration_minutes: l.duration_minutes,
            }))
          }))}
          selectedLessonId={selectedLesson?.id || null}
        />
      </div>
    </div>
  );
}
